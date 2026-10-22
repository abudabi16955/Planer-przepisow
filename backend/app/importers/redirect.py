"""Resolve Facebook short links in a bounded subprocess, checking every redirect."""

import json
import sys
from urllib.request import HTTPRedirectHandler, Request, build_opener

from app.importers.base import ImportError, platform_for_url


class AllowedRedirects(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        if platform_for_url(newurl) != platform_for_url(req.full_url):
            raise ImportError("unsupported_url")
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def resolve(url, timeout):
    platform_for_url(url)
    with build_opener(AllowedRedirects()).open(
        Request(url, method="HEAD", headers={"User-Agent": "Mozilla/5.0"}), timeout=timeout
    ) as response:
        resolved = response.geturl()
        platform_for_url(resolved)
        return resolved


if __name__ == "__main__":
    print(json.dumps(resolve(sys.argv[1], float(sys.argv[2]))))
