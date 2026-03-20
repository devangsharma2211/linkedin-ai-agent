import pdfplumber
import json
import re
from typing import Dict, Optional


def extract_text_from_pdf(pdf_path: str) -> str:
    """Extract all raw text from a PDF file."""
    text = ""
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:
                text += page_text + "\n"
    return text.strip()


def parse_linkedin_sections(raw_text: str) -> Dict[str, Optional[str]]:
    """
    Parse raw LinkedIn PDF text into structured sections.
    LinkedIn PDFs follow a consistent format with section headers.
    Returns a dict with keys: headline, summary, experience, education, skills, certifications.
    """
    sections = {
        "headline": None,
        "summary": None,
        "experience": None,
        "education": None,
        "skills": None,
        "certifications": None,
    }

    lines = [l.strip() for l in raw_text.split("\n") if l.strip()]

    # The first few lines of a LinkedIn PDF are typically:
    # Line 0: Full Name
    # Line 1: Headline
    # Line 2: Location / Contact info
    if len(lines) >= 2:
        sections["headline"] = lines[1]

    # Define known LinkedIn section headers
    section_markers = {
        "summary": ["Summary", "About"],
        "experience": ["Experience"],
        "education": ["Education"],
        "skills": ["Skills", "Top Skills"],
        "certifications": ["Licenses & Certifications", "Certifications"],
    }

    # Find where each section starts
    section_positions = {}
    for i, line in enumerate(lines):
        for key, markers in section_markers.items():
            if line in markers and key not in section_positions:
                section_positions[key] = i

    # Sort sections by their position in the document
    sorted_sections = sorted(section_positions.items(), key=lambda x: x[1])

    # Extract text between consecutive section headers
    for idx, (section_name, start_pos) in enumerate(sorted_sections):
        # Start after the header line
        content_start = start_pos + 1
        # End before the next section header (or end of document)
        if idx + 1 < len(sorted_sections):
            content_end = sorted_sections[idx + 1][1]
        else:
            content_end = len(lines)

        section_content = "\n".join(lines[content_start:content_end]).strip()
        if section_content:
            sections[section_name] = section_content

    # Format experience and education as JSON for easier CRUD
    if sections["experience"]:
        sections["experience"] = _format_as_json_blocks(sections["experience"], "experience")

    if sections["education"]:
        sections["education"] = _format_as_json_blocks(sections["education"], "education")

    if sections["skills"]:
        # Skills are often comma or newline separated
        skill_list = [s.strip() for s in re.split(r"[,\n•]", sections["skills"]) if s.strip()]
        sections["skills"] = json.dumps(skill_list)

    return sections


def _format_as_json_blocks(text: str, section_type: str) -> str:
    """
    Lightly structure experience/education blocks into JSON.
    LinkedIn PDFs typically have entries separated by blank lines or date patterns.
    """
    # Split into blocks using date patterns as separators (e.g. "Jan 2020 - Present")
    date_pattern = re.compile(
        r"(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}"
    )
    lines = text.split("\n")
    blocks = []
    current_block = []

    for line in lines:
        if date_pattern.search(line) and current_block:
            blocks.append("\n".join(current_block).strip())
            current_block = [line]
        else:
            current_block.append(line)

    if current_block:
        blocks.append("\n".join(current_block).strip())

    # Return as JSON list of raw text blocks
    result = [{"entry": block} for block in blocks if block]
    return json.dumps(result, ensure_ascii=False, indent=2)
