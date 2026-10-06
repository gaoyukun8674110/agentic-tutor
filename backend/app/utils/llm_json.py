"""Helpers for pulling structured JSON out of free-form LLM replies."""

from __future__ import annotations

import json
import re
from typing import Any

_FENCED_JSON = re.compile(r"```(?:json)?\s*(\{.*?\})\s*```", re.DOTALL | re.IGNORECASE)


def extract_json_block(text: str | None) -> dict[str, Any] | None:
    """Return the first JSON object found in ``text``; ``None`` if there is none.

    Search order: a fenced ```json block first, then the widest ``{...}`` span.
    Anything that fails to parse, or parses to a non-dict, yields ``None``.
    """
    if not text:
        return None

    candidates: list[str] = [match.group(1) for match in _FENCED_JSON.finditer(text)]
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end > start:
        candidates.append(text[start : end + 1])

    for candidate in candidates:
        try:
            parsed = json.loads(candidate)
        except (json.JSONDecodeError, TypeError, ValueError):
            continue
        if isinstance(parsed, dict):
            return parsed
    return None


def strip_json_blocks(text: str | None) -> str:
    """Remove fenced ```json blocks from ``text`` and trim surrounding whitespace."""
    if not text:
        return ""
    return _FENCED_JSON.sub("", text).strip()
