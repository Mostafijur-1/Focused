from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from pathlib import Path
from typing import Iterable, Sequence
from xml.sax.saxutils import escape
import re
import zipfile


ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"
MD_PATH = DOCS / "Focused_Software_Requirements_Specification.md"
DOCX_PATH = DOCS / "Focused_Software_Requirements_Specification.docx"


def x(value: object) -> str:
    return escape(str(value), {'"': '&quot;'})


@dataclass
class Block:
    kind: str
    text: str = ""
    level: int = 0
    rows: list[list[str]] = field(default_factory=list)
    widths: list[int] = field(default_factory=list)


class Specification:
    def __init__(self) -> None:
        self.blocks: list[Block] = []
        self._numbering_id = 1

    def title(self, text: str) -> None:
        self.blocks.append(Block("title", text))

    def subtitle(self, text: str) -> None:
        self.blocks.append(Block("subtitle", text))

    def h(self, level: int, text: str) -> None:
        self.blocks.append(Block("heading", text, level))

    def p(self, text: str) -> None:
        self.blocks.append(Block("paragraph", text))

    def kv(self, label: str, value: str) -> None:
        self.blocks.append(Block("kv", f"{label}\t{value}"))

    def bullet(self, text: str) -> None:
        self.blocks.append(Block("bullet", text))

    def number(self, text: str) -> None:
        if not self.blocks or self.blocks[-1].kind != "number":
            self._numbering_id += 1
        self.blocks.append(Block("number", text, self._numbering_id))

    def table(self, headers: Sequence[str], rows: Iterable[Sequence[str]], widths: Sequence[int] | None = None) -> None:
        data = [list(headers)] + [list(row) for row in rows]
        self.blocks.append(Block("table", rows=data, widths=list(widths or [])))

    def pagebreak(self) -> None:
        self.blocks.append(Block("pagebreak"))

    def render_markdown(self) -> str:
        out: list[str] = []
        for block in self.blocks:
            if block.kind == "title":
                out.extend([f"# {block.text}", ""])
            elif block.kind == "subtitle":
                out.extend([f"*{block.text}*", ""])
            elif block.kind == "heading":
                out.extend([f"{'#' * block.level} {block.text}", ""])
            elif block.kind == "paragraph":
                out.extend([block.text, ""])
            elif block.kind == "kv":
                label, value = block.text.split("\t", 1)
                out.extend([f"**{label}.** {value}", ""])
            elif block.kind == "bullet":
                out.append(f"- {block.text}")
            elif block.kind == "number":
                out.append(f"1. {block.text}")
            elif block.kind == "table":
                headers, *rows = block.rows
                out.append("| " + " | ".join(headers) + " |")
                out.append("| " + " | ".join("---" for _ in headers) + " |")
                for row in rows:
                    out.append("| " + " | ".join(cell.replace("|", "\\|").replace("\n", "<br>") for cell in row) + " |")
                out.append("")
            elif block.kind == "pagebreak":
                out.extend(["---", ""])
        return "\n".join(out).rstrip() + "\n"


class OoxmlDocument:
    """Small deterministic OOXML writer; avoids ambient package dependencies."""

    def __init__(self) -> None:
        self.body: list[str] = []
        self.table_count = 0

    @staticmethod
    def _runs(text: str, *, bold_prefix: str | None = None, italic: bool = False) -> str:
        chunks: list[tuple[str, bool]] = []
        if bold_prefix and text.startswith(bold_prefix):
            chunks.append((bold_prefix, True))
            rest = text[len(bold_prefix):]
            if rest:
                chunks.append((rest, False))
        else:
            chunks.append((text, False))
        xml: list[str] = []
        for value, bold in chunks:
            preserve = ' xml:space="preserve"' if value[:1].isspace() or value[-1:].isspace() else ""
            rpr = []
            if bold:
                rpr.append("<w:b/>")
            if italic:
                rpr.append("<w:i/>")
            xml.append(f"<w:r><w:rPr>{''.join(rpr)}</w:rPr><w:t{preserve}>{x(value)}</w:t></w:r>")
        return "".join(xml)

    def paragraph(self, text: str, style: str = "Normal", *, num_id: int | None = None, keep_next: bool = False) -> None:
        ppr = [f'<w:pStyle w:val="{style}"/>']
        if num_id is not None:
            ppr.append(f'<w:numPr><w:ilvl w:val="0"/><w:numId w:val="{num_id}"/></w:numPr>')
        if keep_next:
            ppr.append("<w:keepNext/>")
        self.body.append(f"<w:p><w:pPr>{''.join(ppr)}</w:pPr>{self._runs(text)}</w:p>")

    def key_value(self, label: str, value: str) -> None:
        prefix = f"{label}. "
        self.body.append(
            f'<w:p><w:pPr><w:pStyle w:val="Normal"/><w:keepNext/></w:pPr>'
            f'{self._runs(prefix + value, bold_prefix=prefix)}</w:p>'
        )

    def pagebreak(self) -> None:
        self.body.append('<w:p><w:r><w:br w:type="page"/></w:r></w:p>')

    @staticmethod
    def _cell(text: str, width: int, *, header: bool = False) -> str:
        fill = '<w:shd w:val="clear" w:color="auto" w:fill="E8EEF5"/>' if header else ""
        tcpr = f'<w:tcW w:w="{width}" w:type="dxa"/>{fill}<w:vAlign w:val="center"/>'
        style = "TableHeader" if header else "TableText"
        runs = OoxmlDocument._runs(text)
        return f'<w:tc><w:tcPr>{tcpr}</w:tcPr><w:p><w:pPr><w:pStyle w:val="{style}"/></w:pPr>{runs}</w:p></w:tc>'

    def table(self, rows: list[list[str]], widths: list[int] | None = None) -> None:
        if not rows:
            return
        cols = len(rows[0])
        if not widths:
            base = 9360 // cols
            widths = [base] * cols
            widths[-1] += 9360 - sum(widths)
        if len(widths) != cols or sum(widths) != 9360:
            raise ValueError(f"Invalid table geometry: {widths}")
        grid = ''.join(f'<w:gridCol w:w="{w}"/>' for w in widths)
        borders = ''.join(
            f'<w:{side} w:val="single" w:sz="4" w:space="0" w:color="B8C4D1"/>'
            for side in ("top", "left", "bottom", "right", "insideH", "insideV")
        )
        tblpr = (
            '<w:tblW w:w="9360" w:type="dxa"/><w:tblInd w:w="120" w:type="dxa"/>'
            '<w:tblLayout w:type="fixed"/><w:tblBorders>' + borders + '</w:tblBorders>'
            '<w:tblCellMar><w:top w:w="100" w:type="dxa"/><w:left w:w="120" w:type="dxa"/>'
            '<w:bottom w:w="100" w:type="dxa"/><w:right w:w="120" w:type="dxa"/></w:tblCellMar>'
        )
        trs: list[str] = []
        for i, row in enumerate(rows):
            if len(row) != cols:
                raise ValueError("Inconsistent column count")
            trpr = '<w:tblHeader/><w:cantSplit/>' if i == 0 else '<w:cantSplit/>'
            cells = ''.join(self._cell(cell, width, header=i == 0) for cell, width in zip(row, widths))
            trs.append(f'<w:tr><w:trPr>{trpr}</w:trPr>{cells}</w:tr>')
        self.body.append(f'<w:tbl><w:tblPr>{tblpr}</w:tblPr><w:tblGrid>{grid}</w:tblGrid>{"".join(trs)}</w:tbl>')
        self.paragraph("", style="TableSpacer")

    def add_block(self, block: Block) -> None:
        if block.kind == "title":
            self.paragraph(block.text, "Title")
        elif block.kind == "subtitle":
            self.paragraph(block.text, "Subtitle")
        elif block.kind == "heading":
            self.paragraph(block.text, f"Heading{min(block.level, 3)}", keep_next=True)
        elif block.kind == "paragraph":
            self.paragraph(block.text)
        elif block.kind == "kv":
            label, value = block.text.split("\t", 1)
            self.key_value(label, value)
        elif block.kind == "bullet":
            self.paragraph(block.text, "ListParagraph", num_id=1)
        elif block.kind == "number":
            self.paragraph(block.text, "ListParagraph", num_id=block.level)
        elif block.kind == "table":
            self.table(block.rows, block.widths)
        elif block.kind == "pagebreak":
            self.pagebreak()

    def document_xml(self) -> str:
        sect = (
            '<w:sectPr><w:headerReference w:type="default" r:id="rId3"/>'
            '<w:footerReference w:type="default" r:id="rId4"/>'
            '<w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" '
            'w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/>'
            '<w:cols w:space="720"/><w:docGrid w:linePitch="360"/></w:sectPr>'
        )
        return (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" '
            'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
            f'<w:body>{"".join(self.body)}{sect}</w:body></w:document>'
        )


def styles_xml() -> str:
    return '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:color w:val="202A35"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="264" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:before="0" w:after="120" w:line="264" w:lineRule="auto"/></w:pPr><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:color w:val="202A35"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:qFormat/><w:pPr><w:spacing w:before="240" w:after="80"/><w:keepNext/></w:pPr><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:b/><w:sz w:val="54"/><w:szCs w:val="54"/><w:color w:val="0B2545"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:qFormat/><w:pPr><w:spacing w:before="0" w:after="280"/><w:keepNext/></w:pPr><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:i/><w:sz w:val="28"/><w:szCs w:val="28"/><w:color w:val="526270"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:keepLines/><w:spacing w:before="320" w:after="160"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="32"/><w:szCs w:val="32"/><w:color w:val="2E74B5"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:keepLines/><w:spacing w:before="240" w:after="120"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:sz w:val="26"/><w:szCs w:val="26"/><w:color w:val="2E74B5"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:keepLines/><w:spacing w:before="160" w:after="80"/><w:outlineLvl w:val="2"/></w:pPr><w:rPr><w:b/><w:sz w:val="24"/><w:szCs w:val="24"/><w:color w:val="1F4D78"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:after="160" w:line="280" w:lineRule="auto"/></w:pPr></w:style>
  <w:style w:type="paragraph" w:styleId="TableHeader"><w:name w:val="Table Header"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/></w:pPr><w:rPr><w:b/><w:sz w:val="18"/><w:szCs w:val="18"/><w:color w:val="0B2545"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="TableText"><w:name w:val="Table Text"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/></w:pPr><w:rPr><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="TableSpacer"><w:name w:val="Table Spacer"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="40" w:after="40"/></w:pPr><w:rPr><w:sz w:val="4"/><w:szCs w:val="4"/></w:rPr></w:style>
</w:styles>'''


def numbering_xml() -> str:
    decimal_instances = ''.join(
        f'<w:num w:numId="{num_id}"><w:abstractNumId w:val="2"/>'
        f'<w:lvlOverride w:ilvl="0"><w:startOverride w:val="1"/></w:lvlOverride></w:num>'
        for num_id in range(2, 65)
    )
    return f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:abstractNum w:abstractNumId="1"><w:multiLevelType w:val="singleLevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="&#x2022;"/><w:lvlJc w:val="left"/><w:pPr><w:tabs><w:tab w:val="num" w:pos="720"/></w:tabs><w:ind w:left="720" w:hanging="360"/><w:spacing w:after="160" w:line="280" w:lineRule="auto"/></w:pPr><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/></w:rPr></w:lvl></w:abstractNum>
  <w:abstractNum w:abstractNumId="2"><w:multiLevelType w:val="singleLevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/><w:lvlJc w:val="left"/><w:pPr><w:tabs><w:tab w:val="num" w:pos="720"/></w:tabs><w:ind w:left="720" w:hanging="360"/><w:spacing w:after="160" w:line="280" w:lineRule="auto"/></w:pPr></w:lvl></w:abstractNum>
  <w:num w:numId="1"><w:abstractNumId w:val="1"/></w:num>{decimal_instances}
</w:numbering>'''


def write_docx(spec: Specification, path: Path) -> None:
    ooxml = OoxmlDocument()
    for block in spec.blocks:
        ooxml.add_block(block)
    parts = {
        '[Content_Types].xml': '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/><Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>''',
        '_rels/.rels': '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>''',
        'word/document.xml': ooxml.document_xml(),
        'word/_rels/document.xml.rels': '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/><Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/><Relationship Id="rId5" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/></Relationships>''',
        'word/styles.xml': styles_xml(),
        'word/numbering.xml': numbering_xml(),
        'word/settings.xml': '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:zoom w:percent="100"/><w:updateFields w:val="true"/><w:compat/></w:settings>''',
        'word/header1.xml': '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:jc w:val="right"/><w:spacing w:after="0"/></w:pPr><w:r><w:rPr><w:color w:val="6A7682"/><w:sz w:val="16"/></w:rPr><w:t>FOCUSED | SOFTWARE REQUIREMENTS SPECIFICATION</w:t></w:r></w:p></w:hdr>''',
        'word/footer1.xml': '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:jc w:val="right"/><w:spacing w:before="0" w:after="0"/></w:pPr><w:r><w:rPr><w:color w:val="6A7682"/><w:sz w:val="16"/></w:rPr><w:t xml:space="preserve">Page </w:t></w:r><w:fldSimple w:instr=" PAGE "><w:r><w:rPr><w:color w:val="6A7682"/><w:sz w:val="16"/></w:rPr><w:t>1</w:t></w:r></w:fldSimple></w:p></w:ftr>''',
        'docProps/core.xml': f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>Focused Software Requirements Specification</dc:title><dc:subject>FocusOS product requirements</dc:subject><dc:creator>Focused Product and Engineering</dc:creator><cp:keywords>SRS, FocusOS, productivity, AI coach, requirements</cp:keywords><dc:description>IEEE-style software requirements baseline for Focused.</dc:description><dcterms:created xsi:type="dcterms:W3CDTF">{date.today().isoformat()}T00:00:00Z</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">{date.today().isoformat()}T00:00:00Z</dcterms:modified></cp:coreProperties>''',
        'docProps/app.xml': '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Focused SRS Builder</Application><AppVersion>1.0</AppVersion><Company>Focused</Company></Properties>''',
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as archive:
        for name, content in parts.items():
            archive.writestr(name, content.encode("utf-8"))


@dataclass(frozen=True)
class Feature:
    code: str
    name: str
    group: str
    priority: str
    purpose: str
    actors: str
    entities: str
    api: str
    actions: tuple[str, str, str]
    validation: str
    edge: str
    privacy: str


def F(code: str, name: str, group: str, priority: str, purpose: str, actors: str,
      entities: str, api: str, a1: str, a2: str, a3: str,
      validation: str, edge: str, privacy: str) -> Feature:
    return Feature(code, name, group, priority, purpose, actors, entities, api,
                   (a1, a2, a3), validation, edge, privacy)


FEATURES: list[Feature] = [
    F("AUTH", "Authentication and Account Security", "Foundation", "P0",
      "Establish a secure, portable identity and session boundary for web and future mobile clients.",
      "Visitor, Member, Administrator", "User, Identity, Session, Credential, RecoveryToken, Consent",
      "/auth/*; /users/me/sessions; /users/me/consents",
      "register and verify an account using an approved identity flow",
      "sign in, refresh, revoke, and enumerate active sessions without exposing credentials",
      "recover account access and enforce step-up authentication for sensitive operations",
      "Normalized unique email or provider subject; password policy where passwords are enabled; expiring single-use tokens; CSRF and replay protection.",
      "Duplicate identities, expired links, locked accounts, provider outage, stolen refresh token, clock skew, and deletion-pending accounts must fail safely.",
      "Credentials are never logged; tokens are hashed or encrypted as appropriate; security events are auditable; MFA is required for privileged roles."),
    F("ONB", "Onboarding", "Foundation", "P0",
      "Reach first value quickly while collecting only the preferences necessary to personalize Focused.",
      "Member", "OnboardingState, Preference, GoalSeed, SchedulePreference, Consent",
      "/onboarding; /users/me/preferences; /users/me/consents",
      "complete, skip, resume, and revise an accessible step-based onboarding flow",
      "select initial focus outcomes, preferred work pattern, time zone, locale, and optional tracker modules",
      "receive a generated first daily plan only after reviewing and confirming it",
      "Required fields are limited to account, time zone, and locale; optional sensitive questions are clearly labeled and separately consented.",
      "Refresh, cross-device continuation, revoked AI consent, unsupported locale, and abandoned flows preserve confirmed answers and never block core access.",
      "Sensitive answers are optional, purpose-limited, and excluded from marketing profiles."),
    F("DASH", "Dashboard", "Foundation", "P0",
      "Present the smallest actionable view of today, progress, and risks without becoming a distracting command center.",
      "Member", "DashboardSnapshot, WidgetPreference, DailyPlanSummary, AlertSummary",
      "/dashboard; /dashboard/widgets",
      "view today's top priorities, next focus block, key habits, and relevant reminders in one summary",
      "reorder, hide, and restore permitted dashboard widgets with preferences synchronized across devices",
      "take a primary action from a widget and see the affected summary update without a full-page reload",
      "Only supported widgets may be configured; stale aggregates disclose their as-of time; no widget may imply completion from missing data.",
      "New users, partial service failure, offline cached snapshot, time-zone rollover, and zero configured modules show purposeful states.",
      "The dashboard aggregates only data the member may access; private journal text is never surfaced by default."),
    F("PROF", "Profile", "Foundation", "P0",
      "Manage identity-facing information independently from behavioral preferences and private productivity data.",
      "Member, Administrator (limited support fields)", "UserProfile, Avatar, PublicName, TimeZone",
      "/users/me/profile; /admin/users/{id}/status",
      "view and update display name, avatar, time zone, week start, and permitted contact information",
      "preview how profile and time-zone changes affect date boundaries before confirmation",
      "request account download or deletion from the profile privacy controls",
      "Names and images must meet length, type, size, and safety constraints; canonical time-zone identifiers are required.",
      "Avatar processing failure, time-zone changes near midnight, pending deletion, and federated identity field restrictions are explained without data loss.",
      "Profiles are private by default; administrators cannot read private activity through profile permissions."),
    F("SET", "Settings", "Foundation", "P0",
      "Provide one discoverable control surface for behavior, privacy, appearance, integrations, and data lifecycle.",
      "Member", "Preference, PrivacySetting, IntegrationConnection, FeatureToggle",
      "/users/me/settings; /users/me/integrations; /users/me/consents",
      "search and modify categorized settings with immediate or explicitly deferred effect",
      "review and revoke integrations, AI data scopes, notification channels, and connected sessions",
      "restore documented defaults by category without resetting unrelated settings",
      "Settings use typed schemas, server validation, versioning, and optimistic concurrency to prevent silent overwrite.",
      "Conflicting edits, unsupported combinations, offline changes, policy-forced values, and retired settings return actionable explanations.",
      "Privacy-reducing changes require explicit confirmation; security-critical changes trigger re-authentication and audit events."),
    F("LANG", "Language and Localization", "Foundation", "P1",
      "Make core workflows usable across supported languages, locales, calendars, number formats, and text directions.",
      "Member, Content Curator", "LocalePreference, TranslationKey, TranslationBundle",
      "/locales; /users/me/locale; /admin/translations",
      "select a supported interface language independently from content and AI response language",
      "format dates, times, numbers, durations, and week boundaries using locale and user preferences",
      "fall back at the message-key level while reporting missing translations to maintainers",
      "Locale identifiers must be allow-listed BCP 47 tags; interpolation variables must be escaped and translation keys versioned.",
      "Mixed-script content, right-to-left layout, missing plural rules, stale bundles, and offline locale changes remain readable and reversible.",
      "Language choice is not used to infer religion, ethnicity, or location."),
    F("A11Y", "Accessibility Preferences", "Foundation", "P0",
      "Enable equitable use through standards-based defaults and user-controlled presentation and motion preferences.",
      "Member", "AccessibilityPreference",
      "/users/me/accessibility",
      "control reduced motion, contrast, text scaling, focus assistance, timer announcements, and notification modality",
      "apply preferences before interactive content is displayed to minimize flashes and layout shifts",
      "use all critical workflows with keyboard, screen reader, zoom, and non-color cues",
      "Preferences must remain within layouts tested at 200% text zoom and cannot suppress essential safety or security messages.",
      "OS preference changes, no-JavaScript fallbacks, zoom reflow, live-region conflicts, and unsupported browser features degrade gracefully.",
      "Accessibility preferences are private and must not be used for targeting or eligibility decisions."),

    F("DAILY", "Daily Focus", "Focus Execution", "P0",
      "Convert long-term intent into a realistic daily commitment and a clear next action.",
      "Member, AI Coach with consent", "DailyPlan, DailyPriority, CarryForwardDecision, CapacityEstimate",
      "/daily-plans/{date}; /daily-plans/{date}/priorities; /daily-plans/{date}/complete",
      "create a local-date plan with up to three primary priorities, supporting tasks, and an intentional-not-doing list",
      "estimate capacity, schedule focus blocks, and warn without blocking when planned effort exceeds available time",
      "complete, defer, cancel, or carry forward items while preserving the history and reason",
      "A single canonical plan exists per user and local date; durations are positive and bounded; carried items require an explicit decision.",
      "Travel across time zones, midnight rollover, duplicate submission, missed days, recurring tasks, and offline edits resolve deterministically.",
      "AI may propose but never silently add or complete commitments; private plan data stays user-scoped."),
    F("DEEP", "Deep Work Timer", "Focus Execution", "P0",
      "Support interruption-resistant focus sessions with explicit intent, recovery, and trustworthy time accounting.",
      "Member", "FocusSession, SessionPause, Interruption, SessionIntent, SessionOutcome",
      "/focus-sessions; /focus-sessions/{id}/pause; /resume; /complete; /interruptions",
      "start one active deep-work session with intent, planned duration, optional linked goal, and distraction controls",
      "pause, resume, extend, abandon, and complete the session through idempotent state transitions",
      "capture interruption category and outcome, then reconcile elapsed time from server timestamps after reconnect",
      "Only one active focus-mode session is allowed per user; transitions follow a finite-state model; elapsed time cannot be negative or exceed policy bounds.",
      "Closed tabs, device sleep, notification denial, concurrent devices, offline completion, clock drift, and app upgrades must not double-count time.",
      "Session intent is private; background controls require explicit OS/browser permission and cannot claim to block apps the platform cannot control."),
    F("POMO", "Pomodoro", "Focus Execution", "P0",
      "Offer configurable focus/break cycles without forcing one productivity method on every user.",
      "Member", "PomodoroPreset, PomodoroCycle, FocusSession",
      "/pomodoro/presets; /pomodoro/cycles; /focus-sessions",
      "configure validated focus, short-break, long-break, and cycle-count presets with sensible defaults",
      "run, pause, skip, and complete cycles while clearly distinguishing focus time from breaks",
      "optionally auto-start the next interval and notify only through consented channels",
      "Focus and break durations must fall within configurable safe bounds; auto-start defaults off; cycle transitions are idempotent.",
      "Background throttling, device sleep, muted audio, cross-device concurrency, early finish, and skipped breaks preserve correct cycle state.",
      "No punitive language or XP loss is applied for taking, extending, or skipping a break."),
    F("SMARTSCHED", "Smart Scheduling", "Planning", "P1",
      "Propose achievable time blocks using priorities, energy, constraints, and calendar availability while keeping the user in control.",
      "Member, AI Scheduling Service with consent", "ScheduleProposal, TimeBlock, Constraint, EnergyPreference",
      "/schedule/proposals; /schedule/time-blocks; /calendar/free-busy",
      "generate an explainable schedule proposal from selected tasks, constraints, working hours, and available calendar windows",
      "review, edit, partially accept, or reject proposed blocks before any calendar write occurs",
      "replan after a conflict or missed block while preserving locked events and user-defined buffers",
      "Time blocks must not overlap locked events or excluded hours; proposal inputs and time zone are versioned; calendar writes use idempotency keys.",
      "Daylight-saving changes, all-day events, external calendar changes, insufficient free time, provider outage, and travel produce conflict-aware alternatives.",
      "Calendar details are minimized before AI processing; proposals never imply the system has booked time until the user confirms and the provider acknowledges."),

    F("GOAL", "Goal Management", "Planning", "P0",
      "Turn outcomes into measurable, reviewable goals connected to plans and daily execution.",
      "Member, AI Coach with consent", "Goal, Milestone, KeyResult, GoalCheckIn, GoalLink",
      "/goals; /goals/{id}/milestones; /goals/{id}/check-ins",
      "create outcome-oriented goals with owner, horizon, success measure, status, and optional milestones",
      "link goals to vision areas, plans, tasks, habits, learning items, and focus sessions without duplicating source records",
      "check in, revise, pause, complete, abandon, and archive goals while retaining an auditable progress history",
      "Dates and measures must be coherent; progress is derived from declared measurement rules; completion requires explicit confirmation.",
      "Overdue milestones, changed targets, deleted links, duplicate goals, backdated check-ins, and archived dependencies preserve history and explain calculations.",
      "Goals are private by default; AI suggestions cannot change status or targets without approval."),
    F("VISION", "Life Vision", "Planning", "P1",
      "Help users articulate values, roles, desired futures, and boundaries that guide—not overwhelm—goal selection.",
      "Member, AI Coach with consent", "LifeVision, VisionArea, Value, VisionRevision",
      "/life-vision; /life-vision/revisions; /life-vision/areas",
      "create and revise private statements for values, roles, life areas, future narrative, and anti-goals",
      "review prior versions and intentionally connect selected vision areas to goals",
      "use optional guided prompts or AI reflection while retaining authorship and the ability to exclude any field",
      "Free text is length-bounded and autosaved as drafts; publishing a revision is explicit; blank or skipped areas are valid.",
      "Sensitive disclosures, abandoned drafts, AI refusal, version restore, and account export/deletion are handled without accidental exposure.",
      "Life-vision content receives the same protection as journal content and is excluded from model training and admin access by default."),
    F("WEEKPLAN", "Weekly Planning", "Planning", "P0",
      "Coordinate goals, commitments, capacity, and recovery across a user-defined week.",
      "Member, AI Coach with consent", "WeeklyPlan, WeeklyOutcome, CapacityBudget, WeeklyTheme",
      "/weekly-plans/{week}; /weekly-plans/{week}/outcomes; /weekly-plans/{week}/close",
      "create a plan for the user's week boundary with outcomes, capacity, constraints, and protected recovery time",
      "pull candidate items from active goals, backlog, habits, and calendar without auto-committing them",
      "close the week with completion, carry-forward, cancellation, and reflection decisions",
      "A user has one canonical weekly plan per configured week; capacity and planned duration are non-negative; carry-forward is explicit.",
      "Week-start changes, partial weeks, travel, holidays, overlapping monthly plans, duplicate close, and missed planning show deterministic outcomes.",
      "Suggestions respect consent and never penalize reduced capacity or rest."),
    F("MONTHPLAN", "Monthly Planning", "Planning", "P1",
      "Set a limited monthly direction and measurable outcomes while surfacing capacity and seasonal constraints.",
      "Member, AI Coach with consent", "MonthlyPlan, MonthlyOutcome, MonthlyTheme, CapacityBudget",
      "/monthly-plans/{month}; /monthly-plans/{month}/outcomes; /monthly-plans/{month}/close",
      "create a calendar-month plan with theme, outcomes, milestones, capacity budget, and explicit depriorities",
      "roll up relevant weekly plans and goal milestones without double-counting progress",
      "close and reflect on the month with evidence, lessons, and deliberate carry-forward decisions",
      "The plan is unique by user, calendar month, and time zone; outcome measures and capacity units must be declared.",
      "Time-zone changes, partial first month, reopened plans, deleted goals, and late check-ins recompute summaries transparently.",
      "Private reflections are not included in shared/exported summaries unless the member selects them."),
    F("YEARPLAN", "Yearly Planning", "Planning", "P1",
      "Translate life direction into a sustainable annual portfolio of themes and outcomes.",
      "Member, AI Coach with consent", "YearlyPlan, AnnualTheme, AnnualOutcome, QuarterMarker",
      "/yearly-plans/{year}; /yearly-plans/{year}/outcomes; /yearly-plans/{year}/review",
      "create an annual plan with themes, life-area balance, outcomes, quarter markers, and non-goals",
      "identify overcommitment across outcome count, estimated effort, and conflicting life areas",
      "review, revise, and close the year without rewriting historical snapshots",
      "One canonical plan exists per user and calendar year; revisions are versioned; archived outcomes remain reportable.",
      "Fiscal-year preference, leap year, mid-year adoption, changed vision, paused goals, and incomplete quarters remain coherent.",
      "The product avoids normative judgments about life-area balance and treats AI output as optional guidance."),
    F("CAL", "Calendar", "Planning", "P0",
      "Provide a unified, time-zone-correct view of Focused commitments and user-authorized external events.",
      "Member", "Calendar, CalendarConnection, Event, TimeBlock, SyncCursor",
      "/calendars; /calendar/events; /calendar/connections; /calendar/sync",
      "view day, week, and month representations with keyboard-accessible navigation and clear source labeling",
      "create, edit, move, and delete Focused-owned events and time blocks with recurrence support",
      "connect supported providers and synchronize only consented calendars using incremental, observable sync",
      "Events require valid start/end semantics, canonical time zone, recurrence limits, source ownership, and version tokens for updates.",
      "Daylight-saving transitions, recurring exceptions, all-day events, provider deletions, duplicate webhooks, sync lag, and revoked access are reconciled safely.",
      "External event titles/details are not exposed to AI or notifications beyond the member's selected scope."),

    F("HABIT", "Habit Tracker", "Tracking", "P0",
      "Support flexible behaviors with honest completion rules, recovery, and non-punitive trends.",
      "Member", "Habit, HabitSchedule, HabitEntry, HabitPause",
      "/habits; /habits/{id}/entries; /habits/{id}/pause",
      "create boolean, count, duration, or avoidance habits with schedule, target, unit, and start date",
      "record, edit, skip with reason, pause, resume, and backfill entries within policy",
      "show adherence trends and streaks based on the habit's own schedule and time zone",
      "Targets match the habit type; schedules are non-empty; entries are idempotent per habit and occurrence unless multiple entries are explicitly allowed.",
      "Schedule edits, vacations, illness pauses, daylight-saving changes, missed days, backfills, and deleted habits preserve historical interpretation.",
      "Health- or faith-related habits remain private; skipped days do not use shame-based language."),
    F("LEARN", "Learning Tracker", "Tracking", "P1",
      "Track deliberate learning across courses, skills, projects, practice, and evidence of mastery.",
      "Member, AI Mentor with consent", "LearningPath, LearningItem, StudySession, SkillEvidence",
      "/learning/paths; /learning/items; /learning/sessions; /learning/evidence",
      "create learning paths with desired skill, current level, resources, milestones, and success evidence",
      "log study time, practice type, notes, confidence, and completed learning items",
      "review progress by evidence and spaced check-ins rather than time spent alone",
      "Levels and confidence use declared scales; session duration is bounded; resource URLs are validated and normalized.",
      "Course abandonment, duplicate resources, changed target skill, offline sessions, imported history, and deleted evidence retain consistent totals.",
      "Learning data is not used to infer employment eligibility; AI mentor access is scope-based and revocable."),
    F("PROG", "Programming Progress", "Tracking", "P1",
      "Represent software-development growth through topics, projects, practice, and demonstrated outcomes.",
      "Member, AI Mentor with consent", "ProgrammingSkill, ProjectEvidence, PracticeLog, TechnologyTag",
      "/programming/skills; /programming/projects; /programming/logs",
      "track languages, technologies, concepts, proficiency self-assessments, and desired outcomes",
      "attach project milestones, repositories or artifacts, retrospectives, and evidence to skills",
      "view practice consistency and breadth without equating commit volume with competence",
      "External links use allow-listed schemes; proficiency scales are explicit; duplicate evidence links are detected but may be retained with confirmation.",
      "Private repositories, renamed technologies, deleted links, imported duplicates, zero-commit work, and long breaks remain representable.",
      "Repository access is opt-in and least-privilege; source code is never sent to AI unless separately selected and consented."),
    F("LC", "LeetCode Tracker", "Tracking", "P1",
      "Track interview-practice problems, patterns, attempts, and review needs without unsafe scraping.",
      "Member", "ProblemReference, ProblemAttempt, PatternTag, ReviewSchedule, ImportRecord",
      "/coding-practice/problems; /coding-practice/attempts; /coding-practice/imports",
      "record problem metadata, difficulty, pattern, attempt outcome, time, notes, and next-review date",
      "import data only through user-supplied files or a supported authorized integration and show a preview before commit",
      "identify weak patterns and overdue reviews from the member's own attempt history",
      "Problem identity is canonical per source; attempt durations and dates are validated; imports are schema-checked and idempotent.",
      "Renamed or removed problems, duplicate imports, partial import failure, private notes, source outage, and missing difficulty remain usable.",
      "The system does not scrape protected pages, store third-party credentials, or claim affiliation with LeetCode."),
    F("READ", "Reading Tracker", "Tracking", "P1",
      "Support intentional reading through a queue, progress, notes, and completion reflection.",
      "Member", "ReadingItem, ReadingProgress, ReadingSession, ReadingNote",
      "/reading/items; /reading/items/{id}/progress; /reading/sessions",
      "add books, articles, papers, or custom material with status, format, optional edition, and goal",
      "record page, percentage, location, or time progress without mixing incompatible units",
      "capture notes and a completion reflection, then expose non-private summaries to the knowledge hub when selected",
      "Progress is monotonic by default but may be corrected with confirmation; totals and positions must share a declared unit.",
      "Unknown length, rereads, multiple editions, abandoned items, article URLs, offline updates, and corrected progress preserve history.",
      "Reading notes are private by default; copyrighted full text is not copied or redistributed without rights."),
    F("QURAN", "Quran Tracker", "Faith and Wellbeing", "P1",
      "Help users record Quran reading or memorization progress respectfully and privately.",
      "Member", "QuranPlan, QuranProgress, SurahReference, AyahRange, MemorizationReview",
      "/quran/plans; /quran/progress; /quran/reviews",
      "create reading or memorization plans using canonical surah and ayah references and a chosen pace",
      "record completed ranges, revisions, and memorization review confidence without double-counting overlaps",
      "show progress and missed-plan recovery options without religious judgment or fabricated guidance",
      "Ranges must match the canonical reference dataset; start is not after end; overlapping entries are normalized or confirmed.",
      "Different mushaf page numbering, partial ayah ranges, Ramadan plans, travel, missed days, offline entries, and dataset version changes are disclosed.",
      "Faith activity is sensitive private data; translations/recitations require licensing; AI does not issue religious rulings."),
    F("PRAYER", "Prayer Tracker", "Faith and Wellbeing", "P1",
      "Offer optional, respectful prayer planning and logging with configurable calculation and privacy.",
      "Member", "PrayerPreference, PrayerOccurrence, PrayerLog, CalculationMethod",
      "/prayer/preferences; /prayer/times; /prayer/logs",
      "configure location precision, calculation method, madhhab option where applicable, and notification preferences",
      "display calculated times with method, location basis, time zone, and last-updated disclosure",
      "record optional completion state or private notes and correct entries without punitive gamification",
      "Prayer calculations require valid method and time zone; location use is explicit; manual times may override calculated values with clear labeling.",
      "High latitudes, daylight-saving changes, travel, location denial, method disagreement, offline cache, and missed sync show transparent fallbacks.",
      "Religious belief, location, and prayer logs are sensitive; no public leaderboard, negative XP, or claim of religious authority is permitted."),
    F("WORKOUT", "Workout Tracker", "Faith and Wellbeing", "P1",
      "Record training plans, sessions, and trends without pretending to provide medical supervision.",
      "Member", "WorkoutPlan, Exercise, WorkoutSession, ExerciseSet, BodyMetric",
      "/workouts/plans; /workouts/sessions; /workouts/exercises",
      "create reusable workouts with exercises, sets, repetitions, duration, distance, intensity, and rest as applicable",
      "log, pause, resume, edit, and complete sessions with unit-aware totals and personal records",
      "review volume, consistency, recovery notes, and trends with configurable goals",
      "Units and exercise measurement types must be compatible; negative values are rejected; personal records are derived from declared formulas.",
      "Supersets, partial workouts, unit conversion, corrected sets, offline logging, injury pauses, and duplicate submissions preserve trustworthy totals.",
      "Workout and body metrics are sensitive; the product provides general tracking, not diagnosis or emergency guidance."),
    F("SLEEP", "Sleep Tracker", "Faith and Wellbeing", "P1",
      "Help users understand routines and self-reported sleep patterns without medical claims.",
      "Member", "SleepEntry, SleepWindow, SleepQuality, SleepFactor, ImportRecord",
      "/sleep/entries; /sleep/imports; /sleep/trends",
      "record sleep start/end, awakenings, quality, optional factors, and notes across midnight and time zones",
      "import user-authorized device data with source labels and allow reconciliation with manual entries",
      "show duration and trend summaries while distinguishing measured, imported, and self-reported values",
      "End must follow start after time-zone normalization; overlapping entries and implausible durations require correction or explicit override.",
      "Naps, shift work, daylight-saving changes, travel, duplicate device records, missing stages, and deleted sources retain provenance.",
      "Sleep data is sensitive health-related data; insights include non-medical disclaimers and emergency symptoms are not interpreted by AI."),
    F("JOURNAL", "Journal", "Reflection", "P0",
      "Provide a private, low-friction space for dated writing, prompts, and attachments.",
      "Member, AI only for explicitly selected entries", "JournalEntry, JournalRevision, Prompt, Attachment",
      "/journal/entries; /journal/entries/{id}/revisions; /journal/prompts",
      "create, autosave, edit, search, archive, and delete dated rich-text or plain-text entries",
      "use optional prompts, tags, mood links, and attachments without making any field mandatory",
      "select specific entries or excerpts for AI reflection and preview the exact scope before sending",
      "Draft versions use optimistic concurrency and recovery snapshots; attachments are type/size scanned; destructive deletion has a recovery window where policy allows.",
      "Offline edits, conflicting devices, empty drafts, large entries, failed attachments, search indexing lag, and deletion during AI processing fail privately.",
      "Journal content is encrypted in transit and at rest, excluded from admin/support views and model training by default, and never used for ads."),
    F("REFLECT", "Reflection", "Reflection", "P0",
      "Turn events and outcomes into lessons, decisions, and next experiments at a chosen cadence.",
      "Member, AI Coach with consent", "Reflection, ReflectionPrompt, Lesson, Experiment",
      "/reflections; /reflections/{id}/lessons; /reflections/{id}/experiments",
      "complete daily, weekly, monthly, goal, or custom reflections using configurable prompts",
      "link evidence from plans, sessions, trackers, and goals while keeping source records independent",
      "extract user-confirmed lessons and experiments and revisit them in later reviews",
      "Cadence and covered period are explicit; linked evidence is read-only; AI-extracted lessons remain drafts until confirmed.",
      "Missed periods, duplicate prompts, changed templates, private evidence, offline drafting, and deleted sources preserve reflection text and provenance.",
      "Reflection text shares journal-grade protections; AI must avoid diagnosis and clearly label inference."),
    F("MOOD", "Mood Tracker", "Reflection", "P1",
      "Enable lightweight, optional mood check-ins and personal pattern exploration without diagnosis.",
      "Member", "MoodEntry, MoodScale, MoodFactor, SafetyResourceEvent",
      "/moods; /mood-scales; /moods/trends",
      "record mood using a configurable labeled scale with optional emotions, energy, factors, and note",
      "edit or delete check-ins and view patterns alongside user-selected activities",
      "display region-appropriate crisis or emergency resources when explicit high-risk language is detected, without claiming assessment",
      "Scale values must map to stable labels; timestamps and time zones are required; notes are optional and length-bounded.",
      "Multiple daily entries, custom scales, false-positive safety triggers, offline check-ins, deleted correlations, and time-zone changes remain transparent.",
      "Mood data is highly sensitive; no public comparison, advertising use, diagnosis, or silent sharing with AI is allowed."),

    F("AICOACH", "AI Coach", "AI Guidance", "P0",
      "Provide contextual, action-oriented productivity coaching while preserving agency, privacy, and uncertainty.",
      "Member, AI Orchestration Service", "Conversation, CoachMessage, ContextGrant, ActionProposal, SafetyEvent",
      "/ai/coach/conversations; /ai/coach/messages; /ai/action-proposals",
      "conduct streaming coaching conversations using only the context scopes the member selects",
      "explain material recommendations, cite internal evidence by date/source, and distinguish facts from inference",
      "create reviewable action proposals for plans, goals, reminders, or schedules and execute none without confirmation",
      "Requests enforce context budgets, model policy, rate limits, prompt-injection defenses, and structured output validation.",
      "Provider timeout, partial stream, unsafe request, stale context, contradictory data, user correction, and cost limit produce recoverable labeled responses.",
      "Conversations and context grants are user-controlled; sensitive data is minimized; no medical, legal, financial, or religious authority is claimed."),
    F("AIMENTOR", "AI Mentor", "AI Guidance", "P1",
      "Support longer-term skill development with curricula, practice, feedback, and evidence-based adaptation.",
      "Member, AI Orchestration Service", "MentorRelationship, LearningPlan, MentorSession, FeedbackArtifact",
      "/ai/mentor/plans; /ai/mentor/sessions; /ai/mentor/feedback",
      "define a mentoring objective, current level, constraints, preferred style, and evidence of success",
      "generate a reviewable learning plan and adaptive practice suggestions grounded in confirmed progress",
      "provide feedback on user-selected artifacts while identifying uncertainty and avoiding fabricated assessment",
      "Plans require an explicit objective and review date; uploaded artifacts are scanned; generated steps must match supported structured schemas.",
      "Insufficient evidence, changing objectives, skill mismatch, unavailable model, unsafe content, large artifact, and deleted context produce bounded alternatives.",
      "Artifacts are processed only for the requested session unless retained by choice; evaluation is advisory and not a credential."),
    F("AIDAILY", "AI Daily Review", "AI Guidance", "P0",
      "Summarize the day and propose a small next adjustment from confirmed activity.",
      "Member, AI Review Service", "AIReview, ReviewEvidence, Suggestion, ReviewFeedback",
      "/ai/reviews/daily/{date}; /ai/reviews/{id}/feedback",
      "generate an on-demand or scheduled daily review from selected plan, focus, habit, mood, and reflection data",
      "show evidence coverage, missing-data notices, wins, friction, and at most a small configured number of next actions",
      "accept, edit, dismiss, or rate suggestions without altering source records",
      "One active generated version per review request is identified by evidence snapshot; stale reviews are labeled; generation requires consent.",
      "No activity, partial sync, late entries, repeated generation, model refusal, midnight rollover, and deleted evidence preserve provenance.",
      "Sensitive sources are opt-in by category; review text is not a diagnosis or moral judgment."),
    F("AIWEEK", "AI Weekly Review", "AI Guidance", "P1",
      "Identify weekly patterns and planning adjustments from evidence rather than generic encouragement.",
      "Member, AI Review Service", "AIReview, WeeklyEvidenceSnapshot, Suggestion, ReviewFeedback",
      "/ai/reviews/weekly/{week}; /ai/reviews/{id}/feedback",
      "generate a weekly review over the member's configured week and selected data scopes",
      "compare intended outcomes, actual focus, interruptions, habits, energy, and carry-forward decisions with transparent gaps",
      "propose a bounded experiment for the next week and require confirmation before adding it to planning",
      "Week boundary, snapshot version, source scopes, and comparison baseline are explicit; unsupported correlations are phrased as hypotheses.",
      "Changed week start, missing days, vacation, outlier sessions, recomputed analytics, and repeated review versions remain explainable.",
      "Review data remains private and cannot be used to rank users or make employment/education decisions."),
    F("AIMONTH", "AI Monthly Review", "AI Guidance", "P2",
      "Synthesize monthly progress, trade-offs, and strategic course corrections without overfitting short-term data.",
      "Member, AI Review Service", "AIReview, MonthlyEvidenceSnapshot, Theme, Suggestion",
      "/ai/reviews/monthly/{month}; /ai/reviews/{id}/feedback",
      "generate a monthly review from confirmed monthly plan, weekly reviews, goals, and selected tracker summaries",
      "separate observable trends from hypotheses and disclose low sample sizes or missing periods",
      "propose continue, stop, start, or change options for user selection rather than a single prescriptive answer",
      "The covered month and evidence snapshot are immutable per version; comparisons use equivalent periods or disclose differences.",
      "Partial adoption month, vacations, changed goals, sparse data, deleted records, model change, and regenerated reviews preserve version history.",
      "The review avoids health, religious, or psychological conclusions and uses only consented aggregate or selected detail."),
    F("AISUGG", "AI Suggestions", "AI Guidance", "P1",
      "Deliver timely, explainable suggestions with strict relevance, frequency, and user-control boundaries.",
      "Member, AI Suggestion Service", "Suggestion, SuggestionReason, SuggestionFeedback, SuppressionRule",
      "/ai/suggestions; /ai/suggestions/{id}/feedback; /ai/suggestion-settings",
      "produce suggestions tied to a current user objective, evidence, confidence, and expiry time",
      "let the member accept, edit, snooze, dismiss, mute a category, or explain irrelevance",
      "learn only from permitted feedback signals and enforce frequency caps and quiet contexts",
      "Every suggestion requires source provenance, category, expiry, action schema, and deduplication key; expired suggestions cannot execute.",
      "Contradictory suggestions, stale context, repeated dismissal, no active goal, provider outage, and policy suppression result in silence or safe fallback.",
      "No dark patterns, covert persuasion, sensitive-trait targeting, or unconfirmed writes are permitted."),

    F("KHUB", "Knowledge Hub", "Knowledge", "P1",
      "Unify notes, bookmarks, resources, reading insights, and selected learning evidence into a searchable personal knowledge space.",
      "Member", "KnowledgeItem, Collection, Tag, Link, SearchDocument",
      "/knowledge/items; /knowledge/collections; /knowledge/search",
      "browse and filter permitted knowledge items by type, tag, collection, source, and date",
      "create collections and typed links between items while preserving the source of truth",
      "surface related items using explainable metadata and optional semantic retrieval",
      "Links cannot create inaccessible cross-user references; canonical source identifiers and index versions are retained.",
      "Deleted source, stale index, duplicate item, cyclic links, offline cache, inaccessible attachment, and empty hub show recoverable states.",
      "Semantic indexing is opt-in for private text and observes the same deletion and export lifecycle as source content."),
    F("NEWS", "Technology News", "Knowledge", "P2",
      "Provide a low-noise, source-transparent technology briefing aligned to selected interests.",
      "Member, Content Curator", "NewsSource, NewsItem, TopicPreference, ReadState",
      "/news; /news/sources; /news/preferences; /admin/news-sources",
      "select topics, sources, cadence, and exclusion preferences for a finite news briefing",
      "view headline, source, publication time, summary, and external link with clear provenance",
      "save, dismiss, report, or convert an item into a reading or learning resource",
      "Sources require rights-compatible feeds or APIs; timestamps and canonical URLs are validated; duplicates are clustered.",
      "Paywalls, retractions, conflicting timestamps, feed outage, duplicate syndication, unsafe links, and empty topics are disclosed.",
      "Summaries distinguish publisher claims from Focused-generated text; browsing behavior is not sold or used for political profiling."),
    F("LRECO", "Learning Recommendations", "Knowledge", "P2",
      "Recommend a small set of relevant learning resources based on explicit goals and gaps.",
      "Member, AI Recommendation Service, Content Curator", "Recommendation, ResourceCandidate, RecommendationReason, Feedback",
      "/learning/recommendations; /learning/recommendations/{id}/feedback",
      "request recommendations for a declared topic, level, format, budget, language, and time constraint",
      "show provenance, prerequisites, estimated effort, cost disclosure, and recommendation reasons",
      "save, dismiss, report, or add a recommendation to a learning path after confirmation",
      "Candidates require a valid source and freshness timestamp; sponsored or affiliate relationships must be labeled; duplicate resources are collapsed.",
      "No suitable result, inaccessible region, changed price, dead link, conflicting level, provider outage, and low confidence yield transparent alternatives.",
      "Recommendations do not infer sensitive traits and do not enroll, purchase, or share contact data without explicit action."),
    F("NOTES", "Personal Notes", "Knowledge", "P0",
      "Capture and retrieve lightweight knowledge without forcing journal or task semantics.",
      "Member, AI only for selected notes", "Note, NoteRevision, Tag, Attachment",
      "/notes; /notes/{id}/revisions; /notes/search",
      "create, autosave, edit, pin, tag, archive, search, and delete notes",
      "link notes to goals, resources, calendar events, and learning items without changing linked records",
      "select notes for AI summary or transformation and preview generated content before saving",
      "Title and body limits, optimistic concurrency, attachment scanning, and safe rich-text sanitization are enforced.",
      "Untitled drafts, offline conflicts, large paste, failed attachment, delayed indexing, deleted link target, and restore preserve user text.",
      "Notes are private by default; AI processing and sharing require item-level selection."),
    F("BOOK", "Bookmarks", "Knowledge", "P1",
      "Save, organize, and revisit external links with durable metadata and user-owned notes.",
      "Member", "Bookmark, BookmarkMetadata, Tag, Collection",
      "/bookmarks; /bookmarks/{id}/metadata; /bookmarks/imports",
      "save a normalized URL with optional title, notes, tags, collection, and reminder",
      "fetch safe metadata asynchronously and show source/failure state without blocking save",
      "deduplicate or intentionally retain variants and import/export common bookmark formats",
      "Only approved URL schemes are accepted; credentials and tracking parameters are stripped where safe; metadata is sanitized.",
      "Redirect chains, dead links, duplicate canonical URLs, intranet URLs, metadata timeout, malicious pages, and offline saves remain controlled.",
      "The server prevents SSRF and does not send private bookmark content to AI without consent."),
    F("RES", "Resources", "Knowledge", "P1",
      "Maintain a curated, typed inventory of files, links, courses, tools, and references used by plans and learning.",
      "Member, Content Curator", "Resource, ResourceType, ResourceVersion, Attachment",
      "/resources; /resources/{id}/versions; /admin/resource-catalog",
      "create and organize personal resources with type, source, tags, status, and optional attachment",
      "link a resource to goals, learning paths, notes, and reading items with usage context",
      "review stale, unavailable, or duplicate resources and replace links without losing references",
      "Files are scanned and size/type limited; URLs are normalized; catalog resources require attribution and licensing metadata.",
      "Version changes, dead links, duplicate files, storage quota, offline access, revoked license, and deleted attachments show provenance and recovery.",
      "Private resources remain user-scoped; catalog curation cannot expose member uploads."),
    F("SEARCH", "Unified Search", "Knowledge", "P1",
      "Find authorized content across Focused quickly without leaking existence or snippets from private objects.",
      "Member, Administrator within administrative scope", "SearchDocument, SearchQuery, SearchIndexCursor",
      "/search; /search/suggestions",
      "search across enabled object types with filters, keyboard navigation, and highlighted matching context",
      "respect per-object authorization before ranking, counting, suggesting, or returning snippets",
      "support exact, prefix, and optional semantic retrieval with clear result-type and source labels",
      "Queries are length/rate limited and sanitized; index records carry owner, visibility, source version, and deletion tombstone.",
      "Index lag, zero results, misspelling, deleted item, offline state, disabled semantic search, and partial service failure do not leak data.",
      "Search logs minimize sensitive query text and use short retention; administrators cannot search user-private content."),

    F("FANL", "Focus Analytics", "Analytics", "P0",
      "Convert trustworthy focus-session and plan data into understandable trends and decisions.",
      "Member", "FocusMetric, AggregateSnapshot, AnalyticsFilter",
      "/analytics/focus; /analytics/focus/exports",
      "view focused minutes, completed sessions, planned-versus-actual time, consistency, and outcome rates by selectable period",
      "filter by goal, project, tag, session type, and local-time grouping with metric definitions available in context",
      "drill from an aggregate to authorized source records and see data freshness and excluded records",
      "Every metric has a versioned definition; running and invalidated sessions are excluded or labeled; aggregation uses the user's historical time zone per event.",
      "Sparse data, corrected sessions, time-zone travel, long-running timer, deleted goal, cached aggregate, and comparison periods remain explainable.",
      "Analytics are private and avoid ranking or moral labels; private text is not required for calculation."),
    F("DANL", "Distraction Analytics", "Analytics", "P1",
      "Help users recognize interruption patterns without surveillance or shame.",
      "Member", "Interruption, DistractionCategory, DistractionMetric, TriggerContext",
      "/distractions; /analytics/distractions; /distraction-categories",
      "record user-defined interruption categories, trigger context, duration estimate, and recovery action",
      "view frequency, timing, self-reported trigger, and recovery trends using clear sample sizes",
      "convert an observed pattern into an optional experiment, reminder, or environment change",
      "Categories may be custom; durations are optional and bounded; correlations disclose sample size and never imply causation.",
      "Uncategorized interruptions, multiple causes, forgotten timer, outliers, deleted sessions, sparse weeks, and offline entries remain valid.",
      "No covert app, browser, microphone, camera, or keystroke surveillance; any device-level telemetry requires separate explicit opt-in."),
    F("REPORT", "Progress Reports", "Analytics", "P1",
      "Create understandable periodic summaries of selected goals, focus, habits, learning, and wellbeing signals.",
      "Member", "ReportDefinition, ReportSnapshot, ReportSection, ShareGrant",
      "/reports; /reports/{id}/generate; /reports/{id}/snapshots",
      "configure report period, sections, comparison baseline, and inclusion of private narrative fields",
      "generate an immutable snapshot with metric definitions, source freshness, and missing-data disclosures",
      "view, regenerate as a new version, or create a time-limited share artifact after preview",
      "Periods and comparisons must be valid; every included field has a source and authorization check; generated snapshots are versioned.",
      "Partial data, stale aggregates, deleted source, large period, failed section, revoked share, and time-zone boundary produce accurate disclosures.",
      "Private journal, mood, faith, sleep, and prayer data are excluded by default and require explicit per-report inclusion."),
    F("EXPORT", "Export Reports and Data", "Analytics", "P1",
      "Give members portable, secure exports for reports and account data.",
      "Member, Auditor for platform audit exports", "ExportJob, ExportArtifact, ExportManifest",
      "/exports; /exports/{id}; /reports/{id}/exports",
      "request CSV, JSON, and human-readable PDF or equivalent exports for supported scopes and date ranges",
      "process large exports asynchronously and expose queued, running, completed, failed, expired, and cancelled states",
      "download a checksum-labeled, time-limited artifact after re-authentication when sensitivity warrants",
      "Formats have versioned schemas; exports use snapshot isolation; filenames are safe; artifacts expire and cannot be guessed.",
      "Large datasets, partial module failure, cancellation, expired link, regeneration, deletion in progress, and locale-specific formatting remain unambiguous.",
      "Exports include only authorized data, omit secrets, disclose redactions, and are encrypted at rest and in transit."),

    F("ACH", "Achievements", "Gamification", "P1",
      "Recognize meaningful milestones without encouraging unhealthy use or manipulative comparison.",
      "Member, Administrator (definition management)", "AchievementDefinition, AchievementAward, AwardProgress",
      "/achievements; /achievements/awards; /admin/achievement-definitions",
      "view locked, in-progress, and earned achievements with transparent criteria and earned time",
      "award an achievement once from verified domain events using idempotent evaluation",
      "allow members to hide achievement surfaces while retaining underlying productivity data",
      "Definitions are versioned, criteria are machine-testable, and retroactive evaluation is explicit; awards cannot be duplicated.",
      "Corrected events, retired definitions, backfill, time-zone changes, hidden gamification, and event replay preserve award integrity.",
      "Achievements never disclose sensitive activity or punish users; no pay-to-win criteria."),
    F("XP", "XP System", "Gamification", "P1",
      "Provide optional progress feedback tied to intentional actions rather than raw screen time.",
      "Member, Administrator (rules)", "XpRule, XpLedgerEntry, XpBalance",
      "/gamification/xp; /gamification/xp/ledger; /admin/xp-rules",
      "earn XP from allow-listed verified events with visible rule, amount, source, and timestamp",
      "reverse or adjust XP through compensating immutable ledger entries when source data changes",
      "view an understandable balance and recent ledger while opting out of XP presentation",
      "Every ledger entry has a unique source event and rule version; daily caps and anti-abuse limits are enforced; balances derive from the ledger.",
      "Event replay, deleted activity, rule change, offline sync, negative adjustment, cap crossing, and migration cannot corrupt balance.",
      "No XP loss for rest, missed habits, prayer, mood, sleep, or disability-related behavior; XP cannot buy access or status."),
    F("LEVEL", "Levels", "Gamification", "P1",
      "Translate optional XP into stable, understandable milestones with no functional disadvantage.",
      "Member, Administrator (definitions)", "LevelDefinition, UserLevel, LevelTransition",
      "/gamification/levels; /users/me/level; /admin/level-definitions",
      "view current level, threshold range, and next-level progress based on the XP ledger",
      "advance levels deterministically and record transition events without duplicate rewards",
      "preserve historical level labels when definitions are revised or retired",
      "Thresholds are strictly increasing, non-overlapping, versioned, and derived from non-negative qualifying XP.",
      "XP reversal, threshold migration, event replay, opt-out, retired levels, and maximum level have explicit behavior.",
      "Levels are cosmetic and private by default; they do not gate core productivity features."),
    F("STREAK", "Streaks", "Gamification", "P1",
      "Visualize consistency using schedule-aware, pause-aware rules and compassionate recovery.",
      "Member", "StreakDefinition, StreakState, StreakOccurrence, StreakPause",
      "/streaks; /streaks/{id}/history",
      "show current, best, and recent consistency for eligible habits, planning, and focus definitions",
      "calculate occurrences from the source schedule, local date, grace rules, and approved pauses",
      "explain exactly why a streak continued, paused, reset, or was recalculated",
      "Each streak has a versioned definition and one result per eligible occurrence; backfill limits and pause rules are explicit.",
      "Travel, daylight-saving change, illness pause, schedule edit, corrected event, offline sync, and grace-period boundary recalculate deterministically.",
      "No streaks for sensitive faith, mood, sleep, or health behavior by default; no shame, threat, or monetary pressure."),
    F("GAME", "Gamification Controls", "Gamification", "P1",
      "Make motivation systems coherent, optional, transparent, and subordinate to healthy focus.",
      "Member, Administrator", "GamificationPreference, RewardRule, RewardEvent",
      "/gamification/preferences; /admin/gamification-rules",
      "enable or disable XP, levels, achievements, celebrations, streak emphasis, and challenge visibility independently",
      "apply rule versions consistently across event-driven rewards and expose plain-language criteria",
      "enforce quiet celebrations, reduced motion, frequency caps, and wellbeing guardrails",
      "Opt-out must not delete source data or remove core function; reward rules require approval, effective dates, and rollback metadata.",
      "Preference changes mid-event, rule rollback, duplicate events, reduced-motion mode, minors policy if introduced, and experiments remain safe.",
      "No dark patterns, loot boxes, variable-ratio monetary rewards, public shaming, or productivity access tied to engagement."),
    F("CHALL", "Challenges", "Gamification", "P2",
      "Offer time-bounded personal challenges that reinforce deliberate behaviors without coercion.",
      "Member, Administrator/Content Curator", "ChallengeDefinition, ChallengeEnrollment, ChallengeProgress",
      "/challenges; /challenges/{id}/enrollments; /admin/challenges",
      "browse eligibility, criteria, duration, privacy, and reward terms before voluntarily enrolling",
      "track progress from verified events and withdraw at any time without penalty",
      "complete a personal challenge and receive idempotent recognition under the enrolled rule version",
      "Definitions have start/end, eligibility, metric, cap, and rule version; enrollment is explicit; progress cannot use retroactive events unless disclosed.",
      "Late enrollment, time-zone boundary, corrected events, withdrawal, expired challenge, rule cancellation, and duplicate completion are deterministic.",
      "Initial scope is private/personal; social competition, wagering, and public leaderboards are excluded."),

    F("NOTIF", "Notifications", "Engagement", "P0",
      "Deliver relevant, consented information through in-app, push, and future channels with a unified preference model.",
      "Member, System", "Notification, NotificationPreference, DeliveryAttempt, DeviceSubscription",
      "/notifications; /notification-preferences; /push-subscriptions",
      "view, mark read/unread, archive, and deep-link from an in-app notification center",
      "grant or revoke channel permission and configure category, cadence, quiet hours, batching, and accessibility modality",
      "deliver push notifications with deduplication, expiry, retry policy, and safe lock-screen content",
      "Every delivery has category, recipient, deduplication key, expiry, locale, and preference snapshot; revoked endpoints are removed.",
      "Permission denial, expired subscription, provider outage, duplicate worker, quiet-hours crossing, time-zone change, and stale deep link fail gracefully.",
      "Notification previews minimize sensitive text; security alerts may override batching but not unsafe lock-screen disclosure."),
    F("REM", "Reminder Engine", "Engagement", "P0",
      "Schedule reliable one-time and recurring reminders with explainable timing and delivery state.",
      "Member, System", "Reminder, ReminderSchedule, ReminderOccurrence, DeliveryPolicy",
      "/reminders; /reminders/{id}/occurrences; /reminders/{id}/snooze",
      "create, edit, pause, resume, snooze, complete, and delete one-time or recurring reminders",
      "resolve occurrences from canonical time zone, recurrence, quiet hours, channel availability, and missed-delivery policy",
      "show next occurrence, last outcome, and delivery failures without duplicating notifications",
      "Recurrence is bounded and RFC-compatible where exposed; every occurrence has a unique key; past dates and invalid local times require resolution.",
      "Daylight-saving gaps/folds, travel, device offline, worker replay, edited recurrence, missed occurrence, and revoked channel are deterministic.",
      "Reminders are private and frequency-capped; deleting a source object cancels or detaches reminders according to explicit user choice."),
    F("AIREM", "AI Smart Reminder", "Engagement", "P1",
      "Suggest context-sensitive reminder timing while preserving a predictable user-approved schedule.",
      "Member, AI Suggestion Service", "SmartReminderProposal, Reminder, TimingReason, Feedback",
      "/ai/reminder-proposals; /ai/reminder-proposals/{id}/decision",
      "propose reminder time, channel, and wording from selected task urgency, schedule, habits, and prior feedback",
      "show the reason, confidence, source scopes, quiet-hours impact, and alternative times before creation",
      "learn from snooze, dismiss, and completion feedback within consent and frequency limits",
      "Proposals expire, are deduplicated, use structured timing constraints, and never become reminders without explicit or preconfigured scoped approval.",
      "No useful context, calendar outage, time-zone change, repeated dismissal, low confidence, conflicting reminders, and AI outage fall back to manual scheduling.",
      "Smart reminders cannot infer sensitive contexts or reveal private content on shared devices."),

    F("ADMIN", "Admin Panel", "Administration", "P0",
      "Enable safe platform operation without granting routine access to members' private content.",
      "Support Administrator, Platform Administrator, Content Curator, Auditor", "AdminUserView, RoleAssignment, ModerationCase, FeatureFlag, AuditEvent, SystemHealth",
      "/admin/users; /admin/roles; /admin/content; /admin/feature-flags; /admin/audit; /admin/health",
      "search minimal account metadata, change allowed status fields, and execute documented support workflows with reason codes",
      "manage roles, curated sources, configuration, feature flags, and policy-backed moderation through least privilege",
      "review immutable audit events and operational health while exporting only authorized administrative evidence",
      "Every privileged action requires server-side authorization, reason, actor, target, correlation ID, and audit event; dangerous actions require step-up or dual control.",
      "Concurrent admins, self-role escalation, last-admin removal, locked account, partial failure, stale flag, audit outage, and mistaken action use fail-safe or compensating workflows.",
      "Private journal, notes, mood, faith, health, and AI conversations are unavailable to routine admins; break-glass access is out of initial scope and would require formal governance."),
    F("AGENT", "Future AI Agent Support", "Future Platform", "P3",
      "Prepare bounded, observable, reversible task automation without granting open-ended autonomous authority.",
      "Member, Approved Agent Runtime, Platform Administrator", "AgentDefinition, CapabilityGrant, AgentRun, ToolCall, Approval, RunEvent",
      "/agents; /agents/{id}/runs; /agent-runs/{id}/approvals; /agent-tools",
      "define an agent objective, allowed tools, data scopes, budget, time limit, and approval policy",
      "execute a durable run with plan, step events, tool-call validation, human approval gates, cancellation, and resumability",
      "present a complete audit trail, outputs, side effects, costs, failures, and compensating actions",
      "Capability grants are deny-by-default, short-lived, least-privilege, and bound to a user and run; external writes require idempotency and approval policy.",
      "Prompt injection, tool outage, partial side effect, duplicate callback, runaway loop, revoked consent, cost exhaustion, and user interruption terminate or pause safely.",
      "No unrestricted shell/browser/email/calendar authority; agents cannot expand their own permissions or conceal actions."),
]


PRODUCT_GOALS = [
    ("PG-01", "Reduce activation energy", "A member can identify and start the next meaningful action in under two minutes from opening the product."),
    ("PG-02", "Strengthen intentional focus", "Planning, timers, environment cues, and reflection form one low-friction execution loop."),
    ("PG-03", "Build sustainable discipline", "Consistency mechanisms support recovery and autonomy rather than shame, compulsion, or surveillance."),
    ("PG-04", "Connect horizons", "Life vision, yearly/monthly/weekly planning, goals, and daily focus remain traceably connected."),
    ("PG-05", "Make progress legible", "Members can understand outcomes, time, interruptions, learning, and selected wellbeing signals using defined metrics."),
    ("PG-06", "Provide trustworthy AI guidance", "AI is contextual, explainable, consent-based, provider-neutral, and unable to mutate user state without approval."),
    ("PG-07", "Protect the private self", "Journal, mood, faith, sleep, health-adjacent, and coaching data receive strict purpose limitation and least privilege."),
    ("PG-08", "Be calm and inclusive", "The experience is responsive, accessible, localized, theme-aware, and intentionally low-noise."),
    ("PG-09", "Enable durable portability", "REST contracts, data export, modular domains, and event semantics support future mobile clients and provider changes."),
    ("PG-10", "Operate at global scale", "The platform is observable, secure, horizontally scalable, deployment-ready, and governed by automated quality gates."),
]


PERSONAS = [
    ("P-01", "Intentional knowledge worker", "Balances meetings and project work; needs a clear daily commitment, protected focus blocks, and low-noise reminders.", "Dashboard overload, notification fatigue, and calendar conflict."),
    ("P-02", "University learner", "Plans classes and self-study; tracks reading, practice, learning paths, habits, and reflection across irregular weeks.", "Punitive streaks, unrealistic schedules, and mobile/offline gaps."),
    ("P-03", "Software engineer preparing for growth", "Combines deep work, programming projects, LeetCode practice, technology resources, and an AI mentor.", "Metric gaming, private repository exposure, and generic recommendations."),
    ("P-04", "Founder or independent professional", "Needs goals, yearly-to-daily alignment, smart scheduling, progress reports, and fast reprioritization.", "Overplanning, AI overreach, and confidential calendar or note leakage."),
    ("P-05", "Faith-integrated planner", "Optionally coordinates prayer and Quran routines with work and wellbeing while expecting respectful configurability.", "Religious judgment, location exposure, incorrect assumptions, and gamification of worship."),
    ("P-06", "Member rebuilding routines", "Uses sleep, mood, workout, habits, and journal features to notice patterns and recover gradually.", "Medical claims, shame, obsessive tracking, and sensitive-data misuse."),
    ("P-07", "Accessibility-first member", "Uses keyboard, screen reader, zoom, high contrast, reduced motion, or alternative notification modalities.", "Timer inaccessibility, focus loss, motion, color-only status, and cramped responsive layouts."),
    ("P-08", "Support or platform operator", "Resolves account/operational issues, manages safe configuration, and investigates audit evidence without reading private content.", "Excess privilege, unaudited actions, accidental disclosure, and unsafe bulk operations."),
]


USER_STORIES = [
    ("US-001", "P-01", "As a member, I want a calm dashboard with today's next action so that I can begin without surveying every module.", "DASH, DAILY"),
    ("US-002", "P-01", "As a member, I want to commit to no more than three primary daily outcomes so that planning forces meaningful trade-offs.", "DAILY"),
    ("US-003", "P-01", "As a member, I want a timer to recover correctly after sleep or reconnect so that my focus history is trustworthy.", "DEEP, POMO"),
    ("US-004", "P-04", "As a member, I want goals linked across yearly, monthly, weekly, and daily horizons so that today's work serves long-term outcomes.", "GOAL, YEARPLAN, MONTHPLAN, WEEKPLAN, DAILY"),
    ("US-005", "P-04", "As a member, I want scheduling proposals to respect locked events and buffers so that accepting a plan does not create conflicts.", "SMARTSCHED, CAL"),
    ("US-006", "P-02", "As a learner, I want to organize skills, resources, practice, and evidence so that progress means more than time spent.", "LEARN, KHUB, RES"),
    ("US-007", "P-03", "As a developer, I want to track problem patterns and review dates so that practice targets weak areas.", "LC, PROG"),
    ("US-008", "P-03", "As a developer, I want private repositories excluded unless I select them so that mentoring does not expose source code.", "PROG, AIMENTOR"),
    ("US-009", "P-05", "As a member, I want prayer times to disclose method and location basis so that I can judge whether they fit my practice.", "PRAYER"),
    ("US-010", "P-05", "As a member, I want Quran progress to use valid references without competitive ranking so that tracking remains respectful.", "QURAN"),
    ("US-011", "P-06", "As a member, I want to pause a habit during illness without losing historical meaning so that recovery is not treated as failure.", "HABIT, STREAK"),
    ("US-012", "P-06", "As a member, I want mood and sleep trends clearly labeled as observations so that the product does not diagnose me.", "MOOD, SLEEP"),
    ("US-013", "P-06", "As a member, I want my journal private from routine administrators and AI by default so that I can write honestly.", "JOURNAL"),
    ("US-014", "P-07", "As a keyboard and screen-reader user, I want every timer and planning workflow operable without a pointer so that I have equivalent control.", "A11Y, DEEP, DAILY"),
    ("US-015", "P-07", "As a member, I want reduced motion and non-audio timer cues so that celebrations and alerts remain usable.", "A11Y, GAME, NOTIF"),
    ("US-016", "P-01", "As a member, I want interruption patterns without covert surveillance so that analytics improve my environment without invading it.", "DANL"),
    ("US-017", "P-04", "As a member, I want progress reports to disclose missing data and metric definitions so that comparisons are credible.", "REPORT, FANL"),
    ("US-018", "P-01", "As a member, I want reminders to honor quiet hours across travel and daylight-saving changes so that the system remains predictable.", "REM, NOTIF"),
    ("US-019", "P-04", "As a member, I want AI advice grounded in evidence I selected so that I can understand and correct it.", "AICOACH, AISUGG"),
    ("US-020", "P-04", "As a member, I want AI-proposed changes presented for review so that the coach cannot silently alter my schedule or goals.", "AICOACH, SMARTSCHED"),
    ("US-021", "P-02", "As a member, I want daily and weekly reviews to offer one bounded experiment so that improvement stays actionable.", "AIDAILY, AIWEEK, REFLECT"),
    ("US-022", "P-02", "As a member, I want bookmarks, notes, reading, and resources searchable together so that knowledge is retrievable.", "KHUB, SEARCH, BOOK, NOTES, READ, RES"),
    ("US-023", "P-01", "As a member, I want gamification controls and no penalty for rest so that motivation does not become coercion.", "GAME, XP, LEVEL, STREAK, ACH"),
    ("US-024", "P-08", "As a support operator, I want minimal account metadata and reason-coded actions so that I can help without reading private content.", "ADMIN"),
    ("US-025", "P-08", "As an auditor, I want immutable privileged-action evidence so that access and changes are accountable.", "ADMIN, AUTH"),
    ("US-026", "P-01", "As a member, I want my settings and active sessions synchronized across web and future mobile clients so that controls are consistent.", "SET, AUTH"),
    ("US-027", "P-07", "As a multilingual member, I want dates, weeks, numbers, and right-to-left layouts localized so that meaning is not lost.", "LANG"),
    ("US-028", "P-04", "As a member, I want versioned machine-readable exports so that my data remains portable.", "EXPORT"),
    ("US-029", "P-01", "As a member, I want useful cached read access and safe queued writes offline so that short network loss does not erase work.", "DAILY, JOURNAL, NOTES, DEEP"),
    ("US-030", "P-04", "As a future agent user, I want bounded capabilities, budgets, approvals, and an audit trail so that automation remains reversible.", "AGENT"),
]


USE_CASES = [
    {
        "id": "UC-01", "name": "Create and execute a daily focus plan", "actor": "Member",
        "pre": "The member is authenticated; local date, time zone, and planning preferences are available.",
        "trigger": "The member opens Daily Focus for the current local date.",
        "main": ["The system retrieves or creates the canonical daily plan.", "The member selects up to three primary priorities and optional supporting tasks.", "The system estimates planned load against available capacity and explains conflicts.", "The member schedules or starts a focus block.", "The member completes, defers, cancels, or carries forward each commitment with an optional reason.", "The system updates derived summaries and emits idempotent domain events."],
        "alt": ["Offline edits are stored with client mutation identifiers and synchronized later.", "A concurrent edit produces a merge/review state instead of last-write-wins data loss.", "AI suggestions are absent or read-only when consent is missing."],
        "post": "The plan and decision history are persisted; no unconfirmed AI mutation exists.", "links": "FR-DAILY-001..003; FR-DEEP-001; BR-07; NFR-REL-04"
    },
    {
        "id": "UC-02", "name": "Run a deep-work session", "actor": "Member",
        "pre": "No other focus-mode session is active for the member.", "trigger": "The member starts a configured deep-work or Pomodoro session.",
        "main": ["The member defines intent, duration, and optional goal link.", "The server creates an active session from an idempotent request.", "The client renders elapsed/remaining time from authoritative timestamps.", "The member records interruptions or pauses and resumes.", "The member completes or abandons the session and records an outcome.", "Analytics update asynchronously from the final event."],
        "alt": ["After sleep or reconnect, elapsed time is reconciled without double counting.", "A second device is shown the active session and may request a controlled takeover.", "Notification or distraction-control permission denial does not prevent the timer."],
        "post": "One terminal session record exists with consistent duration and provenance.", "links": "FR-DEEP-001..003; FR-POMO-001..003; BR-10; NFR-PERF-03"
    },
    {
        "id": "UC-03", "name": "Plan a week from goals and calendar", "actor": "Member",
        "pre": "The member has a week definition; goals/calendar connections are optional.", "trigger": "The member starts weekly planning.",
        "main": ["The system shows candidate outcomes and known calendar constraints without auto-committing them.", "The member sets capacity, outcomes, constraints, and recovery time.", "The system detects overcommitment and explains the basis.", "The member accepts or edits suggested time blocks.", "External calendar writes occur only after confirmation and provider acknowledgement.", "The plan becomes the canonical version for the week."],
        "alt": ["If free/busy is unavailable, the system labels availability unknown.", "If insufficient time exists, unscheduled work remains visible with alternatives.", "Conflicting provider updates enter a review state."],
        "post": "The weekly plan and any confirmed calendar operations are traceable.", "links": "FR-WEEKPLAN-001..003; FR-SMARTSCHED-001..003; FR-CAL-001..003"
    },
    {
        "id": "UC-04", "name": "Track a scheduled habit with a pause", "actor": "Member",
        "pre": "A valid habit and schedule exist.", "trigger": "A habit occurrence becomes due or the member opens the tracker.",
        "main": ["The member records the typed value or completion state.", "The system validates the value against the habit type and occurrence.", "Adherence and eligible streaks update from the versioned schedule.", "The member pauses the habit for an illness, vacation, or custom period.", "Paused occurrences are excluded according to the disclosed rule.", "Resumption uses the confirmed schedule."],
        "alt": ["Backfill beyond policy requests confirmation or is rejected.", "Schedule changes create a new version for future occurrences.", "Offline duplicate mutations resolve using occurrence and client mutation identifiers."],
        "post": "History remains interpretable under the schedule and pause version active at each occurrence.", "links": "FR-HABIT-001..003; FR-STREAK-001..003; BR-14..17"
    },
    {
        "id": "UC-05", "name": "Generate and act on an AI daily review", "actor": "Member",
        "pre": "AI review consent exists for at least one data scope.", "trigger": "The member requests a review or a consented schedule becomes due.",
        "main": ["The system displays included scopes and captures an evidence snapshot.", "The AI service generates structured observations, gaps, and bounded next actions.", "The system validates output, labels inference, and links evidence.", "The member accepts, edits, dismisses, or rates each suggestion.", "Accepted actions become reviewable domain commands.", "Only confirmed commands mutate plans, reminders, or schedules."],
        "alt": ["With sparse data, the review states limitations and avoids trend claims.", "Unsafe or unsupported requests return a bounded refusal and helpful alternative.", "Provider failure preserves the snapshot for retry without duplicate actions."],
        "post": "The versioned review, feedback, and any separately confirmed actions are auditable.", "links": "FR-AIDAILY-001..003; FR-AICOACH-001..003; BR-27..33"
    },
    {
        "id": "UC-06", "name": "Write a private journal entry and selectively reflect with AI", "actor": "Member",
        "pre": "The member is authenticated; AI access is optional.", "trigger": "The member creates a journal entry.",
        "main": ["The client creates a recoverable draft and autosaves versioned changes.", "The member adds text, tags, mood link, or permitted attachment.", "The system sanitizes content and scans attachments.", "The member selects an exact entry or excerpt for AI reflection.", "A scope preview is confirmed before transmission.", "Generated reflection is saved only when the member chooses."],
        "alt": ["Concurrent offline edits create a merge copy with neither version lost.", "Attachment failure leaves the text draft intact.", "Revoked AI consent prevents transmission but not local writing."],
        "post": "The journal remains private; any AI use has an item-level consent record.", "links": "FR-JOURNAL-001..003; FR-REFLECT-001..003; BR-23..26"
    },
    {
        "id": "UC-07", "name": "Import LeetCode practice history", "actor": "Member",
        "pre": "The member supplies a supported file or authorizes an approved integration.", "trigger": "The member starts an import.",
        "main": ["The system validates source, schema, size, and encoding.", "A preview classifies new, duplicate, changed, and invalid records.", "The member selects the records to commit.", "The server processes an idempotent import job.", "Attempts and pattern summaries are recomputed.", "The result reports committed, skipped, and rejected rows."],
        "alt": ["Partial invalidity does not silently discard valid rows.", "Source outage leaves the import retryable.", "No protected-page scraping or third-party credential capture is attempted."],
        "post": "Imported attempts retain source and import provenance and can be reversed by import batch.", "links": "FR-LC-001..003; BR-35; NFR-SEC-10"
    },
    {
        "id": "UC-08", "name": "Configure and receive a reminder", "actor": "Member",
        "pre": "At least one delivery channel is available, or in-app delivery is enabled.", "trigger": "The member creates a one-time or recurring reminder.",
        "main": ["The system validates local time, time zone, recurrence, quiet hours, and channel.", "The next occurrence is displayed for confirmation.", "A durable scheduler claims each due occurrence once.", "Notification content is localized and privacy-minimized.", "The provider acknowledgement or failure is recorded.", "The member completes, snoozes, or dismisses the occurrence."],
        "alt": ["A daylight-saving gap requests a defined shift/skip policy.", "A revoked push endpoint falls back only to an already-consented channel.", "Duplicate workers observe the same occurrence key and do not redeliver."],
        "post": "The occurrence has one auditable outcome and the next occurrence is correctly computed.", "links": "FR-REM-001..003; FR-NOTIF-001..003; BR-18..22"
    },
    {
        "id": "UC-09", "name": "Generate and download a progress report", "actor": "Member",
        "pre": "The member owns data in at least one selected report section.", "trigger": "The member configures a report and requests generation.",
        "main": ["The member selects period, sections, comparison, and sensitive-data inclusions.", "The system previews the inclusion scope and metric definitions.", "A versioned snapshot is generated from authorized sources.", "Missing/stale data is disclosed per section.", "The member requests an export job in a supported format.", "After appropriate re-authentication, a time-limited artifact is downloaded."],
        "alt": ["A failed section is labeled rather than replaced by zero.", "An expired artifact can be regenerated from the same snapshot.", "Revoked or deleted data is treated according to the snapshot and retention policy."],
        "post": "The report and export have immutable manifests, schema version, and audit metadata.", "links": "FR-REPORT-001..003; FR-EXPORT-001..003; NFR-PRIV-06"
    },
    {
        "id": "UC-10", "name": "Localize and access a timer", "actor": "Accessibility-first member",
        "pre": "The member has language and accessibility preferences or OS defaults.", "trigger": "The member opens a timer workflow.",
        "main": ["Preferences are applied before the interactive timer is announced.", "All controls are reached and activated using the keyboard.", "Visible focus, name, role, and state are conveyed to assistive technology.", "Elapsed/remaining updates use a non-disruptive announcement cadence.", "Status uses text/icon cues in addition to color.", "Reduced motion and alternate alert modality are honored."],
        "alt": ["At 200% text zoom, controls reflow without two-dimensional scrolling.", "When audio is unavailable, visual/haptic or in-app alternatives remain.", "Right-to-left text does not reverse timer semantics or control order incorrectly."],
        "post": "The member has equivalent control and understandable state without pointer, color, motion, or sound dependence.", "links": "FR-A11Y-001..003; FR-LANG-001..003; NFR-A11Y-01..08"
    },
    {
        "id": "UC-11", "name": "Administer an account without reading private content", "actor": "Support Administrator",
        "pre": "The operator has MFA, a valid support role, and an active support reason/ticket.", "trigger": "The operator searches for an account using allowed metadata.",
        "main": ["The system authorizes the query and returns minimal account status metadata.", "The operator selects a documented support action and reason code.", "Step-up authentication occurs for sensitive status changes.", "The server re-authorizes the action on the target resource.", "The action executes or fails atomically.", "An immutable audit event records actor, target, reason, result, and correlation ID."],
        "alt": ["Private content endpoints remain unavailable regardless of UI manipulation.", "Self-escalation and last-admin removal fail closed.", "If audit persistence is unavailable, privileged mutation fails unless a documented emergency policy permits otherwise."],
        "post": "Only allowed account metadata changed; private content was neither returned nor searched.", "links": "FR-ADMIN-001..003; BR-40..46; NFR-SEC-01..12"
    },
    {
        "id": "UC-12", "name": "Execute a future bounded AI agent run", "actor": "Member",
        "pre": "The agent runtime is enabled; objective, tools, scopes, budget, and approval policy are valid.", "trigger": "The member starts an agent run.",
        "main": ["The runtime records an immutable capability grant and input snapshot.", "The agent proposes a plan within time, token, cost, and step budgets.", "Each tool call is authorized and schema-validated at execution time.", "External writes pause for required human approval.", "Results and side effects are recorded as run events.", "The run completes, pauses, fails, or is cancelled with a full summary."],
        "alt": ["Prompt injection or permission expansion attempts terminate the affected step.", "Partial external writes are reported with safe compensating options.", "Consent revocation or budget exhaustion stops new tool calls immediately."],
        "post": "The member can inspect every material input, approval, tool call, output, cost, and side effect.", "links": "FR-AGENT-001..003; BR-47..50; NFR-AI-01..10"
    },
]


BUSINESS_RULES = [
    ("BR-01", "Ownership", "All member-created domain records have exactly one owning account in the initial product; team/shared ownership is out of initial scope."),
    ("BR-02", "Server authorization", "Every read and mutation is authorized server-side against actor, action, resource, ownership, role, consent, and current policy."),
    ("BR-03", "Canonical time", "Instants are stored in UTC with the originating IANA time zone and local-date context when calendar meaning matters."),
    ("BR-04", "User day", "Daily boundaries use the member's effective time zone; a time-zone change never silently moves previously finalized records."),
    ("BR-05", "Week definition", "Week start is user-configurable; stored weekly plans retain the week definition used when created."),
    ("BR-06", "History", "Material target, schedule, status, and rule changes are versioned or represented by append-only events so historical reports remain interpretable."),
    ("BR-07", "Daily priorities", "A daily plan supports at most three primary priorities; supporting items are allowed but are visually subordinate."),
    ("BR-08", "Carry-forward", "Carry-forward is an explicit decision and records source date, destination date, and optional reason; it is never inferred from inactivity."),
    ("BR-09", "Planning warnings", "Capacity excess produces an explainable warning and alternatives, not an unexplained hard block."),
    ("BR-10", "Active focus session", "A member has at most one active deep-work or Pomodoro focus interval across devices."),
    ("BR-11", "Timer authority", "Elapsed time is derived from authoritative start/pause/end instants, not accumulated browser ticks."),
    ("BR-12", "Focus completion", "Abandoned, interrupted, completed, and invalidated sessions are distinct states and are not silently converted."),
    ("BR-13", "Break safety", "Breaks never reduce XP or streaks and may be extended or skipped without shame-based messaging."),
    ("BR-14", "Habit occurrence", "Habit adherence is evaluated against the versioned schedule and target applicable to each occurrence."),
    ("BR-15", "Habit pause", "Approved pause periods are excluded from due occurrences; they do not count as completion or failure."),
    ("BR-16", "Backfill", "Backfill windows are configurable and disclosed; corrections outside the window require explicit confirmation and remain auditable."),
    ("BR-17", "Streak calculation", "Streaks use eligible occurrences rather than consecutive calendar days unless the schedule is daily."),
    ("BR-18", "Reminder occurrence", "Each computed reminder occurrence has a globally unique deduplication key and one terminal delivery outcome per channel attempt."),
    ("BR-19", "Quiet hours", "Non-security notifications do not deliver during the member's effective quiet hours; the selected defer, batch, or suppress policy applies."),
    ("BR-20", "DST recurrence", "For invalid or ambiguous local recurrence times, the system applies a disclosed user-selected shift/first/second/skip policy."),
    ("BR-21", "Channel consent", "Delivery uses only currently consented channels; it never falls back to an unapproved channel."),
    ("BR-22", "Sensitive preview", "Lock-screen and email previews omit sensitive journal, mood, faith, health-adjacent, and coaching content by default."),
    ("BR-23", "Private-content boundary", "Routine administrators and content curators cannot retrieve member journal, note body, mood note, life vision, prayer log, Quran note, sleep note, or AI conversation content."),
    ("BR-24", "Sensitive feature defaults", "Journal, mood, faith, sleep, workout/body, and AI conversation features are private and excluded from reports, search embeddings, and sharing until selected."),
    ("BR-25", "Deletion", "Account and content deletion follows a documented lifecycle covering recovery window, legal holds if applicable, backups, indexes, AI stores, exports, and third-party processors."),
    ("BR-26", "Export", "A member can export their supported data in documented machine-readable formats; secrets, internal risk scores, and other users' data are excluded."),
    ("BR-27", "AI consent", "AI processing requires an active purpose-specific consent and a context grant listing the selected data categories or items."),
    ("BR-28", "AI provenance", "Material AI observations cite internal source type/date or are labeled as inference; unavailable evidence is disclosed."),
    ("BR-29", "AI mutation", "AI output is advisory; any state-changing action is a validated proposal requiring explicit approval or a narrowly scoped pre-approved policy."),
    ("BR-30", "AI uncertainty", "AI must not fabricate completed activity, certainty, citations, credentials, diagnoses, rulings, or calendar/provider acknowledgement."),
    ("BR-31", "AI safety", "Requests and outputs pass policy, prompt-injection, data-loss-prevention, and structured-output validation appropriate to the action risk."),
    ("BR-32", "AI retention", "AI request/response retention, provider use, and model-training status are disclosed and configurable within platform policy."),
    ("BR-33", "AI graceful degradation", "Core planning, tracking, timers, journal, reminders, and exports remain usable when AI is disabled or unavailable."),
    ("BR-34", "Metric truth", "Each metric has a named owner, definition, unit, inclusion/exclusion rules, version, freshness, and test fixtures."),
    ("BR-35", "Third-party data", "Focused uses documented authorized APIs, licensed feeds, user-provided files, or public data permitted by terms; it does not bypass access controls or store third-party passwords."),
    ("BR-36", "News provenance", "Every news item shows original publisher/source and publication time; generated summaries are labeled."),
    ("BR-37", "Faith neutrality", "Prayer and Quran features are configurable aids, not religious authorities; method differences and data sources are disclosed."),
    ("BR-38", "Health boundary", "Mood, sleep, workout, and habit insights are general tracking and reflection, not diagnosis, treatment, or emergency response."),
    ("BR-39", "Crisis resources", "When configured safety detection identifies explicit high-risk language, Focused may present region-appropriate resources while stating it cannot assess or provide emergency care."),
    ("BR-40", "Role assignment", "Only authorized platform administrators may assign operational roles, and they may not grant privileges beyond their own delegation boundary."),
    ("BR-41", "Privileged MFA", "All operational roles require MFA; sensitive actions require recent step-up authentication."),
    ("BR-42", "Admin reason", "Every privileged read or write requires a declared operational reason or linked case and an immutable audit event."),
    ("BR-43", "Separation of duties", "Policy-defined high-risk actions require a second approver or an equivalent controlled workflow."),
    ("BR-44", "Audit integrity", "Audit records are append-only, access-controlled, time-synchronized, retention-governed, and excluded from routine deletion by subjects."),
    ("BR-45", "Last administrator", "The last active platform administrator cannot remove or disable their own administrative access."),
    ("BR-46", "Feature flags", "Flags have owner, purpose, audience, expiry/review date, safe default, and rollback plan; authorization is never implemented only by a flag."),
    ("BR-47", "Agent capability", "Agent tools are deny-by-default and capability grants cannot be expanded by the agent or by tool output."),
    ("BR-48", "Agent budgets", "Every agent run has hard time, step, token/cost, and side-effect budgets enforced outside the model."),
    ("BR-49", "Agent approval", "External communication, calendar writes, destructive changes, purchases, and other policy-designated actions require human approval at execution time."),
    ("BR-50", "Agent audit", "Agent plans, tool inputs/outputs, approvals, errors, costs, side effects, and cancellations are recorded with sensitive-data redaction."),
]


NFRS = [
    ("NFR-PERF-01", "Web experience", "At the 75th percentile on supported mobile devices and normal broadband, public and authenticated shell pages shall target LCP <= 2.5 s, INP <= 200 ms, and CLS <= 0.1."),
    ("NFR-PERF-02", "REST latency", "Excluding AI and third-party provider time, cached/read APIs shall target p95 <= 300 ms and ordinary write APIs p95 <= 500 ms at expected load."),
    ("NFR-PERF-03", "Timer interaction", "Timer start/pause/resume UI acknowledgement shall occur within 100 ms locally and reconcile with the server without visible jumps greater than one second under normal conditions."),
    ("NFR-PERF-04", "Search", "Authorized lexical search shall target p95 <= 750 ms for the supported query/index size; partial index freshness shall be disclosed."),
    ("NFR-PERF-05", "AI streaming", "When the provider is healthy, AI endpoints shall target first meaningful streamed content within 3 s and expose progress, cancel, retry, and timeout states."),
    ("NFR-PERF-06", "Budgets", "CI shall enforce route-level JavaScript, image, font, and API payload budgets with documented exceptions."),
    ("NFR-SCALE-01", "Horizontal scale", "Stateless request handling, partitionable queues, caches, and data access shall support horizontal scaling without user affinity."),
    ("NFR-SCALE-02", "Capacity", "The architecture shall be capacity-tested for at least 1 million registered accounts and documented peak active-user, timer, reminder, and notification workloads before those levels are marketed."),
    ("NFR-SCALE-03", "Hot paths", "Dashboard, due reminders, active timers, streak evaluation, and analytics aggregation shall avoid unbounded scans and N+1 access patterns."),
    ("NFR-SCALE-04", "Async work", "Exports, reports, AI reviews, imports, notifications, and aggregate rebuilds shall use durable, idempotent asynchronous jobs with backpressure and dead-letter handling."),
    ("NFR-REL-01", "Availability", "Core non-AI APIs shall target 99.9% monthly availability; AI and third-party integrations shall have separate SLOs and graceful degradation."),
    ("NFR-REL-02", "Recovery", "Production data services shall target RPO <= 15 minutes and RTO <= 4 hours, verified by scheduled restore exercises."),
    ("NFR-REL-03", "Idempotency", "Externally retried mutations, webhooks, job handlers, imports, calendar writes, rewards, and notifications shall be idempotent."),
    ("NFR-REL-04", "Offline conflicts", "Offline-capable writes shall carry client mutation IDs and base versions; conflicts shall merge only where semantics are safe and otherwise require review."),
    ("NFR-REL-05", "Degradation", "Failure of AI, analytics, news, external calendars, or push providers shall not make authentication, journal, notes, manual planning, timers, or local reminders unusable."),
    ("NFR-SEC-01", "Identity", "Web authentication shall use secure HttpOnly SameSite cookies or an equivalent threat-reviewed pattern; future native clients shall use standards-based authorization with PKCE and protected token storage."),
    ("NFR-SEC-02", "Credentials", "Passwords, if supported, shall use an approved adaptive password hash; secrets and refresh tokens shall never be stored or logged in plaintext."),
    ("NFR-SEC-03", "Authorization", "Deny-by-default RBAC plus ownership, consent, and resource policy checks shall be enforced at service boundaries and covered by negative tests."),
    ("NFR-SEC-04", "Application threats", "The implementation shall address the current OWASP application/API risks including injection, XSS, CSRF, SSRF, broken access control, unsafe file handling, and mass assignment."),
    ("NFR-SEC-05", "Encryption", "All network traffic shall use current approved TLS; production data, backups, exports, and secrets shall be encrypted at rest with managed key rotation."),
    ("NFR-SEC-06", "Rate limits", "Authentication, AI, search, imports, exports, reminders, and administrative endpoints shall have actor- and risk-aware quotas with non-disclosing errors."),
    ("NFR-SEC-07", "Session security", "Sessions shall support expiry, rotation, revocation, device listing, suspicious-use detection, and step-up authentication."),
    ("NFR-SEC-08", "Supply chain", "CI shall generate an SBOM, scan dependencies/containers/secrets, pin trusted actions, and block releases on defined critical vulnerabilities."),
    ("NFR-SEC-09", "Files and links", "Uploads shall be type/size validated, malware-scanned, stored outside executable paths, and served with safe content headers; URL fetches shall prevent SSRF."),
    ("NFR-SEC-10", "Third-party credentials", "Focused shall use OAuth or user-provided exports where available and shall not request or store passwords for third-party productivity or learning services."),
    ("NFR-SEC-11", "Audit", "Privileged and security-relevant events shall include actor, target, action, reason, result, time, origin, and correlation identifier with tamper-evident retention."),
    ("NFR-SEC-12", "Verification", "Threat modeling, SAST, DAST/API tests, dependency scanning, authorization tests, and periodic penetration testing shall be release controls proportional to risk."),
    ("NFR-PRIV-01", "Minimization", "Only data required for a declared purpose shall be collected; optional sensitive fields shall default empty."),
    ("NFR-PRIV-02", "Consent", "Consent shall be granular by purpose and data scope, versioned, revocable, and no harder to withdraw than to grant."),
    ("NFR-PRIV-03", "Retention", "Every data class shall have a documented retention/deletion policy including processors, caches, indexes, backups, and analytics."),
    ("NFR-PRIV-04", "Isolation", "Application, cache, search, analytics, object storage, and job layers shall preserve tenant/user isolation."),
    ("NFR-PRIV-05", "Logs", "Logs and telemetry shall exclude credentials and private bodies and shall pseudonymize identifiers where operationally sufficient."),
    ("NFR-PRIV-06", "Rights", "The platform shall provide authenticated access, correction, export, and deletion workflows and record their fulfillment state."),
    ("NFR-A11Y-01", "Conformance", "User-facing web experiences shall conform to WCAG 2.2 Level AA for supported workflows, verified by automated and manual testing."),
    ("NFR-A11Y-02", "Keyboard", "All functionality shall be keyboard operable with visible focus, logical order, no trap, skip navigation, and accessible shortcuts."),
    ("NFR-A11Y-03", "Semantics", "Controls, headings, landmarks, dialogs, tables, status, errors, and live updates shall expose correct accessible names, roles, relationships, and states."),
    ("NFR-A11Y-04", "Reflow", "Content shall reflow at 320 CSS px and 200% text zoom without loss of content or function except inherently two-dimensional data views."),
    ("NFR-A11Y-05", "Perception", "Status shall not rely on color, sound, or motion alone; contrast shall meet AA and dark/light themes shall be independently tested."),
    ("NFR-A11Y-06", "Motion and time", "Reduced motion shall be honored; timed interactions shall be adjustable, pausable, or exempt only for essential real-time semantics."),
    ("NFR-A11Y-07", "Errors", "Validation shall identify the field, describe the error, suggest correction, preserve valid input, and move/announce focus appropriately."),
    ("NFR-A11Y-08", "Documents", "Generated human-readable reports shall use headings, reading order, language metadata, tagged tables where supported, and descriptive link text."),
    ("NFR-I18N-01", "Localization", "User-visible strings, notification templates, dates, times, numbers, durations, pluralization, and relative time shall be externalized and locale-aware."),
    ("NFR-I18N-02", "RTL", "The design system shall support bidirectional text and right-to-left layout without mirroring semantic media or corrupting time/number meaning."),
    ("NFR-I18N-03", "Time zones", "Scheduling tests shall cover daylight-saving gaps/folds, travel, non-hour offsets, and configurable week starts."),
    ("NFR-UX-01", "Responsive design", "Core workflows shall support small mobile through large desktop layouts with touch targets, safe areas, and no hidden essential actions."),
    ("NFR-UX-02", "States", "Every asynchronous view shall define loading, empty, partial, success, validation, recoverable error, forbidden, offline, and stale states."),
    ("NFR-UX-03", "Themes", "Light, dark, and system themes shall be available without flashes, inaccessible contrast, or information loss."),
    ("NFR-UX-04", "Calm defaults", "Notification, dashboard, gamification, and AI surfaces shall use frequency caps, progressive disclosure, and user-controlled dismissal."),
    ("NFR-PWA-01", "Installability", "The web application shall meet supported-browser PWA installability requirements with a versioned manifest and service worker."),
    ("NFR-PWA-02", "Offline", "The app shall provide an offline shell, safe cached read access, explicit freshness, and queued writes for documented low-risk workflows."),
    ("NFR-PWA-03", "Updates", "Service-worker updates shall be atomic and announce refresh/reload needs without trapping a member on an incompatible client version."),
    ("NFR-PWA-04", "Push", "Web push shall be optional, permission-aware, unsubscribe-safe, and use expiring privacy-minimized payloads."),
    ("NFR-SEO-01", "Metadata", "Every public indexable page shall have unique title, description, canonical URL, social metadata, and appropriate structured data; authenticated pages shall be non-indexable."),
    ("NFR-SEO-02", "Rendering", "Public marketing/help content shall be server-rendered or statically generated where practical with a sitemap, robots policy, semantic headings, and stable URLs."),
    ("NFR-API-01", "REST", "Versioned APIs shall use resource-oriented URIs, standard methods/status codes, pagination, filtering, conditional requests, and consistent problem responses."),
    ("NFR-API-02", "Documentation", "An OpenAPI contract and examples shall be generated and validated in CI; breaking changes require a versioning and migration policy."),
    ("NFR-API-03", "Mobile readiness", "Business rules and authorization shall reside server-side; no web-only session assumption may prevent standards-based native clients."),
    ("NFR-DATA-01", "Integrity", "Transactional invariants, foreign keys where appropriate, unique constraints, optimistic concurrency, and idempotency records shall protect domain state."),
    ("NFR-DATA-02", "Migrations", "Schema migrations shall be forward-compatible with the active application window, observable, reversible where practical, and tested on production-like volume."),
    ("NFR-DATA-03", "Analytics separation", "Operational queries and analytical workloads shall be isolated sufficiently to protect transactional latency and privacy policy."),
    ("NFR-AI-01", "Provider abstraction", "Model and embedding providers shall be behind versioned interfaces so they can be changed without altering domain contracts."),
    ("NFR-AI-02", "Structured output", "AI outputs used by product logic shall be schema-validated, size-limited, policy-checked, and treated as untrusted input."),
    ("NFR-AI-03", "Evaluation", "Prompt/model changes shall pass versioned offline evaluations for grounding, safety, instruction adherence, refusal, privacy, latency, and cost before rollout."),
    ("NFR-AI-04", "Observability", "AI traces shall capture model/prompt version, latency, token/cost, tool calls, safety outcome, and feedback while redacting private content by default."),
    ("NFR-AI-05", "Fallback", "The product shall expose deterministic non-AI alternatives for core workflows and clear retry/cancel behavior for AI operations."),
    ("NFR-AI-06", "Prompt injection", "Retrieved and user-provided content shall be treated as data, isolated from privileged instructions, and unable to grant tools or change policy."),
    ("NFR-AI-07", "Action safety", "Every AI-proposed state change shall pass normal validation/authorization and policy-defined human approval at execution time."),
    ("NFR-AI-08", "Cost controls", "Per-user and system budgets, quotas, caching, model routing, and kill switches shall bound AI cost and runaway behavior."),
    ("NFR-AI-09", "Deletion", "AI conversations, embeddings, caches, evaluation samples, and provider-retained data shall participate in documented deletion and retention workflows."),
    ("NFR-AI-10", "Transparency", "AI surfaces shall identify AI-generated content, meaningful limitations, evidence scope, and how to report or correct harmful output."),
    ("NFR-OBS-01", "Telemetry", "Services shall emit structured logs, metrics, traces, and domain/business events with correlation identifiers and documented cardinality controls."),
    ("NFR-OBS-02", "Alerts", "SLOs shall have actionable alerts and runbooks for error rate, latency, queue lag, notification delivery, calendar sync, exports, and AI cost/safety."),
    ("NFR-QUAL-01", "Architecture", "Implementation shall use feature/domain boundaries, dependency inversion, small interfaces, and independently testable domain rules; shared code shall have an explicit owner and purpose."),
    ("NFR-QUAL-02", "Testing", "Each feature shall include unit, API/contract, authorization, persistence, UI interaction, accessibility, and relevant end-to-end tests, including negative and boundary cases."),
    ("NFR-QUAL-03", "Coverage", "Changed domain/application code shall target >= 90% branch coverage and overall maintained code >= 80%, without treating coverage as a substitute for behavior tests."),
    ("NFR-QUAL-04", "Static quality", "The default branch shall pass formatting, lint, type checking, tests, production build, secret/dependency scans, and the configured SonarQube quality gate with no blocker/critical issue."),
    ("NFR-DEVOPS-01", "CI", "GitHub Actions shall run lint, types, unit/integration tests, accessibility checks, build, OpenAPI validation, dependency/secret scans, and SonarQube scan on protected changes."),
    ("NFR-DEVOPS-02", "Deployment", "The web application shall be deployable to Vercel with reproducible environment configuration, preview deployments, protected production promotion, and rollback."),
    ("NFR-DEVOPS-03", "Environments", "Development, test, preview, staging where required, and production shall use separated secrets/data and documented configuration validation."),
    ("NFR-DEVOPS-04", "Release", "Database and worker compatibility shall be checked before promotion; release health shall be observed and rollback/roll-forward practiced."),
    ("NFR-MAINT-01", "Documentation", "Architecture decisions, domain glossary, API contract, data classification, runbooks, threat models, and feature behavior shall be version-controlled and updated with changes."),
    ("NFR-MAINT-02", "Compatibility", "Supported browser/client versions, deprecation windows, API compatibility, and data migration policy shall be published and tested."),
]


PERMISSIONS = [
    ("Public marketing/help", "R", "R", "R", "MC", "M", "AU", "-"),
    ("Register/sign in/recover", "C-own", "Own", "Meta", "-", "Cfg", "AU", "-"),
    ("Profile/settings/sessions", "-", "Own", "Meta+A", "-", "Policy", "AU", "-"),
    ("Plans/goals/calendar/focus", "-", "CRUD-own", "-", "-", "-", "-", "Scope"),
    ("Trackers/analytics/reports", "-", "CRUD-own", "-", "-", "-", "Agg-op", "Scope"),
    ("Journal/notes/life vision/reflection", "-", "CRUD-own", "-", "-", "-", "-", "Item grant"),
    ("Mood/sleep/workout/faith data", "-", "CRUD-own", "-", "-", "-", "-", "Scope"),
    ("AI conversations/reviews", "-", "CRUD-own", "-", "-", "Policy", "-", "Run scope"),
    ("Knowledge/news catalog", "R-public", "Own+R", "-", "MC", "M-policy", "AU", "Scope"),
    ("Notifications/reminders", "-", "CRUD-own", "Meta", "-", "Cfg", "AU", "Payload"),
    ("Gamification", "R-public", "Own", "-", "MC-deleg.", "M-rules", "AU", "Scope"),
    ("User status/support actions", "-", "Own req.", "A-bounded", "-", "A-policy", "AU", "-"),
    ("Roles/permissions", "-", "-", "-", "-", "M-deleg.", "AU", "-"),
    ("Feature flags/system config", "-", "-", "R-safe", "C-subset", "M", "R", "R-safe"),
    ("Audit logs", "-", "Own sec.", "Own A", "Own A", "R-auth", "R/export", "Append"),
]


SUCCESS_METRICS = [
    ("SM-01", "North star: Focused Days / WAU", "A Focused Day is a local date with an intentional daily plan plus at least one completed priority or qualifying focus session; report median and distribution, not only mean.", ">= 3.0 median by month 6 for activated weekly members", "Guardrail: no increase in excessive-session or notification-dismissal signals"),
    ("SM-02", "Activation", "New members who within 24 hours create a daily plan and complete or intentionally close one focus session.", ">= 55%", "Segment by accessibility mode, device, locale, and acquisition; no dark patterns"),
    ("SM-03", "Time to first focus", "Median time from verified first sign-in to starting the first intentional focus session.", "<= 5 minutes; <= 2 minutes for onboarding completers", "Do not force module setup"),
    ("SM-04", "Week-4 retained value", "Activated members with at least two Focused Days in week 4.", ">= 35%", "Track voluntary deletion and notification opt-out"),
    ("SM-05", "Plan realism", "Share of daily/weekly plans closed with explicit completion/defer/cancel decisions and decreasing involuntary carry-forward.", ">= 70% closed; trend carry-forward downward", "Never reward overcommitment"),
    ("SM-06", "Focus completion quality", "Completed qualifying focus sessions divided by started sessions, with abandon reason and duration distribution.", "Baseline then improve 10% relative", "Guardrail: median session and break behavior remain healthy"),
    ("SM-07", "Reminder usefulness", "Completed/acted reminders divided by delivered reminders, plus snooze, dismiss, mute, and complaint rates.", ">= 35% acted; < 2% category mute per week", "Respect quiet hours >= 99.99%"),
    ("SM-08", "AI grounded usefulness", "Accepted or positively rated AI suggestions that pass evidence-grounding evaluation.", ">= 45% accepted/helpful; >= 95% grounding pass on eval set", "Track harmful-output and unconfirmed-action rate; target zero confirmed safety breach"),
    ("SM-09", "Review completion", "Members opening and intentionally completing daily/weekly review among those who enabled it.", ">= 40% weekly", "Keep review under member-selected time budget"),
    ("SM-10", "Accessibility parity", "Difference in activation and critical-task success between assistive-technology cohorts and overall cohort.", "Absolute gap < 5 percentage points", "Zero critical WCAG blocker in release"),
    ("SM-11", "Reliability", "Core API availability, p95 latency, timer reconciliation error, reminder duplicate rate, and job backlog SLOs.", "Meet NFR SLOs; duplicate deliveries < 0.01%", "Error budgets drive release policy"),
    ("SM-12", "Privacy and security", "Confirmed unauthorized disclosures, privilege violations, secret leaks, and overdue deletion/export requests.", "Zero severe incident; >= 99% requests within policy SLA", "Publish internal incident learning and corrective actions"),
    ("SM-13", "Export portability", "Successful exports with valid manifest and schema divided by export requests.", ">= 99% excluding user cancellation", "Expired artifacts cannot be retrieved"),
    ("SM-14", "Performance", "Core Web Vitals pass rate and API SLO compliance by device/region.", ">= 75% good CWV; >= 99% API SLO windows", "No accessibility regression from performance work"),
]


RISKS = [
    ("R-01", "Scope overload creates a cluttered product and delayed value", "High", "Critical", "Progressive disclosure, module opt-in, P0 focus loop, feature flags, strict release gates", "Activation falls or navigation depth grows"),
    ("R-02", "AI advice is generic, wrong, unsafe, or over-authoritative", "High", "Critical", "Evidence grounding, evals, uncertainty labels, bounded domains, feedback, human approval", "Grounding/safety eval regression or harmful report"),
    ("R-03", "Sensitive journal, mood, faith, sleep, or coaching data is exposed", "Medium", "Critical", "Classification, least privilege, encryption, no-admin-content boundary, DLP, audits, threat models", "Unauthorized access test or incident signal"),
    ("R-04", "Gamification drives compulsive or unhealthy behavior", "Medium", "High", "Opt-out, no penalties for rest/sensitive behavior, caps, no public ranking, wellbeing review", "Excessive-session distribution or complaint spike"),
    ("R-05", "Notification fatigue causes churn or OS-level blocking", "High", "High", "Quiet hours, category controls, batching, frequency caps, usefulness metrics", "Mute/dismiss/permission-revoke thresholds"),
    ("R-06", "Time zones, DST, recurrence, or offline sync corrupt plans and reminders", "High", "High", "Canonical time model, occurrence keys, property tests, conflict UI, reconciliation jobs", "Duplicate/missed reminder or date-shift defect"),
    ("R-07", "Third-party providers fail, change terms, or remove access", "High", "Medium", "Adapter boundaries, manual fallback, licensed sources, health checks, user-visible sync state", "Provider error budget or policy notice"),
    ("R-08", "Metric definitions mislead users or change historical meaning", "Medium", "High", "Versioned metric catalog, fixtures, provenance, snapshot reports, analytics owner", "Metric discrepancy or unexplained dashboard jump"),
    ("R-09", "Vercel/serverless constraints conflict with timers, queues, or long AI jobs", "Medium", "High", "Separate durable workers/queues, async APIs, runtime budgets, deployment ADR", "Timeouts, queue lag, or regional limit"),
    ("R-10", "AI inference and retrieval costs become unsustainable", "High", "High", "Budgets, routing, caching, smaller models, quotas, batch reviews, kill switches", "Cost per WAU exceeds unit target"),
    ("R-11", "Search or embeddings leak unauthorized snippets", "Medium", "Critical", "Authorization-aware indexing/querying, tombstones, isolation tests, private semantic opt-in", "Canary record appears cross-account"),
    ("R-12", "Faith or wellbeing features make harmful authority claims", "Medium", "High", "Configurable methods, source disclosure, non-medical/non-religious boundaries, domain review", "Complaint, safety review, or content audit failure"),
    ("R-13", "Offline behavior creates silent conflicts or false completion", "High", "Medium", "Documented offline matrix, client IDs/base versions, merge copies, stale indicators", "Conflict-loss telemetry or support report"),
    ("R-14", "Admin tools accumulate excessive privilege", "Medium", "Critical", "Role separation, MFA, step-up, reason codes, no-content boundary, dual control, audits", "Privilege review or anomalous admin access"),
    ("R-15", "Premature microservices or abstraction slows delivery", "Medium", "Medium", "Modular monolith first, measurable extraction criteria, ADRs, domain ownership", "Cross-service change amplification"),
    ("R-16", "Data model cannot support future mobile and agent clients", "Medium", "High", "Server-owned rules, REST/OpenAPI, versioning, idempotency, event semantics", "Web-only rule or breaking client contract"),
    ("R-17", "Technology news/recommendations create copyright, bias, or low-quality issues", "Medium", "Medium", "Licensed feeds, provenance, source diversity, curation, report controls", "Takedown, duplicate rate, or source concentration"),
    ("R-18", "Accessibility regresses as feature count grows", "High", "High", "Accessible design system, automated/manual gates, AT testing, parity metrics", "Critical audit failure or parity gap"),
]


FUTURE_SCOPE = [
    ("FS-01", "Native mobile applications", "iOS/Android clients using the same versioned REST APIs, auth standards, sync semantics, and push preference model."),
    ("FS-02", "Wearables and health platforms", "Optional imports from platform health stores with strict provenance, consent, and non-medical boundaries."),
    ("FS-03", "Desktop focus controls", "OS-supported app/site blocking through transparent, revocable local agents; no covert surveillance."),
    ("FS-04", "Teams and accountability", "Explicit shared workspaces, coaches, accountability partners, and granular sharing—not implicit access to personal workspaces."),
    ("FS-05", "Coach/mentor marketplace", "Verified human professionals with consented data views, safety policy, billing boundaries, and member-controlled revocation."),
    ("FS-06", "Bounded AI agents", "Durable multi-step agents defined by FR-AGENT with capability grants, approvals, budgets, and complete run audit."),
    ("FS-07", "Voice and multimodal capture", "Accessible voice notes, image/document capture, and transcription with on-device or consented processing options."),
    ("FS-08", "Advanced causal experiments", "N-of-1 experiments and statistical guidance that clearly distinguish association from causation and require adequate samples."),
    ("FS-09", "Personal knowledge graph", "User-controlled typed relationships, semantic retrieval, and portable graph export with private indexing controls."),
    ("FS-10", "Extension and integration platform", "OAuth apps, webhooks, API keys/service accounts, rate limits, scopes, review, and developer documentation."),
    ("FS-11", "Enterprise readiness", "SSO, SCIM, data residency, customer-managed keys, audit exports, policy controls, and contractual compliance after a separate requirements phase."),
    ("FS-12", "Advanced localization", "Additional languages, regional calendars, richer RTL QA, localized safety resources, and translator governance."),
]


TRACEABILITY = [
    ("Foundation", "AUTH, ONB, DASH, PROF, SET, LANG, A11Y", "US-001, US-014, US-024..029", "UC-10, UC-11", "PG-01, PG-07..10; SM-02, SM-10..12, SM-14"),
    ("Focus execution", "DAILY, DEEP, POMO", "US-001..003, US-029", "UC-01, UC-02", "PG-01..03; SM-01, SM-03, SM-05, SM-06"),
    ("Planning", "GOAL, VISION, WEEKPLAN, MONTHPLAN, YEARPLAN, CAL, SMARTSCHED", "US-004, US-005, US-020", "UC-03", "PG-04; SM-05"),
    ("Tracking", "HABIT, LEARN, PROG, LC, READ", "US-006..008, US-011", "UC-04, UC-07", "PG-03, PG-05; SM-04"),
    ("Faith/wellbeing/reflection", "QURAN, PRAYER, WORKOUT, SLEEP, JOURNAL, REFLECT, MOOD", "US-009..013, US-021", "UC-06", "PG-03, PG-07, PG-08; SM-12"),
    ("AI guidance", "AICOACH, AIMENTOR, AIDAILY, AIWEEK, AIMONTH, AISUGG", "US-008, US-019..021", "UC-05", "PG-06, PG-07; SM-08, SM-09"),
    ("Knowledge", "KHUB, NEWS, LRECO, NOTES, BOOK, RES, SEARCH", "US-006, US-022", "UC-06, UC-07", "PG-05, PG-09; SM-04"),
    ("Analytics", "FANL, DANL, REPORT, EXPORT", "US-016, US-017, US-028", "UC-09", "PG-05, PG-09; SM-06, SM-13"),
    ("Gamification", "ACH, XP, LEVEL, STREAK, GAME, CHALL", "US-011, US-015, US-023", "UC-04", "PG-03, PG-08; guardrail metrics"),
    ("Engagement", "NOTIF, REM, AIREM", "US-018", "UC-08", "PG-01, PG-08; SM-07, SM-11"),
    ("Administration/future", "ADMIN, AGENT", "US-024, US-025, US-030", "UC-11, UC-12", "PG-07, PG-09, PG-10; SM-11, SM-12"),
]


def release_for(priority: str) -> str:
    return {
        "P0": "Release 1 - Core FocusOS",
        "P1": "Release 2 - Integrated Growth",
        "P2": "Release 3 - Expansion",
        "P3": "Research / post-validation",
    }[priority]


def build_specification() -> Specification:
    d = Specification()
    d.p("SOFTWARE REQUIREMENTS SPECIFICATION")
    d.title("Focused")
    d.subtitle("A complete Focus Operating System (FocusOS)")
    d.kv("Document ID", "FOCUSED-SRS-001")
    d.kv("Version", "1.0 Baseline Candidate")
    d.kv("Status", "Proposed - requires product, engineering, security, privacy, accessibility, and domain review")
    d.kv("Date", "31 July 2026")
    d.kv("Standard alignment", "IEEE-style structure adapted to ISO/IEC/IEEE 29148:2018; uniquely identified, verifiable 'shall' requirements")
    d.kv("Intended audience", "Product, design, engineering, QA, AI safety, security, privacy, accessibility, operations, and executive stakeholders")
    d.p("Focused is not a habit tracker with extra modules. It is a personal operating system for choosing what matters, protecting attention, executing deliberately, learning from evidence, and improving sustainably with an AI coach that remains under the user's control.")
    d.pagebreak()

    d.h(1, "Document Control")
    d.table(["Version", "Date", "Status", "Summary"], [
        ("0.1", "31 July 2026", "Draft", "Initial complete SRS covering product, functional, quality, safety, and operational requirements."),
        ("1.0", "TBD", "Approved baseline", "Requires sign-off and resolution of open product/legal decisions."),
    ], [900, 1400, 1800, 5260])
    d.kv("Approval rule", "A requirement becomes Baseline only after named product and engineering approvers accept it; security/privacy/accessibility requirements also require their accountable reviewers.")
    d.kv("Change control", "After baseline, material requirement changes use a traceable proposal stating rationale, affected IDs, migration/compatibility impact, risk, acceptance-test changes, and approval.")
    d.kv("Requirement states", "Proposed, Baseline, Implemented, Verified, Deferred, Deprecated, Rejected. 'Deferred' never means silently omitted.")
    d.h(2, "Contents")
    for item in [
        "1. Introduction and Conventions", "2. Vision and Product Goals", "3. Stakeholders and User Personas",
        "4. Product Scope and Overall Description", "5. System Context, Interfaces, Data, and Architecture Constraints",
        "6. Functional Requirements and Feature Acceptance Criteria", "7. User Stories", "8. Use Cases",
        "9. Business Rules", "10. Non-functional Requirements", "11. Permission Matrix",
        "12. Feature Priorities and Release Strategy", "13. Success Metrics", "14. Risks and Mitigations",
        "15. Future Scope", "Appendix A. Traceability", "Appendix B. Glossary and Open Decisions",
    ]:
        d.bullet(item)

    d.h(1, "1. Introduction and Conventions")
    d.h(2, "1.1 Purpose")
    d.p("This Software Requirements Specification defines the externally observable behavior, quality attributes, constraints, safety boundaries, and acceptance basis for Focused. It is intentionally technology-aware but implementation-neutral: architecture choices may evolve if they continue to satisfy every applicable requirement and business rule.")
    d.h(2, "1.2 Normative Language")
    d.bullet("Shall denotes a mandatory, testable requirement for the stated scope.")
    d.bullet("Should denotes a recommended decision that may be changed through an explicit trade-off record.")
    d.bullet("May denotes a permitted option. Must not denotes a prohibited behavior.")
    d.bullet("Given/When/Then criteria are acceptance examples, not substitutes for negative, boundary, accessibility, security, and performance testing.")
    d.h(2, "1.3 Reference Model")
    d.p("The organization follows the requirements-engineering intent of ISO/IEC/IEEE 29148:2018, which is currently an active IEEE standard; a successor project is in progress. This SRS does not reproduce the standard. It applies its principles of necessary, implementation-feasible, unambiguous, singular, verifiable, traceable, and maintainable requirements.")
    d.bullet("IEEE/ISO/IEC 29148-2018: https://standards.ieee.org/ieee/802.1Q/6937/")
    d.bullet("ISO record for ISO/IEC/IEEE 29148:2018: https://www.iso.org/standard/72089.html")
    d.bullet("IETF RFC 9457, Problem Details for HTTP APIs: https://www.rfc-editor.org/rfc/rfc9457")
    d.bullet("W3C Web Content Accessibility Guidelines (WCAG) 2.2: https://www.w3.org/TR/WCAG22/")
    d.h(2, "1.4 Scope of this Baseline")
    d.p(f"The baseline specifies {len(FEATURES)} named capabilities, including every feature requested by the sponsor plus the foundational authentication, onboarding, unified-search, privacy, and operating requirements required to make them production-ready.")
    d.h(2, "1.5 Assumptions")
    for item in [
        "The initial product is a personal workspace: one member owns each personal object. Team collaboration requires a separate sharing/tenancy requirements phase.",
        "Core planning and tracking work without AI. AI is optional, provider-neutral, consent-based, and can propose but not silently perform material mutations.",
        "No paid/free subscription entitlements are assumed. Priority and access are product/release concerns, not hidden monetization rules.",
        "The web application is the first client and is deployable on Vercel; durable queues/workers or data services may run on compatible managed infrastructure where serverless execution limits require it.",
        "Future mobile applications consume the same versioned REST domain APIs and standards-based authentication; business rules are not embedded only in the web client.",
        "Third-party integrations use authorized APIs, licensed feeds, or user-supplied files. Protected-page scraping and third-party password collection are prohibited.",
        "Prayer calculation and Quran reference behavior are configurable and source-disclosed. The product is a tracking aid, not a religious authority.",
        "Mood, sleep, workout, and related insights are self-improvement aids and not medical devices, diagnosis, treatment, or emergency services.",
    ]:
        d.bullet(item)
    d.h(2, "1.6 Explicit Exclusions for Initial Releases")
    for item in [
        "Public social network, public leaderboards, competitive prayer/Quran/mood/sleep ranking, wagering, or monetary gamification.",
        "Autonomous AI writes without review, unrestricted agents, purchases, external communication, or agents that can expand their own permissions.",
        "Employer/school surveillance, covert app/keystroke/browser/microphone/camera monitoring, or productivity scoring for eligibility decisions.",
        "Clinical diagnosis, treatment, emergency response, religious rulings, legal advice, or financial advice.",
        "Team/enterprise tenancy, billing plans, marketplace commerce, and human-coach access until separately specified.",
    ]:
        d.bullet(item)

    d.pagebreak()
    d.h(1, "2. Vision and Product Goals")
    d.h(2, "2.1 Vision")
    d.p("Focused gives each person a calm, private, and adaptive FocusOS: a place to define a meaningful direction, convert it into realistic commitments, protect attention, execute deep work, observe friction without judgment, and continuously improve with evidence. AI behaves like a trustworthy coach available at any time—not an authority, surveillance system, or engagement engine.")
    d.h(2, "2.2 Product Principles")
    for item in [
        "Focus before features: the next meaningful action is visually dominant; secondary modules remain progressively disclosed.",
        "Agency before automation: the member understands and confirms material changes.",
        "Psychological safety before streak preservation: recovery, rest, and changed capacity are legitimate states.",
        "Evidence before claims: analytics and AI disclose source, freshness, definition, uncertainty, and missing data.",
        "Privacy before personalization: optional sensitive context stays excluded until purpose-specific consent is granted.",
        "Accessible by construction: keyboard, assistive technology, reflow, contrast, reduced motion, localization, and theme behavior are acceptance requirements.",
        "Simple domain contracts: clear ownership, REST resources, idempotency, versioning, and explicit state machines enable scale and future clients.",
    ]:
        d.bullet(item)
    d.h(2, "2.3 Product Goals")
    d.table(["ID", "Goal", "Measurable intent"], PRODUCT_GOALS, [900, 2400, 6060])

    d.pagebreak()
    d.h(1, "3. Stakeholders and User Personas")
    d.h(2, "3.1 Stakeholders")
    d.bullet("Primary: members using Focused to plan, focus, learn, reflect, and track selected domains.")
    d.bullet("Operational: support administrators, platform administrators, content curators, auditors, incident responders, and SRE/DevOps.")
    d.bullet("Delivery: product, design, web/mobile/backend/data/AI engineering, quality, security, privacy, accessibility, localization, and technical writing.")
    d.bullet("External: identity, AI, notification, calendar, news/content, storage, analytics, and hosting providers governed by contracts and adapters.")
    d.h(2, "3.2 Personas")
    d.table(["ID", "Persona", "Goals and context", "Primary risks"], PERSONAS, [750, 1850, 3900, 2860])

    d.pagebreak()
    d.h(1, "4. Product Scope and Overall Description")
    d.h(2, "4.1 Product Perspective")
    d.p("Focused is a modular personal productivity platform whose core loop is Direction -> Plan -> Focus -> Observe -> Reflect -> Adapt. Feature domains share identity, authorization, time, notification, search, analytics, AI orchestration, audit, and export platform capabilities without sharing private data implicitly.")
    d.h(2, "4.2 Core Product Loop")
    for item in [
        "Direction: articulate life vision, values, goals, annual themes, and desired evidence.",
        "Plan: select realistic monthly, weekly, and daily outcomes around calendar constraints and capacity.",
        "Focus: execute with deep-work or Pomodoro timers, a visible intent, and optional distraction controls.",
        "Observe: record outcomes, interruptions, habits, learning, and selected wellbeing/faith signals.",
        "Reflect: conduct human-authored or AI-assisted reviews that link observations to evidence.",
        "Adapt: confirm a small experiment, schedule change, goal revision, or reminder—and begin again.",
    ]:
        d.number(item)
    d.h(2, "4.3 Domain Boundaries")
    d.table(["Domain", "Responsibilities", "Owns"], [
        ("Identity and Preferences", "Authentication, sessions, profile, locale, consent, accessibility, notification settings", "User, Session, Consent, Preference"),
        ("Planning", "Vision, goals, yearly/monthly/weekly/daily plans, calendar, scheduling", "Plan, Goal, Milestone, TimeBlock"),
        ("Focus", "Deep work, Pomodoro, intent, interruption capture", "FocusSession, Cycle, Interruption"),
        ("Tracking", "Habits, learning, programming, reading, faith, workout, sleep, mood", "Typed tracker definitions and entries"),
        ("Reflection and Knowledge", "Journal, reflection, notes, bookmarks, resources, search", "Private documents, links, indexes"),
        ("AI Guidance", "Context grants, conversations, reviews, suggestions, proposals", "AI run/review artifacts; never source-of-truth domain state"),
        ("Analytics and Reports", "Definitions, aggregates, snapshots, exports", "Metric definitions, snapshots, export jobs"),
        ("Engagement and Gamification", "Reminders, notifications, achievements, XP, levels, streaks, challenges", "Occurrence/delivery/reward ledgers"),
        ("Administration", "Operational roles, configuration, audit, safe support workflows", "Admin policy/configuration and audit events"),
    ], [1900, 4800, 2660])
    d.h(2, "4.4 Operating Environment")
    d.bullet("Responsive standards-based web application with installable PWA behavior on supported evergreen browsers.")
    d.bullet("REST API under a versioned base path such as /api/v1, independently consumable by future native clients.")
    d.bullet("Managed relational transactional storage; object storage for attachments/exports; cache and durable job/queue infrastructure; search/index capability; analytics store when scale requires separation.")
    d.bullet("Vercel-compatible web deployment with environment-separated managed backend dependencies and asynchronous workers where execution duration/durability demands them.")

    d.pagebreak()
    d.h(1, "5. System Context, Interfaces, Data, and Architecture Constraints")
    d.h(2, "5.1 Logical Architecture")
    d.p("The recommended starting architecture is a modular monolith with explicit feature/domain modules, a separate durable worker process, and event-driven integration at domain boundaries. This minimizes premature distributed complexity while preserving extraction seams. A module owns its domain model, application use cases, REST contract, persistence adapter, authorization policy, events, UI feature slice, and tests. Dependencies point inward toward domain/application contracts; infrastructure adapters implement those contracts.")
    d.bullet("Presentation: responsive web/PWA, route metadata, accessible design system, local cache, sync coordinator, generated API client.")
    d.bullet("Application: use cases, commands/queries, validation, authorization orchestration, idempotency, transactions, domain-event publication.")
    d.bullet("Domain: entities, value objects, invariants, policies, state machines, calculation definitions; no framework or transport dependency.")
    d.bullet("Infrastructure: relational repositories, object storage, cache, queue, search, calendar/news/AI/notification adapters, observability.")
    d.bullet("Extraction rule: create a service only when independent scaling, data isolation, reliability, ownership, or deployment evidence outweighs distributed-system cost.")
    d.h(2, "5.2 REST API Conventions")
    for item in [
        "Resource-oriented nouns; standard HTTP methods/status codes; JSON over TLS; UTC instants plus IANA time-zone context.",
        "Cursor pagination for unbounded collections; explicit sort/filter fields; bounded limits; sparse/expansion semantics only when documented.",
        "RFC 9457-compatible problem details with stable error code, status, human message, field errors, correlation ID, and safe remediation hints.",
        "Idempotency-Key or client mutation ID for retryable creates/commands; optimistic concurrency through ETag/If-Match or explicit version.",
        "OpenAPI contract generated and validated in CI, with security schemes, schemas, examples, errors, deprecations, and changelog.",
        "No business rule relies exclusively on hidden client behavior. Authorization and validation are repeated at the trusted server boundary.",
    ]:
        d.bullet(item)
    d.h(2, "5.3 External Interfaces")
    d.table(["Interface", "Minimum contract", "Failure/degradation"], [
        ("Identity provider", "OIDC/OAuth where federated; verified subjects; secure callback/state/nonce; revocation", "Local session controls and safe retry; no account enumeration"),
        ("AI provider(s)", "Streaming/chat/structured output/embeddings behind provider-neutral adapters; data-use controls", "Cancel, retry, alternate model, deterministic non-AI workflow"),
        ("Calendar provider", "OAuth scopes, incremental sync, free/busy, event write, webhook verification", "Read-only/stale disclosure, manual planning, retry queue"),
        ("Push/email", "Consent, locale template, endpoint lifecycle, acknowledgement, bounce/expiry feedback", "In-app center and retry policy; no unapproved fallback"),
        ("News/resources", "Licensed/publicly permitted feed or API, canonical URL, source/freshness/licensing metadata", "Empty/source-unavailable state; cached provenance"),
        ("Learning/coding imports", "User file or authorized integration with preview, schema, provenance, reversal", "Partial result and retry; no scraping or password capture"),
        ("Observability/security", "Metrics, traces, logs, alerting, error tracking, audit sink, vulnerability/secret scanning", "Privacy-safe buffering and fail-closed policy for critical admin audit"),
    ], [1900, 4300, 3160])
    d.h(2, "5.4 Data Classification")
    d.table(["Class", "Examples", "Controls"], [
        ("Restricted", "Credentials, tokens, recovery secrets, encryption keys", "Dedicated secret/token controls; never logs/analytics/AI"),
        ("Highly sensitive private", "Journal, mood notes, life vision, prayer/Quran logs, sleep/body data, AI conversations", "Private default, strict scopes, no routine admin content, explicit AI/report inclusion"),
        ("Private productivity", "Goals, plans, tasks, focus sessions, habits, learning, notes, bookmarks", "Owner isolation, purpose limitation, controlled export/search/AI scopes"),
        ("Operational personal", "Email, profile, sessions, locale, notification endpoint", "Minimization, encryption, role-limited support metadata"),
        ("Platform operational", "Audit events, system metrics, feature flags, curated source config", "Role separation, tamper resistance, retention, redaction"),
        ("Public", "Marketing/help content and explicitly public catalog metadata", "Integrity, provenance, SEO, accessibility, content safety"),
    ], [1900, 3500, 3960])
    d.h(2, "5.5 Common UI State Contract")
    d.p("Every feature is subject to the following acceptance contract in addition to its feature-specific criteria.")
    cross = [
        ("AC-CROSS-01", "Loading", "Show a non-blocking skeleton or progress indicator that preserves layout and exposes an accessible status; prevent duplicate submission while a mutation is unresolved."),
        ("AC-CROSS-02", "Empty", "Explain why no data exists, what value the feature provides, and one safe primary action; absence is never rendered as zero success or failure."),
        ("AC-CROSS-03", "Error", "Preserve valid input, show an actionable non-sensitive error with correlation ID where useful, and offer retry/cancel/support as appropriate."),
        ("AC-CROSS-04", "Partial/stale", "Label stale or partially unavailable data, its as-of time, and excluded sources; never silently substitute zero or fabricated content."),
        ("AC-CROSS-05", "Offline", "Expose offline state and last sync. Queue only documented low-risk idempotent writes; otherwise offer read-only or local draft behavior."),
        ("AC-CROSS-06", "Authorization", "Forbidden and not-found behavior does not reveal existence. Ownership/role/consent is enforced by the API, not only hidden in UI."),
        ("AC-CROSS-07", "Accessibility", "Keyboard, screen reader, zoom/reflow, contrast, focus, reduced motion, and non-color/non-audio alternatives pass the defined critical workflow tests."),
        ("AC-CROSS-08", "Responsive/theme", "The workflow remains complete on supported small/large viewports in light, dark, and system themes with no hidden essential action."),
        ("AC-CROSS-09", "Telemetry/privacy", "Product and technical events use documented schemas, avoid private content, honor consent, and carry correlation without uncontrolled high-cardinality fields."),
        ("AC-CROSS-10", "Testing", "Unit, API/contract, authorization, persistence, UI, accessibility, edge, and relevant end-to-end tests pass before the feature is considered verified."),
    ]
    d.table(["ID", "State/concern", "Acceptance contract"], cross, [1300, 1600, 6460])

    d.pagebreak()
    d.h(1, "6. Functional Requirements and Feature Acceptance Criteria")
    d.p("Feature IDs and requirement IDs are stable traceability keys. Each feature definition covers purpose, actors, architecture/data ownership, REST surface, functional requirements, validation/edge/privacy constraints, and detailed acceptance criteria. Shared platform behavior in Section 5.5 applies to every feature.")
    current_group = None
    group_index = 0
    feature_index = 0
    for feature in FEATURES:
        if feature.group != current_group:
            current_group = feature.group
            group_index += 1
            feature_index = 0
            d.h(2, f"6.{group_index} {current_group}")
        feature_index += 1
        d.h(3, f"6.{group_index}.{feature_index} {feature.name} [{feature.code}]")
        d.kv("Purpose", feature.purpose)
        d.kv("Actors", feature.actors)
        d.kv("Priority and release", f"{feature.priority}; {release_for(feature.priority)}")
        d.kv("Architecture and data ownership", f"Feature module owns {feature.entities}. Cross-domain references use stable identifiers/events rather than shared-table mutation; source domains remain authoritative.")
        d.kv("REST API surface", feature.api)
        d.kv("Validation", feature.validation)
        d.kv("Edge cases", feature.edge)
        d.kv("Security and privacy", feature.privacy)
        d.p("Functional requirements")
        for i, action in enumerate(feature.actions, 1):
            d.bullet(f"FR-{feature.code}-{i:03d} - The system shall enable an authorized actor to {action}.")
        d.p("Acceptance criteria")
        d.bullet(f"AC-{feature.code}-01 - Given an authorized actor and valid input, when the actor requests to {feature.actions[0]}, then the API returns the documented success representation, persists exactly one valid state transition, and the UI renders the confirmed state without a full-page dependency.")
        d.bullet(f"AC-{feature.code}-02 - Given the feature's prerequisite state, when the actor requests to {feature.actions[1]}, then authorization and domain invariants are evaluated on the server, the result records required provenance/version metadata, and derived views become consistent within the documented freshness window.")
        d.bullet(f"AC-{feature.code}-03 - Given any required supporting data or integration is available, when the actor requests to {feature.actions[2]}, then the system exposes completion/partial/failure status, performs no undisclosed secondary mutation, and offers a reversible next action where reversal is meaningful.")
        d.bullet(f"AC-{feature.code}-04 - Given invalid, stale, conflicting, duplicated, or replayed input, the system enforces: {feature.validation} It returns a stable problem code and field/action guidance, makes no partial unauthorized change, and idempotently returns the prior result when the same mutation key is retried.")
        d.bullet(f"AC-{feature.code}-05 - Given an empty, offline, partially synchronized, or dependency-failure state, the feature satisfies AC-CROSS-01 through AC-CROSS-05 and explicitly covers these cases: {feature.edge}")
        d.bullet(f"AC-{feature.code}-06 - Given keyboard, screen-reader, 200% text zoom, reduced-motion, light/dark theme, small-screen, and unauthorized-access tests, the workflow remains complete, understandable, and private; specifically: {feature.privacy}")

    d.pagebreak()
    d.h(1, "7. User Stories")
    d.p("Stories express user value and are traceability aids. Acceptance is governed by the linked functional, business, and quality requirements, not by the story sentence alone.")
    d.table(["ID", "Persona", "Story", "Feature links"], USER_STORIES, [900, 900, 6060, 1500])

    d.pagebreak()
    d.h(1, "8. Use Cases")
    for uc in USE_CASES:
        d.h(2, f"{uc['id']} - {uc['name']}")
        d.kv("Primary actor", uc["actor"])
        d.kv("Preconditions", uc["pre"])
        d.kv("Trigger", uc["trigger"])
        d.p("Main success scenario")
        for step in uc["main"]:
            d.number(step)
        d.p("Alternative and exception flows")
        for step in uc["alt"]:
            d.bullet(step)
        d.kv("Postconditions", uc["post"])
        d.kv("Traceability", uc["links"])

    d.pagebreak()
    d.h(1, "9. Business Rules")
    d.p("Business rules are stable policies shared by multiple features. A feature requirement may tighten a rule but may not silently contradict it.")
    d.table(["ID", "Rule", "Definition"], BUSINESS_RULES, [1100, 1900, 6360])

    d.pagebreak()
    d.h(1, "10. Non-functional Requirements")
    d.p("Quality requirements apply to all relevant features and environments. Targets are release gates unless an approved exception records scope, evidence, owner, expiry, mitigation, and rollback.")
    d.table(["ID", "Quality area", "Requirement"], NFRS, [1450, 1750, 6160])

    d.pagebreak()
    d.h(1, "11. Permission Matrix")
    d.p("Legend: - = no capability; R = read; C = create; CRUD = create/read/update/delete; Own = member-owned only; Meta = minimum operational metadata; A = bounded action; M = manage; MC = manage curated catalog; Cfg = configuration; AU = audit; Scope = explicit context/capability grant; Agg-op = aggregate platform operations only. Suffixes qualify scope. All checks are server-side and deny by default. UI visibility is not authorization.")
    d.table(["Capability", "V", "M", "S", "C", "PA", "AU", "AI"], PERMISSIONS,
            [2600, 800, 900, 900, 900, 1100, 900, 1260])
    d.h(2, "11.1 Role Definitions")
    for item in [
        "Visitor: unauthenticated user with public content and identity-entry flows only.",
        "Member: authenticated owner of a personal Focused workspace.",
        "Support Administrator: limited operational metadata and documented reason-coded support actions; no private content.",
        "Content Curator: manages platform news/resource/translation/challenge catalog content; no member-private content.",
        "Platform Administrator: manages roles, policies, flags, and operational configuration under MFA, step-up, delegation, and audit controls.",
        "Auditor: read-only access to authorized audit/configuration evidence, not member-private content.",
        "AI Service Principal: non-human, run-scoped capability to process only the member-selected context and return proposals/output; cannot self-authorize.",
    ]:
        d.bullet(item)

    d.pagebreak()
    d.h(1, "12. Feature Priorities and Release Strategy")
    d.h(2, "12.1 Priority Definitions")
    d.table(["Priority", "Meaning", "Release intent"], [
        ("P0 Must", "Required to deliver a secure, coherent FocusOS core and operate it safely.", "Release 1 - identity, daily focus, goals/weekly planning, timers, core habits/journal/reflection, notifications/reminders, core AI review/coach, analytics, admin."),
        ("P1 Should", "High value after the core loop is proven; integrates planning, tracking, knowledge, accessibility/localization depth, and optional motivation.", "Release 2 - integrated growth."),
        ("P2 Could", "Valuable expansion whose absence does not break the core promise.", "Release 3 after product/safety/data validation."),
        ("P3 Research", "Architecture-ready but not authorized for general release without a dedicated safety and product baseline.", "Post-validation agent research."),
    ], [1100, 4000, 4260])
    d.h(2, "12.2 Feature Priority Register")
    priority_rows = [(f.code, f.name, f.group, f.priority, release_for(f.priority)) for f in FEATURES]
    d.table(["Code", "Feature", "Domain", "Priority", "Planned wave"], priority_rows, [1500, 2500, 1800, 800, 2760])
    d.h(2, "12.3 Release Gates")
    for item in [
        "Product: validated problem/outcome, explicit non-goals, instrumentation, documented states and content design.",
        "Architecture: approved domain/API/data/security design, migration/rollback, capacity model, and operational ownership.",
        "Quality: tests required by NFR-QUAL-02, performance budgets, accessibility review, localization readiness, and no unresolved blocker/critical SonarQube issue.",
        "Security/privacy: threat model, data classification, consent/retention/deletion behavior, authorization negatives, dependency/secret scans, and incident/runbook readiness.",
        "AI: eval dataset/results, prompt/model version, grounding/safety/privacy/cost thresholds, fallbacks, kill switch, and action approval tests.",
        "Operations: dashboards, alerts, SLO/error budget, queue/provider failure drills, backup/restore evidence, and deployment rollback.",
    ]:
        d.bullet(item)

    d.pagebreak()
    d.h(1, "13. Success Metrics")
    d.p("Metrics are decision tools, not user scores. Each has a versioned definition, owner, source, inclusion rules, privacy review, and guardrail. Cohort metrics must be reported with sufficient sample size and without exposing individuals.")
    d.table(["ID", "Metric", "Definition", "Initial target", "Guardrail"], SUCCESS_METRICS, [850, 1800, 3200, 1500, 2010])

    d.pagebreak()
    d.h(1, "14. Risks and Mitigations")
    d.table(["ID", "Risk", "Likelihood", "Impact", "Primary mitigation", "Trigger"], RISKS, [650, 2400, 850, 850, 3300, 1310])
    d.h(2, "14.1 Risk Governance")
    d.p("Every high/critical risk requires an accountable owner, measurable leading indicator, review cadence, mitigation status, accepted residual risk, and escalation path. A security/privacy/safety risk cannot be accepted solely by delivery management.")

    d.pagebreak()
    d.h(1, "15. Future Scope")
    d.p("Future scope is directional and does not authorize implementation. Each item requires discovery, threat/privacy/accessibility review, architecture decision, requirements, acceptance criteria, and reprioritization.")
    d.table(["ID", "Capability", "Boundary"], FUTURE_SCOPE, [950, 2400, 6010])

    d.pagebreak()
    d.h(1, "Appendix A. Traceability")
    d.h(2, "A.1 Domain Traceability Matrix")
    d.table(["Domain", "Feature IDs", "User stories", "Use cases", "Goals / metrics"], TRACEABILITY, [1600, 2800, 1700, 1250, 2010])
    d.h(2, "A.2 Verification Trace")
    d.p("Each FR-<FEATURE>-NNN requirement traces to AC-<FEATURE>-NN and AC-CROSS criteria, then to automated/manual test case IDs in the implementation repository. Business rules and NFRs are linked to every affected test suite and release gate. No feature is Done while an applicable requirement remains unverified, waived without expiry, or lacks evidence.")

    d.pagebreak()
    d.h(1, "Appendix B. Glossary and Open Decisions")
    d.h(2, "B.1 Glossary")
    glossary = [
        ("FocusOS", "The complete Focused system for direction, planning, execution, observation, reflection, and adaptation."),
        ("Focused Day", "A metric-qualified local date with an intentional plan plus at least one completed priority or qualifying focus session."),
        ("Context grant", "A purpose-, scope-, user-, and time-bound permission for AI or an agent to process selected data."),
        ("Action proposal", "Structured AI output describing a potential domain mutation; it is not executed state."),
        ("Canonical plan", "The authoritative plan for one member and period under the applicable time-zone/week definition."),
        ("Occurrence", "A computed scheduled instance of a habit or reminder with a stable unique identity."),
        ("Idempotency", "The property that safely retrying the same logical mutation does not create duplicate effects."),
        ("Snapshot", "An immutable, versioned view of selected evidence at a known time for a review/report/export."),
        ("Stale", "Data whose freshness exceeds its contract or whose upstream source is not currently confirmed."),
        ("Sensitive data", "Private content whose exposure or misuse could materially affect dignity, safety, faith, health, or autonomy."),
        ("Operational role", "A non-member role used to run the platform under MFA, least privilege, reason, audit, and separation of duties."),
        ("PWA", "Installable web application behavior using a manifest, service worker, cache/update strategy, and optional web push."),
    ]
    d.table(["Term", "Definition"], glossary, [2200, 7160])
    d.h(2, "B.2 Open Decisions Requiring Sponsor Approval")
    for item in [
        "Target launch countries/regions and applicable privacy, consumer, child-safety, export, and data-residency obligations.",
        "Age eligibility and whether minors are permitted; this materially changes consent, safety, messaging, and data handling.",
        "Commercial model and entitlements. This SRS intentionally does not assign features to paid tiers.",
        "Supported launch languages, right-to-left launch scope, prayer calculation datasets/methods, and localized crisis-resource governance.",
        "Exact data retention and deletion durations by class, backup technology, legal hold needs, and AI-provider retention terms.",
        "Identity providers, database, object storage, queue/worker, search, analytics, notification, calendar, and AI vendors after architecture/security evaluation.",
        "Offline matrix by feature: which reads cache, which mutations queue, conflict policy, encryption of local data, and storage quota.",
        "Definition of qualifying focus session, XP rules/caps, achievement catalog, streak grace/pause policy, and challenge governance after psychology review.",
        "Whether technology news is globally available, which sources/licenses are approved, and how editorial balance and takedowns are governed.",
        "Support break-glass process, if ever needed. Initial requirements prohibit routine access to private content and leave break-glass out of scope.",
    ]:
        d.bullet(item)
    d.h(2, "B.3 Definition of Ready")
    d.p("A feature is Ready only when its target persona/outcome, priority, dependencies, data classification, architecture/API/data design, all UI states, content, validation, edge cases, security/privacy/threat model, accessibility, analytics, test approach, rollout, operations, and acceptance criteria are reviewed and unresolved decisions are explicit.")
    d.h(2, "B.4 Definition of Done")
    d.p("A feature is Done only when every applicable FR, BR, NFR, AC, and migration/rollback requirement is implemented and evidenced; OpenAPI and user/technical documentation are current; telemetry and alerts are live; accessibility/security/privacy/AI release gates pass; CI lint/test/build/SonarQube scans pass; and production verification confirms the intended outcome without guardrail regression.")
    return d


def main() -> None:
    spec = build_specification()
    DOCS.mkdir(parents=True, exist_ok=True)
    MD_PATH.write_text(spec.render_markdown(), encoding="utf-8", newline="\n")
    write_docx(spec, DOCX_PATH)
    print(f"Wrote {MD_PATH}")
    print(f"Wrote {DOCX_PATH}")
    print(f"Features: {len(FEATURES)}; requirements: {len(FEATURES) * 3}; feature acceptance criteria: {len(FEATURES) * 6}")


if __name__ == "__main__":
    main()
