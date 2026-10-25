"""Bounded, cookie-free HTTP transport. DNS answers are pinned to the connection."""

import base64
import http.client
import ipaddress
import json
import socket
import ssl
import subprocess
import sys
import time
from urllib.parse import quote, urljoin, urlsplit


class WebImportError(Exception):
    def __init__(self, code):
        self.code = code
        super().__init__(code)


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
        raise WebImportError("fetch_failed") from error
    if not records:
        raise WebImportError("fetch_failed")
    if any(not public_address(record[4][0]) for record in records):
        raise WebImportError("blocked_host")
    return records[0]


class PinnedConnection(http.client.HTTPConnection):
    def __init__(self, host, port, record, secure, timeout):
        super().__init__(host, port, timeout=timeout)
        self.record, self.secure = record, secure

    def connect(self):
        family, socktype, protocol, _, address = self.record
        raw = socket.socket(family, socktype, protocol)
        try:
            raw.settimeout(self.timeout)
            raw.connect(address)
            self.sock = (
                ssl.create_default_context().wrap_socket(raw, server_hostname=self.host)
                if self.secure
                else raw
            )
        except BaseException:
            raw.close()
            raise


def download(url, limit, timeout, image=False):
    deadline = time.monotonic() + timeout
    for redirects in range(6):
        parts, host, port = parse_url(url)
        record = resolve_public(host, port)
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise WebImportError("timeout")
        connection = PinnedConnection(host, port, record, parts.scheme == "https", remaining)
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
                    raise WebImportError("fetch_failed")
                url = urljoin(url, location)
                continue
            if (
                response.status != 200
                or response.getheader("Content-Encoding", "identity").lower() != "identity"
            ):
                raise WebImportError("fetch_failed")
            mime = response.getheader("Content-Type", "").split(";", 1)[0].strip().lower()
            if not image and mime not in ("text/html", "application/xhtml+xml"):
                raise WebImportError("fetch_failed")
            length = response.getheader("Content-Length")
            if length and int(length) > limit:
                raise WebImportError("too_large")
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
                    raise WebImportError("too_large")
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
        finally:
            connection.close()
    raise WebImportError("fetch_failed")


def fetch_resource(url, timeout=15, limit=3 * 1024**2, image=False):
    parse_url(url)
    try:
        result = subprocess.run(
            [sys.executable, "-m", "app.importers.web.fetch"],
            input=json.dumps({"url": url, "timeout": timeout, "limit": limit, "image": image}),
            text=True,
            capture_output=True,
            timeout=timeout,
            check=False,
        )
        if result.returncode:
            raise WebImportError("fetch_failed")
        payload = json.loads(result.stdout)
        if "error" in payload:
            raise WebImportError(payload["error"])
        return payload
    except subprocess.TimeoutExpired as error:
        raise WebImportError("timeout") from error
    except (OSError, ValueError) as error:
        raise WebImportError("fetch_failed") from error


if __name__ == "__main__":
    try:
        arguments = json.load(sys.stdin)
        output = download(**arguments)
    except WebImportError as error:
        output = {"error": error.code}
    except TimeoutError:
        output = {"error": "timeout"}
    except (OSError, ValueError, http.client.HTTPException):
        output = {"error": "fetch_failed"}
    print(json.dumps(output, ensure_ascii=False))
