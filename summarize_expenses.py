import re
import pandas as pd

CURRENCY_AMOUNT_PATTERN = re.compile(
    r"(?:rs\.?|inr|₹)\s*([0-9][0-9,]*\.?[0-9]*)",
    re.IGNORECASE
)

PLAIN_NUMBER_PATTERN = re.compile(
    r"\b([0-9][0-9,]{1,8}(?:\.[0-9]+)?)\b"
)

MAX_REASONABLE_AMOUNT = 200000

def extract_amount(text: str) -> float:
    if not isinstance(text, str):
        return 0.0
    t = text.lower()

    m = CURRENCY_AMOUNT_PATTERN.search(t)
    if m:
        raw = m.group(1).replace(",", "")
        try:
            val = float(raw)
            if 0 < val <= MAX_REASONABLE_AMOUNT:
                return val
        except ValueError:
            pass

    if not any(k in t for k in ["debited", "credited", "txn", "transaction", "upi", "payment", "refund", "reversed"]):
        return 0.0

    for m2 in PLAIN_NUMBER_PATTERN.finditer(t):
        raw2 = m2.group(1).replace(",", "")
        try:
            val2 = float(raw2)
        except ValueError:
            continue
        if 0 < val2 <= MAX_REASONABLE_AMOUNT:
            return val2

    return 0.0

def summarize_with_amounts(classified_csv_path: str, output_csv_path: str) -> dict:
    df = pd.read_csv(classified_csv_path, encoding="ISO-8859-1")

    # Add amount column
    df["amount"] = df["source_text"].astype(str).apply(extract_amount)

    # Keep only rows with non-zero amount, but keep ALL existing columns (including row_id, predicted_category, date, etc.)
    df_nonzero = df[df["amount"] > 0].copy()

    category_totals = df_nonzero.groupby("predicted_category")["amount"].sum().to_dict()

    spend = df_nonzero[df_nonzero["predicted_category"].isin(["Debit", "Shopping/UPI"])]["amount"].sum()
    income = df_nonzero[df_nonzero["predicted_category"].isin(["Credit", "Refund"])]["amount"].sum()

    df_nonzero.to_csv(output_csv_path, index=False, encoding="ISO-8859-1")

    return {
        "category_totals": category_totals,
        "total_spent": float(spend),
        "total_income": float(income),
        "net": float(income - spend)
    }
