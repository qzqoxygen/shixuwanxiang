"""Check source availability without treating an HTTP success as editorial verification."""

import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
from html.parser import HTMLParser
from urllib.error import HTTPError
from urllib.request import build_opener, ProxyHandler, Request


class PageText(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts, self.title = [], []
        self.hidden = 0
        self.in_title = False

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style"):
            self.hidden += 1
        if tag == "title":
            self.in_title = True

    def handle_endtag(self, tag):
        if tag in ("script", "style"):
            self.hidden = max(0, self.hidden - 1)
        if tag == "title":
            self.in_title = False

    def handle_data(self, data):
        if not self.hidden:
            self.parts.append(data)
            if self.in_title:
                self.title.append(data)


def check(source):
    opener = build_opener(ProxyHandler({}))
    result = dict(source)
    try:
        with opener.open(Request(source["url"], headers={"User-Agent": "Mozilla/5.0"}), timeout=18) as response:
            body = response.read(4_000_000)
            declared = re.search(br'charset\s*=\s*["\x27]?([a-zA-Z0-9_-]+)', body[:8192])
            encoding = declared.group(1).decode() if declared else response.headers.get_content_charset() or "utf-8"
            if encoding.lower() in ("gb2312", "gbk"):
                encoding = "gb18030"
            soup = PageText()
            soup.feed(body.decode(encoding, errors="replace"))
            text = re.sub(r"\s+", " ", " ".join(soup.parts))
        result.update(status=response.status, finalUrl=response.url,
                      pageTitle="".join(soup.title).strip(),
                      textLength=len(text), bodySha256=hashlib.sha256(body).hexdigest(),
                      termPresent=source.get("term", "") in text,
                      # These are pointers for human review, not proof of every claim.
                      matchedTerms=[word for word in source.get("keywords", []) if word in text])
        if response.status == 200 and len(text) > 100:
            result["availability"] = "readable"
        else:
            result["availability"] = "needs-review"
    except (OSError, ValueError, LookupError) as error:
        result.update(availability="unavailable", errorType=type(error).__name__)
        if isinstance(error, HTTPError):
            result["status"] = error.code
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    archive = json.loads((root / "docs/cultural-sources/2026-11-12/intake.json").read_text(encoding="utf-8"))
    cases = json.loads((root / "data/cultural-cases/cases.json").read_text(encoding="utf-8"))
    sources = {}
    for row in archive["sheets"]["补采案例"][2:]:
        if not isinstance(row[0], int):
            continue
        sources[row[11]] = {"url": row[11], "supplementSerial": row[0], "caseTitle": row[2],
                            "term": row[1], "keywords": [x for x in re.findall(r"[\u4e00-\u9fff]{2,}", row[2]) if len(x) <= 10]}
    for case in cases:
        for source in case["sources"]:
            sources.setdefault(source["url"], {"url": source["url"], "caseTitle": case["title"]})
    with ThreadPoolExecutor(max_workers=8) as executor:
        results = list(executor.map(check, sources.values()))
    payload = {"checkedAt": datetime.now(timezone.utc).isoformat(), "method": "Direct HTTPS/HTTP GET, normal TLS verification, no proxy; availability is not content verification", "sources": results}
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"total": len(results), "readable": sum(x["availability"] == "readable" for x in results),
                      "issues": [{"url": x["url"], "status": x.get("status"), "errorType": x.get("errorType")} for x in results if x["availability"] != "readable"]}, ensure_ascii=False))
