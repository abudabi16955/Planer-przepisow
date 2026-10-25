"""Offline transport regressions: address fallback and safe worker diagnostics."""

import errno
import json
import socket
import subprocess
from email.message import Message
from unittest.mock import Mock, patch

import pytest

from app.importers.web.fetch import (
    PinnedConnection,
    WebImportError,
    connect_public,
    download,
    fetch_resource,
    resolve_public,
)

URL = "https://recipes.example/test"


def response(body=b"html", status=200):
    value = Mock()
    value.status = status
    value.headers = Message()
    value.headers["Content-Type"] = "text/html; charset=utf-8"
    value.getheader.side_effect = lambda key, default=None: value.headers.get(key, default)
    value.read.side_effect = [body, b""]
    return value


def record(address):
    return (
        socket.AF_INET6 if ":" in address else socket.AF_INET,
        socket.SOCK_STREAM,
        6,
        "",
        (address, 443),
    )


@pytest.mark.parametrize("second", ["8.8.4.4", "2606:4700:4700::1111"])
def test_fallback_uses_next_verified_address_and_closes_failed_socket(second):
    records = [record("8.8.8.8"), record(second)]
    first, good = Mock(), Mock()
    first.connect.side_effect = OSError(errno.ENETUNREACH, "private exception text")
    good.getresponse.return_value = response(body=b"synthetic HTML")
    with (
        patch("app.importers.web.fetch.socket.getaddrinfo", return_value=records) as dns,
        patch("app.importers.web.fetch.PinnedConnection", side_effect=[first, good]) as connections,
    ):
        assert download(URL, 1024, 15)["html"] == "synthetic HTML"
    assert [call.args[2] for call in connections.call_args_list] == records
    assert all(call.args[:2] == ("recipes.example", 443) for call in connections.call_args_list)
    assert all(call.args[3] is True for call in connections.call_args_list)
    assert dns.call_count == 1  # No re-resolution between socket attempts.
    first.close.assert_called_once()
    good.close.assert_called_once()


def test_ipv4_is_preferred_even_when_dns_returns_ipv6_first():
    ipv6, ipv4 = record("2606:4700:4700::1111"), record("8.8.8.8")
    with patch("app.importers.web.fetch.socket.getaddrinfo", return_value=[ipv6, ipv4]):
        assert resolve_public("recipes.example", 443) == [ipv4, ipv6]


def test_fallback_does_not_extend_global_deadline():
    failed = Mock()
    failed.connect.side_effect = TimeoutError()
    with (
        patch("app.importers.web.fetch.time.monotonic", side_effect=[90, 100]),
        patch("app.importers.web.fetch.PinnedConnection", return_value=failed) as connection,
        pytest.raises(WebImportError, match="timeout"),
    ):
        connect_public("recipes.example", 443, [record("8.8.8.8"), record("8.8.4.4")], True, 100)
    assert connection.call_count == 1
    assert connection.call_args.args[-1] == 5  # Half the remaining budget, not a fresh timeout.
    failed.close.assert_called_once()


def test_all_unreachable_addresses_return_fetch_failed_with_diagnostic():
    bad = Mock()
    bad.connect.side_effect = OSError(errno.ENETUNREACH, "secret body/query")
    with (
        patch(
            "app.importers.web.fetch.socket.getaddrinfo",
            return_value=[record("8.8.8.8"), record("8.8.4.4")],
        ),
        patch("app.importers.web.fetch.PinnedConnection", return_value=bad) as connections,
        pytest.raises(WebImportError) as failure,
    ):
        download(URL, 1024, 15)
    assert connections.call_count == 2
    assert bad.close.call_count == 2
    assert failure.value.code == "fetch_failed"
    assert failure.value.reason == f"OSError errno={errno.ENETUNREACH}"
    assert failure.value.host == "recipes.example"


@pytest.mark.parametrize(
    "status,encoding,mime,expected",
    [
        (403, "identity", "text/html", "HTTP 403"),
        (503, "gzip", "text/html", "HTTP 503 Content-Encoding=gzip"),
        (200, "br", "text/html", "HTTP 200 Content-Encoding=br"),
        (200, "identity", "application/json", "Content-Type=application/json"),
    ],
)
def test_http_diagnostic_reaches_warning_log_without_body_or_query(
    caplog, status, encoding, mime, expected
):
    def worker(*args, **kwargs):
        reply = response(body=b"SECRET_BODY", status=status)
        headers = {"Content-Type": mime, "Content-Encoding": encoding}
        reply.getheader.side_effect = lambda key, default=None: headers.get(key, default)
        with (
            patch("app.importers.web.fetch.resolve_public", return_value=[record("8.8.8.8")]),
            patch("app.importers.web.fetch.PinnedConnection") as connection,
        ):
            connection.return_value.getresponse.return_value = reply
            try:
                download(URL + "?SECRET_QUERY=secret", 1024, 15)
            except WebImportError as error:
                return subprocess.CompletedProcess(
                    args,
                    0,
                    json.dumps({"error": error.code, "reason": error.reason, "host": error.host}),
                )
        raise AssertionError("Expected HTTP error")

    with (
        patch("app.importers.web.fetch.subprocess.run", side_effect=worker),
        pytest.raises(WebImportError, match="fetch_failed"),
    ):
        fetch_resource(URL + "?SECRET_QUERY=secret")
    assert expected in caplog.text
    assert "code=fetch_failed host=recipes.example reason=" in caplog.text
    assert "SECRET" not in caplog.text
    assert caplog.records[-1].levelname == "WARNING"


def test_worker_network_failure_reason_is_logged_and_not_exception_message(caplog):
    failure = {"error": "fetch_failed", "host": "redirect.example", "reason": "OSError errno=101"}
    with (
        patch(
            "app.importers.web.fetch.subprocess.run",
            return_value=subprocess.CompletedProcess([], 0, json.dumps(failure), "SECRET_STDERR"),
        ),
        pytest.raises(WebImportError, match="fetch_failed"),
    ):
        fetch_resource(URL + "?SECRET_QUERY")
    assert "code=fetch_failed host=redirect.example reason=OSError errno=101" in caplog.text
    assert "SECRET" not in caplog.text


def test_real_worker_passes_blocked_host_reason_to_parent(caplog):
    with pytest.raises(WebImportError, match="blocked_host"):
        fetch_resource("http://127.0.0.1/?SECRET_QUERY")
    assert "code=blocked_host host=127.0.0.1 reason=DNS non-public address" in caplog.text
    assert "SECRET_QUERY" not in caplog.text


def test_tls_uses_remaining_attempt_budget_after_tcp_connect():
    with (
        patch("app.importers.web.fetch.time.monotonic", side_effect=[100, 103]),
        patch("app.importers.web.fetch.socket.socket") as raw,
        patch("app.importers.web.fetch.ssl.create_default_context") as context,
    ):
        connection = PinnedConnection("recipes.example", 443, record("8.8.8.8"), True, 5)
        connection.connect()
    assert [call.args[0] for call in raw.return_value.settimeout.call_args_list] == [5, 2]
    context.return_value.wrap_socket.assert_called_once_with(
        raw.return_value, server_hostname="recipes.example"
    )
