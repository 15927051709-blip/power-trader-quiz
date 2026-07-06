#!/usr/bin/env python3
"""Build a single-file HTML version for personal offline use."""

from __future__ import annotations

import base64
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "index.html"
QUESTIONS = ROOT / "data" / "questions.js"
ICON = ROOT / "icon.svg"
OUTPUT = ROOT / "dist" / "电力交易员高级工技师刷题_单文件版_v2.html"


def main() -> None:
    html = INDEX.read_text(encoding="utf-8")
    questions = QUESTIONS.read_text(encoding="utf-8").strip()
    icon = ICON.read_text(encoding="utf-8")
    icon_data = "data:image/svg+xml;base64," + base64.b64encode(icon.encode("utf-8")).decode("ascii")

    html = html.replace('  <link rel="manifest" href="manifest.webmanifest">\n', "")
    html = html.replace('<link rel="icon" href="icon.svg" type="image/svg+xml">', f'<link rel="icon" href="{icon_data}" type="image/svg+xml">')
    html = html.replace('<img src="icon.svg" alt="">', f'<img src="{icon_data}" alt="">')
    html = html.replace('  <script src="data/questions.js"></script>', f"  <script>\n    {questions}\n  </script>")

    service_worker_block = """\n    if ("serviceWorker" in navigator) {\n      navigator.serviceWorker.register("./service-worker.js").catch(() => {\n        els.offlineText.textContent = "离线缓存未启用";\n      });\n    }\n"""
    html = html.replace(service_worker_block, "\n")
    html = html.replace("离线可用</span>", "单文件版</span>")

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(html, encoding="utf-8")
    print(f"Wrote {OUTPUT}")


if __name__ == "__main__":
    main()
