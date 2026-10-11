from pathlib import Path

from reportlab.lib import colors
from reportlab.platypus import Paragraph, SimpleDocTemplate, Table, TableStyle

from app.services.materials import extract_text_from_path


def build_table_pdf(path: Path) -> None:
    doc = SimpleDocTemplate(str(path))
    table = Table([["alpha", "beta"], ["1", "2"]])
    table.setStyle(TableStyle([("GRID", (0, 0), (-1, -1), 0.5, colors.black)]))
    doc.build([table])


def build_plain_pdf(path: Path) -> None:
    doc = SimpleDocTemplate(str(path))
    doc.build([Paragraph("hello world " * 20)])


def test_table_becomes_markdown(tmp_path):
    path = tmp_path / "table.pdf"
    build_table_pdf(path)

    text = extract_text_from_path("t.pdf", path)

    assert "[table p1]" in text
    assert "| alpha | beta |" in text
    assert "| --- | --- |" in text


def test_plain_page_has_no_table_marker(tmp_path):
    path = tmp_path / "plain.pdf"
    build_plain_pdf(path)

    text = extract_text_from_path("plain.pdf", path)

    assert "[table" not in text
    assert "[page 1]" in text
