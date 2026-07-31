from __future__ import annotations

from collections import Counter, defaultdict
from pathlib import Path
from xml.etree import ElementTree as ET
import re
import sys
import zipfile


ROOT = Path(__file__).resolve().parents[1]
MD = ROOT / "docs" / "Focused_Software_Requirements_Specification.md"
DOCX = ROOT / "docs" / "Focused_Software_Requirements_Specification.docx"
W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"


def require(condition: bool, message: str, failures: list[str]) -> None:
    if not condition:
        failures.append(message)


def main() -> int:
    failures: list[str] = []
    text = MD.read_text(encoding="utf-8")

    feature_headers = re.findall(r"^### 6\.\d+\.\d+ .+ \[([A-Z0-9]+)\]$", text, re.MULTILINE)
    require(len(feature_headers) == 57, f"Expected 57 feature headers, found {len(feature_headers)}", failures)
    require(len(set(feature_headers)) == len(feature_headers), "Duplicate feature codes", failures)

    frs = re.findall(r"^- (FR-([A-Z0-9]+)-\d{3}) - The system shall", text, re.MULTILINE)
    acs = re.findall(r"^- (AC-([A-Z0-9]+)-\d{2}) - ", text, re.MULTILINE)
    fr_by_feature: dict[str, list[str]] = defaultdict(list)
    ac_by_feature: dict[str, list[str]] = defaultdict(list)
    for rid, code in frs:
        fr_by_feature[code].append(rid)
    for rid, code in acs:
        if code != "CROSS":
            ac_by_feature[code].append(rid)
    require(len(frs) == 171, f"Expected 171 feature requirements, found {len(frs)}", failures)
    cross_acs = re.findall(r"^\| (AC-CROSS-\d{2}) \|", text, re.MULTILINE)
    require(len(acs) == 342, f"Expected 342 feature acceptance criteria, found {len(acs)}", failures)
    require(len(cross_acs) == 10, f"Expected 10 cross-cutting acceptance criteria, found {len(cross_acs)}", failures)
    require(len({rid for rid, _ in frs}) == len(frs), "Duplicate functional requirement IDs", failures)
    require(len({rid for rid, _ in acs}) == len(acs), "Duplicate acceptance criterion IDs", failures)
    for code in feature_headers:
        require(len(fr_by_feature[code]) == 3, f"{code}: expected 3 FRs", failures)
        require(len(ac_by_feature[code]) == 6, f"{code}: expected 6 ACs", failures)

    brs = re.findall(r"^\| (BR-\d{2}) \|", text, re.MULTILINE)
    nfrs = re.findall(r"^\| (NFR-[A-Z]+-\d{2}) \|", text, re.MULTILINE)
    require(len(set(brs)) == 50, f"Expected 50 unique business rules, found {len(set(brs))}", failures)
    require(len(nfrs) == len(set(nfrs)), "Duplicate NFR IDs", failures)
    require(len(set(nfrs)) >= 70, f"Expected at least 70 NFRs, found {len(set(nfrs))}", failures)

    headings = [(len(m.group(1)), m.group(2)) for m in re.finditer(r"^(#{1,6}) (.+)$", text, re.MULTILINE)]
    for (prev_level, prev), (level, heading) in zip(headings, headings[1:]):
        require(level <= prev_level + 1, f"Heading level skipped from {prev!r} to {heading!r}", failures)

    with zipfile.ZipFile(DOCX) as archive:
        required_parts = {
            "[Content_Types].xml", "_rels/.rels", "word/document.xml", "word/styles.xml",
            "word/numbering.xml", "word/settings.xml", "word/header1.xml", "word/footer1.xml",
            "docProps/core.xml", "docProps/app.xml",
        }
        require(required_parts.issubset(set(archive.namelist())), "DOCX is missing required OOXML parts", failures)
        root = ET.fromstring(archive.read("word/document.xml"))
        styles = ET.fromstring(archive.read("word/styles.xml"))
        numbering = ET.fromstring(archive.read("word/numbering.xml"))

    style_ids = {node.attrib.get(W + "styleId") for node in styles.findall(W + "style")}
    require({"Normal", "Title", "Subtitle", "Heading1", "Heading2", "Heading3", "ListParagraph", "TableHeader", "TableText"}.issubset(style_ids), "Required real styles missing", failures)
    require(len(numbering.findall(W + "num")) >= 2, "Real bullet and decimal numbering definitions missing", failures)

    tables = root.findall(".//" + W + "tbl")
    require(len(tables) >= 15, f"Expected substantive tables, found {len(tables)}", failures)
    for idx, table in enumerate(tables, 1):
        grid = [int(c.attrib[W + "w"]) for c in table.findall("./" + W + "tblGrid/" + W + "gridCol")]
        require(sum(grid) == 9360, f"Table {idx}: grid width {sum(grid)} != 9360", failures)
        tbl_w = table.find("./" + W + "tblPr/" + W + "tblW")
        tbl_ind = table.find("./" + W + "tblPr/" + W + "tblInd")
        require(tbl_w is not None and tbl_w.attrib.get(W + "w") == "9360", f"Table {idx}: tblW mismatch", failures)
        require(tbl_ind is not None and tbl_ind.attrib.get(W + "w") == "120", f"Table {idx}: tblInd mismatch", failures)
        rows = table.findall("./" + W + "tr")
        require(bool(rows) and rows[0].find("./" + W + "trPr/" + W + "tblHeader") is not None, f"Table {idx}: accessible repeating header missing", failures)
        for ridx, row in enumerate(rows, 1):
            cell_widths = []
            for cell in row.findall("./" + W + "tc"):
                tcw = cell.find("./" + W + "tcPr/" + W + "tcW")
                if tcw is not None:
                    cell_widths.append(int(tcw.attrib[W + "w"]))
            require(cell_widths == grid, f"Table {idx} row {ridx}: cell widths do not match grid", failures)

    doc_text = "".join(node.text or "" for node in root.iter(W + "t"))
    require("{{" not in doc_text and "}}" not in doc_text, "Template placeholder found", failures)
    require(":codex" not in doc_text, "Internal citation token found", failures)
    require(len(doc_text) >= 240000, "DOCX text unexpectedly short", failures)

    if failures:
        print("SRS AUDIT FAILED")
        for failure in failures:
            print("-", failure)
        return 1
    print("SRS AUDIT PASSED")
    print(f"Features={len(feature_headers)} FRs={len(frs)} FeatureACs={len(acs)} CrossACs={len(cross_acs)} BRs={len(set(brs))} NFRs={len(set(nfrs))} Tables={len(tables)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
