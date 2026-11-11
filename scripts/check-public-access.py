"""Direct HTTPS checks for the Shixu deployment. Python 3.9+, standard library.

Run on each real carrier connection with VPN and transparent tunnels disabled:
  python scripts/check-public-access.py --carrier telecom --output telecom.json
  python scripts/check-public-access.py --carrier unicom --output unicom.json
  python scripts/check-public-access.py --carrier mobile --output mobile.json
For a new project-owned deployment, add --host its.actual.dns.name.
"""

import argparse
from collections import Counter
from contextlib import closing
from datetime import datetime, timezone
from html.parser import HTMLParser
import http.client
import json
import os
from pathlib import Path
import platform
import socket
import ssl
from statistics import median
import sys
import time
from urllib.parse import urljoin, urlsplit


class PageAssets(HTMLParser):
    def __init__(self, host):
        super().__init__()
        self.host = host
        self.paths = {}
        self.external = 0

    def handle_starttag(self, tag, attributes):
        attrs = dict(attributes)
        if tag == "script":
            kind, raw = "js", attrs.get("src")
        elif tag == "link" and "stylesheet" in (attrs.get("rel") or "").lower().split():
            kind, raw = "css", attrs.get("href")
        else:
            return
        if raw:
            url = urlsplit(urljoin("https://" + self.host + "/", raw))
            if url.scheme == "https" and url.netloc.lower() == self.host:
                path = url.path + ("?" + url.query if url.query else "")
                self.paths[path] = kind
            else:
                self.external += 1


def utc():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def ms(start):
    return round((time.monotonic() - start) * 1000, 1)


def validate(kind, mime, body, host):
    if kind == "home":
        if "text/html" in mime and "时序万象".encode() in body:
            assets = PageAssets(host)
            assets.feed(body.decode("utf-8"))
            if {"css", "js"}.issubset(assets.paths.values()):
                return assets
    elif kind == "cases":
        if "application/json" in mime:
            data = json.loads(body)
            if (isinstance(data, dict) and data.get("version") == "1.0"
                    and isinstance(data.get("items"), list) and len(data["items"]) == 1
                    and isinstance(data["items"][0], dict)
                    and data["items"][0].get("verificationStatus") == "verified"):
                return
    elif kind == "font" and body.startswith(b"\x00\x01\x00\x00"):
        return
    elif kind == "image" and mime == "image/svg+xml" and b"<svg" in body[:1000]:
        return
    elif kind == "css" and "text/css" in mime and body.strip():
        return
    elif kind == "js" and "javascript" in mime and body.strip():
        return
    raise ValueError("unexpected content")


def fetch(host, path, kind, context, timeout):
    started = time.monotonic()
    # Only fixed query parameters and same-origin paths are requested. Omit any
    # discovered query values from evidence, e.g. Vercel deployment identifiers.
    row = {"kind": kind, "path": urlsplit(path).path, "status": None, "ms": {}}
    assets = None
    stage = "dns"
    since = started
    try:
        addresses = socket.getaddrinfo(host, 443, type=socket.SOCK_STREAM)
        row["ms"][stage] = ms(since)
        row["dns_families"] = dict(Counter(info[0].name for info in addresses))
        stage, since = "tcp", time.monotonic()
        for family, socktype, proto, _, address in addresses:
            sock = socket.socket(family, socktype, proto)
            try:
                sock.settimeout(timeout)
                sock.connect(address)
                break
            except OSError as exc:
                sock.close()
                last_error = exc
        else:
            raise last_error if addresses else OSError("no addresses")
        with sock:
            row["family"] = family.name
            row["ms"][stage] = ms(since)
            stage, since = "tls", time.monotonic()
            with context.wrap_socket(sock, server_hostname=host) as secure:
                row["tls_version"] = secure.version()
                row["ms"][stage] = ms(since)
                stage, since = "http", time.monotonic()
                with closing(http.client.HTTPConnection(host, 443, timeout=timeout)) as conn:
                    conn.sock = secure
                    conn.request("GET", path, headers={"Accept-Encoding": "identity", "Connection": "close"})
                    with conn.getresponse() as response:
                        row["status"] = response.status
                        row["ms"]["headers"] = ms(since)
                        if response.status != 200:
                            raise ValueError("unexpected status")
                        mime = response.getheader("Content-Type", "").split(";")[0].lower()
                        body = response.read(8 * 1024 * 1024 + 1)
                        if len(body) > 8 * 1024 * 1024:
                            raise ValueError("response too large")
                        length = response.getheader("Content-Length")
                        if length is not None and len(body) != int(length):
                            raise http.client.IncompleteRead(b"")
                        row["bytes"] = len(body)
                        row["ms"][stage] = ms(since)
            stage, since = "content", time.monotonic()
            assets = validate(kind, mime, body, host)
        row["ok"] = True
    except (OSError, ValueError, http.client.HTTPException) as exc:
        row.update(ok=False, failed_stage=stage, error=type(exc).__name__)
        if isinstance(exc, OSError):
            row["os_code"] = getattr(exc, "winerror", None) or exc.errno
        row["ms"][stage] = ms(since)
    row["ms"]["total"] = ms(started)
    return row, assets


def settings():
    info = {"environment_proxy_set": any(os.environ.get(k) for k in os.environ
                                         if k.upper() in ("HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY"))}
    if sys.platform == "win32":
        import winreg
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, r"Software\Microsoft\Windows\CurrentVersion\Internet Settings") as key:
            for name, field in (("ProxyEnable", "windows_user_proxy_enabled"), ("AutoConfigURL", "windows_user_pac_set")):
                try:
                    info[field] = bool(winreg.QueryValueEx(key, name)[0])
                except FileNotFoundError:
                    info[field] = False
    return info


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--host", default="qsxshixu-ai.vercel.app", help="DNS name of your HTTPS deployment")
    parser.add_argument("--carrier", choices=("telecom", "unicom", "mobile", "unknown"), default="unknown")
    parser.add_argument("--rounds", type=int, default=20)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    host = args.host.lower()
    if not host or any(c not in "abcdefghijklmnopqrstuvwxyz0123456789.-" for c in host) or args.rounds < 1:
        parser.error("provide a DNS hostname and a positive round count")
    context = ssl.create_default_context()
    report = {"started_utc": utc(), "host": host, "device_os": platform.system() + " " + platform.release(),
              "python": platform.python_version(), "carrier": args.carrier,
              "carrier_evidence": "unknown" if args.carrier == "unknown" else "operator self-report",
              "region_evidence": "unknown", "proxy_settings": settings(), "application_proxy_used": False,
              "transport": "OS DNS, direct TCP, TLS with system trust and hostname validation, HTTP/1.1",
              "socket_timeout_s": 5, "rounds": []}
    for index in range(1, args.rounds + 1):
        since = time.monotonic()
        sample = {"number": index, "utc": utc(), "checks": []}
        requests = [("home", "/"), ("cases", "/api/cultural-cases?limit=1"),
                    ("image", "/images/azure-landscape.svg"), ("font", "/fonts/ma-shan-zheng-headings.ttf")]
        for kind, path in requests:
            row, assets = fetch(host, path, kind, context, report["socket_timeout_s"])
            sample["checks"].append(row)
            if assets:
                requests.extend((kind, path) for path, kind in assets.paths.items())
                sample["html_dependencies"] = {"same_origin_css_js": len(assets.paths), "external_css_js_unfetched": assets.external}
        sample.setdefault("html_dependencies", "not discovered")
        sample["ok"] = all(row["ok"] for row in sample["checks"]) and (
            isinstance(sample["html_dependencies"], dict) and sample["html_dependencies"]["external_css_js_unfetched"] == 0)
        sample["total_ms"] = ms(since)
        report["rounds"].append(sample)
        print(f"Round {index}/{args.rounds}: {'PASS' if sample['ok'] else 'FAIL'} ({sample['total_ms']} ms)", flush=True)
        if index < args.rounds:
            time.sleep(1)
    rounds = report["rounds"]
    successes = [r for r in rounds if r["ok"]]
    report["ended_utc"] = utc()
    report["summary"] = {"successful_rounds": len(successes), "attempted_rounds": len(rounds),
                         "success_percent": round(len(successes) / len(rounds) * 100, 1),
                         "median_successful_round_ms": median(r["total_ms"] for r in successes) if successes else None,
                         "request_failures_by_stage": dict(Counter(row["failed_stage"] for sample in rounds
                                                                   for row in sample["checks"] if not row["ok"]))}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps(report["summary"]))
    return 0 if len(successes) == len(rounds) else 1


if __name__ == "__main__":
    sys.exit(main())
