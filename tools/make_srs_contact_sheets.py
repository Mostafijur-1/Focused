from __future__ import annotations

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageStat
import json
import re


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / ".qa" / "srs_render2"
OUTPUT = ROOT / ".qa" / "srs_contacts2"


def content_bbox(image: Image.Image, threshold: int = 245):
    gray = image.convert("L")
    mask = gray.point(lambda value: 255 if value < threshold else 0)
    return mask.getbbox()


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    pages = sorted(SOURCE.glob("page*.png"))
    if len(pages) != 130:
        raise SystemExit(f"Expected 130 pages, found {len(pages)}")
    first = Image.open(pages[0]).convert("RGB")
    width, height = first.size
    label_h = 34
    reports = []
    for page_path in pages:
        image = Image.open(page_path).convert("RGB")
        bbox = content_bbox(image)
        if bbox is None:
            margins = None
        else:
            left, top, right, bottom = bbox
            margins = {"left": left, "top": top, "right": width - right, "bottom": height - bottom}
        reports.append({"page": int(re.search(r"(\d+)", page_path.stem).group(1)), "bbox": bbox, "margins": margins})

    for sheet_idx, offset in enumerate(range(0, len(pages), 4), 1):
        sheet = Image.new("RGB", (width * 2, (height + label_h) * 2), "#D9DEE4")
        draw = ImageDraw.Draw(sheet)
        for slot, page_path in enumerate(pages[offset:offset + 4]):
            page_no = offset + slot + 1
            x = (slot % 2) * width
            y = (slot // 2) * (height + label_h)
            page = Image.open(page_path).convert("RGB")
            sheet.paste(page, (x, y + label_h))
            draw.rectangle((x, y, x + width, y + label_h), fill="#0B2545")
            draw.text((x + 12, y + 8), f"PAGE {page_no}", fill="white")
        sheet.save(OUTPUT / f"contact_{sheet_idx:02d}_pages_{offset+1:03d}-{min(offset+4, len(pages)):03d}.png", optimize=True)

    suspicious = [
        report for report in reports
        if report["margins"] is None
        or min(report["margins"].values()) < 15
    ]
    (OUTPUT / "bbox_report.json").write_text(json.dumps({"page_size": [width, height], "pages": reports, "suspicious": suspicious}, indent=2), encoding="utf-8")
    print(f"Pages={len(pages)} Size={width}x{height} ContactSheets={(len(pages)+3)//4} Suspicious={len(suspicious)}")
    if suspicious:
        print(json.dumps(suspicious, indent=2))


if __name__ == "__main__":
    main()
