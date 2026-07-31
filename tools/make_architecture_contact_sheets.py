from pathlib import Path
from PIL import Image, ImageDraw
import argparse
import json
import re


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = ROOT / ".qa" / "architecture_render"
DEFAULT_OUTPUT = ROOT / ".qa" / "architecture_contacts"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build QA contact sheets from rendered document pages.")
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    return parser.parse_args()


def content_bbox(image: Image.Image, threshold: int = 245):
    gray = image.convert("L")
    mask = gray.point(lambda value: 255 if value < threshold else 0)
    return mask.getbbox()


def main() -> None:
    args = parse_args()
    source = args.source.resolve()
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    pages = sorted(source.glob("page*.png"))
    if not pages:
        raise SystemExit("No rendered architecture pages found")
    first = Image.open(pages[0]).convert("RGB")
    width, height = first.size
    thumb_w = width // 2
    thumb_h = height // 2
    label_h = 28
    reports = []

    for page_path in pages:
        image = Image.open(page_path).convert("RGB")
        bbox = content_bbox(image)
        margins = None
        if bbox:
            left, top, right, bottom = bbox
            margins = {
                "left": left,
                "top": top,
                "right": width - right,
                "bottom": height - bottom,
            }
        reports.append({"page": int(re.search(r"(\d+)", page_path.stem).group(1)), "bbox": bbox, "margins": margins})

    per_sheet = 8
    for sheet_index, offset in enumerate(range(0, len(pages), per_sheet), 1):
        sheet = Image.new("RGB", (thumb_w * 2, (thumb_h + label_h) * 4), "#D9DEE4")
        draw = ImageDraw.Draw(sheet)
        for slot, page_path in enumerate(pages[offset : offset + per_sheet]):
            page_number = offset + slot + 1
            x = (slot % 2) * thumb_w
            y = (slot // 2) * (thumb_h + label_h)
            page = Image.open(page_path).convert("RGB").resize((thumb_w, thumb_h), Image.Resampling.LANCZOS)
            sheet.paste(page, (x, y + label_h))
            draw.rectangle((x, y, x + thumb_w, y + label_h), fill="#0B2545")
            draw.text((x + 10, y + 7), f"PAGE {page_number}", fill="white")
        sheet.save(output / f"contact_{sheet_index:02d}.png", optimize=True)

    suspicious = [r for r in reports if r["margins"] is None or min(r["margins"].values()) < 12]
    (output / "bbox_report.json").write_text(
        json.dumps({"pageSize": [width, height], "pages": reports, "suspicious": suspicious}, indent=2),
        encoding="utf-8",
    )
    print(f"Pages={len(pages)} Contacts={(len(pages) + per_sheet - 1) // per_sheet} Suspicious={len(suspicious)}")


if __name__ == "__main__":
    main()
