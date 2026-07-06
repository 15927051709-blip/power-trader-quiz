#!/usr/bin/env python3
"""Extract the exam question bank into a browser-friendly JS data file."""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

from openpyxl import load_workbook


SOURCE = Path(
    "/Users/higher/Library/CloudStorage/OneDrive-个人/02个人文档资料/01学习资料/"
    "交易员考试/交易员考试/电力交易员（高级工）题库.xlsx"
)
OUTPUT = Path(__file__).resolve().parents[1] / "data" / "questions.js"
LETTERS = "ABCDEFGHIJ"


def clean(value: object) -> str:
    if value is None:
        return ""
    return str(value).strip()


def normalize_answer(value: object, qtype: str) -> list[str]:
    text = clean(value)
    if qtype == "判断":
        return [text]
    return [letter for letter in LETTERS if letter in text.upper()]


def extract() -> dict[str, object]:
    workbook = load_workbook(SOURCE, read_only=True, data_only=True)
    questions: list[dict[str, object]] = []

    for sheet in workbook.worksheets:
        for row_number, row in enumerate(sheet.iter_rows(min_row=2, values_only=True), start=2):
            stem = clean(row[0] if len(row) > 0 else "")
            qtype = clean(row[1] if len(row) > 1 else "")
            answer = clean(row[2] if len(row) > 2 else "")
            if not stem or not qtype or not answer:
                continue

            options = []
            if qtype in {"单选", "多选"}:
                for idx, value in enumerate(row[3:13]):
                    label = LETTERS[idx]
                    text = clean(value)
                    if text:
                        options.append({"label": label, "text": text})
            elif qtype == "判断":
                options = [{"label": "对", "text": "对"}, {"label": "错", "text": "错"}]

            questions.append(
                {
                    "id": f"{sheet.title}-{row_number}",
                    "source": sheet.title,
                    "type": qtype,
                    "stem": stem,
                    "options": options,
                    "answer": normalize_answer(answer, qtype),
                }
            )

    by_type: dict[str, int] = {}
    for question in questions:
        qtype = str(question["type"])
        by_type[qtype] = by_type.get(qtype, 0) + 1

    return {
        "meta": {
            "title": "电力交易员（高级工）题库",
            "sourceFile": SOURCE.name,
            "generatedAt": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "total": len(questions),
            "byType": by_type,
        },
        "questions": questions,
    }


def main() -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    data = extract()
    payload = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    OUTPUT.write_text(f"window.QUESTION_BANK = {payload};\n", encoding="utf-8")
    meta = data["meta"]
    print(f"Wrote {OUTPUT}")
    print(f"Total: {meta['total']} | By type: {meta['byType']}")


if __name__ == "__main__":
    main()
