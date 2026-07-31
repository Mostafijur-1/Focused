from __future__ import annotations

import argparse
import sys
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Render PDF pages to PNG files.")
    parser.add_argument("input_pdf", type=Path)
    parser.add_argument("output_dir", type=Path)
    parser.add_argument("--deps-dir", type=Path)
    parser.add_argument("--scale", type=float, default=2.0)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if args.deps_dir:
        sys.path.insert(0, str(args.deps_dir.resolve()))

    import pypdfium2 as pdfium

    args.output_dir.mkdir(parents=True, exist_ok=True)
    pdf = pdfium.PdfDocument(str(args.input_pdf.resolve()))
    page_count = len(pdf)
    for index in range(page_count):
        page = pdf[index]
        bitmap = page.render(scale=args.scale)
        image = bitmap.to_pil()
        image.save(args.output_dir / f"page{index + 1:02d}.png")
        page.close()
    pdf.close()
    print(f"Rendered {page_count} pages to {args.output_dir}")


if __name__ == "__main__":
    main()
