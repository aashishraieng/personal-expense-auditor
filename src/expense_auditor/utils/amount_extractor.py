# utils/amount_extractor.py
import re
from typing import Optional

AMOUNT_PATTERNS = [
    r"(?:rs\.?|₹|INR)\s?([\d,]+(?:\.\d{1,2})?)",
    r"([\d,]+(?:\.\d{1,2})?)\s?(?:rs\.?|₹|INR)",
]


def extract_amount(text: str) -> Optional[float]:
    """
    Extract monetary amount from SMS text.
    Returns float or None.
    """
    if not text:
        return None

    t = text.lower()

    for pattern in AMOUNT_PATTERNS:
        match = re.search(pattern, t, re.IGNORECASE)
        if match:
            raw = match.group(1).replace(",", "")
            try:
                return float(raw)
            except ValueError:
                return None

    return None
