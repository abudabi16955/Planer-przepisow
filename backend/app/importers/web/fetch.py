"""Bounded, cookie-free HTTP transport. DNS answers are pinned to the connection."""

import base64
import http.client
import ipaddress
import json
import logging
import re
import socket
import ssl
import subprocess
import sys
import time
from urllib.parse import quote, urljoin, urlsplit


class WebImportError(Exception):
    def __init__(self, code, reason=None, host=None):
        self.code, self.reason, self.host = code, reason or code, host
        self.logged = False
        super().__init__(code)


def technical_reason(error):
    reason = type(error).__name__
    if isinstance(error, OSError) and error.errno is not None:
        reason += f" errno={error.errno}"
    return reason


def safe_host(url):
    try:
        return parse_url(url)[1]
    except WebImportError:
        return "-"


def log_failure(error, url):
    if not error.logged:
        logging.getLogger(__name__).warning(
            "web_import code=%s host=%s reason=%s",
            error.code,
            error.host or safe_host(url),
            error.reason,
        )
        error.logged = True


def header_reason(value):
    # Log only bounded header tokens, never arbitrary remote text or URLs.
    return value if re.fullmatch(r"[a-zA-Z0-9/+., _-]{1,100}", value) else "invalid"


def parse_url(url):
    try:
        parts = urlsplit(url)
        if (
            len(url) > 4096
            or any(ord(char) < 33 for char in url)
            or "\\" in url
            or parts.scheme not in ("http", "https")
            or not parts.hostname
            or parts.username is not None
            or parts.password is not None
            or parts.port not in (None, 80, 443)
        ):
            raise ValueError
        host = parts.hostname.encode("idna").decode("ascii")
        return parts, host, parts.port or (443 if parts.scheme == "https" else 80)
    except (ValueError, TypeError, UnicodeError) as error:
        raise WebImportError("unsupported_url") from error


def public_address(value):
    address = ipaddress.ip_address(value.split("%", 1)[0])
    mapped = getattr(address, "ipv4_mapped", None)
    address = mapped or address
    return address.is_global and not address.is_multicast


def resolve_public(host, port):
    try:
        records = socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)
    except OSError as error:
        raise WebImportError("fetch_failed", technical_reason(error), host) from error
    if not records:
        raise WebImportError("fetch_failed", "DNS no addresses", host)
    if any(not public_address(record[4][0]) for record in records):
        raise WebImportError("blocked_host", "DNS non-public address", host)
    return sorted(records, key=lambda record: record[0] != socket.AF_INET)


class PinnedConnection(http.client.HTTPConnection):
    def __init__(self, host, port, record, secure, timeout):
        super().__init__(host, port, timeout=timeout)
        self.record, self.secure = record, secure

    def connect(self):
        family, socktype, protocol, _, address = self.record
        raw = socket.socket(family, socktype, protocol)
        deadline = time.monotonic() + self.timeout
        try:
            raw.settimeout(self.timeout)
            raw.connect(address)
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise TimeoutError
            raw.settimeout(remaining)
            self.sock = (
                ssl.create_default_context().wrap_socket(raw, server_hostname=self.host)
                if self.secure
                else raw
            )
        except BaseException:
            raw.close()
            raise


def connect_public(host, port, records, secure, deadline):
    last_error = None
    for index, record in enumerate(records):
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise WebImportError("timeout", "connection deadline", host)
        # Leave time for subsequent addresses when one route blackholes packets.
        connection = PinnedConnection(
            host, port, record, secure, remaining / (len(records) - index)
        )
        try:
            connection.connect()
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise WebImportError("timeout", "connection deadline", host)
            connection.timeout = remaining
            connection.sock.settimeout(remaining)
            return connection
        except (OSError, http.client.HTTPException) as error:
            last_error = error
            connection.close()
        except BaseException:
            connection.close()
            raise
    code = "timeout" if time.monotonic() >= deadline else "fetch_failed"
    raise WebImportError(
        code, technical_reason(last_error) if last_error else "DNS no addresses", host
    ) from last_error


def download(url, limit, timeout, image=False):
    deadline = time.monotonic() + timeout
    for redirects in range(6):
        parts, host, port = parse_url(url)
        records = resolve_public(host, port)
        connection = connect_public(host, port, records, parts.scheme == "https", deadline)
        try:
            target = quote(parts.path or "/", safe="/%:@!$&'()*+,;=-._~")
            if parts.query:
                target += "?" + quote(parts.query, safe="%/?@:!$&'()*+,;=-._~")
            connection.request(
                "GET",
                target,
                headers={
                    "User-Agent": "PlanerPrzepisow/1.0 (recipe importer)",
                    "Accept": "image/*" if image else "text/html,application/xhtml+xml",
                    "Accept-Encoding": "identity",
                },
            )
            response = connection.getresponse()
            if response.status in (301, 302, 303, 307, 308):
                location = response.getheader("Location")
                if not location or redirects == 5:
                    raise WebImportError("fetch_failed", "redirect limit or missing Location", host)
                url = urljoin(url, location)
                continue
            encoding = response.getheader("Content-Encoding", "identity").lower()
            if response.status != 200 or encoding != "identity":
                raise WebImportError(
                    "fetch_failed",
                    f"HTTP {response.status} Content-Encoding={header_reason(encoding)}",
                    host,
                )
            mime = response.getheader("Content-Type", "").split(";", 1)[0].strip().lower()
            if not image and mime not in ("text/html", "application/xhtml+xml"):
                raise WebImportError("fetch_failed", f"Content-Type={header_reason(mime)}", host)
            length = response.getheader("Content-Length")
            if length and int(length) > limit:
                raise WebImportError("too_large", "response size limit", host)
            chunks, size = [], 0
            while True:
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    raise WebImportError("timeout")
                if connection.sock:
                    connection.sock.settimeout(remaining)
                chunk = response.read(min(64 * 1024, limit + 1 - size))
                if not chunk:
                    break
                chunks.append(chunk)
                size += len(chunk)
                if size > limit:
                    raise WebImportError("too_large", "response size limit", host)
            data = b"".join(chunks)
            if image:
                if data.startswith(b"\xff\xd8\xff"):
                    mime = "image/jpeg"
                elif data.startswith(b"\x89PNG\r\n\x1a\n"):
                    mime = "image/png"
                elif data.startswith((b"GIF87a", b"GIF89a")):
                    mime = "image/gif"
                elif data.startswith(b"RIFF") and data[8:12] == b"WEBP":
                    mime = "image/webp"
                else:
                    raise WebImportError("fetch_failed")
                return {"data": base64.b64encode(data).decode("ascii"), "mime": mime}
            charset = response.headers.get_content_charset() or "utf-8"
            try:
                html = data.decode(charset, errors="replace")
            except LookupError:
                html = data.decode("utf-8", errors="replace")
            return {"html": html, "source_url": url, "source_host": host}
        except WebImportError as error:
            error.host = error.host or host
            raise
        except TimeoutError as error:
            raise WebImportError("timeout", technical_reason(error), host) from error
        except (OSError, ValueError, http.client.HTTPException) as error:
            raise WebImportError("fetch_failed", technical_reason(error), host) from error
        finally:
            connection.close()
    raise WebImportError("fetch_failed")


def fetch_resource(url, timeout=15, limit=3 * 1024**2, image=False):
    try:
        parse_url(url)
        result = subprocess.run(
            [sys.executable, "-m", "app.importers.web.fetch"],
            input=json.dumps({"url": url, "timeout": timeout, "limit": limit, "image": image}),
            text=True,
            capture_output=True,
            timeout=timeout,
            check=False,
        )
        if result.returncode:
            raise WebImportError("fetch_failed", f"worker exit={result.returncode}")
        payload = json.loads(result.stdout)
        if "error" in payload:
            raise WebImportError(payload["error"], payload.get("reason"), payload.get("host"))
        return payload
    except WebImportError as error:
        log_failure(error, url)
        raise
    except (subprocess.TimeoutExpired, OSError, ValueError) as error:
        failure = WebImportError(
            "timeout" if isinstance(error, subprocess.TimeoutExpired) else "fetch_failed",
            technical_reason(error),
        )
        log_failure(failure, url)
        raise failure from error


if __name__ == "__main__":
    try:
        arguments = json.load(sys.stdin)
        output = download(**arguments)
    except WebImportError as error:
        output = {"error": error.code, "reason": error.reason, "host": error.host}
    except (OSError, ValueError, http.client.HTTPException) as error:
        output = {
            "error": "timeout" if isinstance(error, TimeoutError) else "fetch_failed",
            "reason": technical_reason(error),
        }
    print(json.dumps(output, ensure_ascii=False))
