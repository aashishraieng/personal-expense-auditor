import re
import pandas as pd

INPUT_PATH = "data/processed/auto_dataset_with_predictions.csv"

# STRICT: must have currency indicator (Rs, INR, ₹)
CURRENCY_AMOUNT_PATTERN = re.compile(
    r"(?:rs\.?|inr|₹)\s*([0-9][0-9,]*\.?[0-9]*)",
    re.IGNORECASE
)

# FALLBACK: plain number, used only if context looks transactional
PLAIN_NUMBER_PATTERN = re.compile(
    r"\b([0-9][0-9,]{1,8}(?:\.[0-9]+)?)\b"   # up to ~9 digits incl commas
)

MAX_REASONABLE_AMOUNT = 2_00_000  # 2 lakh per SMS – adjust later if needed

def extract_amount(text: str) -> float:
    if not isinstance(text, str):
        return 0.0
    t = text.lower()

    # 1) Try strict pattern with Rs/INR/₹
    m = CURRENCY_AMOUNT_PATTERN.search(t)
    if m:
        raw = m.group(1).replace(",", "")
        try:
            val = float(raw)
            if 0 < val <= MAX_REASONABLE_AMOUNT:
                return val
        except ValueError:
            pass  # fall through to fallback

    # 2) Fallback: plain numbers, but only if looks like a transaction message
    if not any(k in t for k in ["debited", "credited", "txn", "transaction", "upi", "payment", "refund", "reversed"]):
        return 0.0

    # Avoid matching obvious PNR/train numbers by scanning all candidates and picking a sane one
    for m2 in PLAIN_NUMBER_PATTERN.finditer(t):
        raw2 = m2.group(1).replace(",", "")
        try:
            val2 = float(raw2)
        except ValueError:
            continue
        if 0 < val2 <= MAX_REASONABLE_AMOUNT:
            return val2

    return 0.0

def main():
    df = pd.read_csv(INPUT_PATH, encoding="ISO-8859-1")

    if "source_text" not in df.columns or "predicted_category" not in df.columns:
        raise ValueError("Input CSV must have 'source_text' and 'predicted_category' columns")

    # Extract amount per SMS
    df["amount"] = df["source_text"].astype(str).apply(extract_amount)

    # Keep only rows with non-zero amount
    df_nonzero = df[df["amount"] > 0].copy()

    # Aggregate sums by predicted_category
    sums = df_nonzero.groupby("predicted_category")["amount"].sum().sort_values(ascending=False)

    print("Total amounts per category (approx):\n")
    for cat, total in sums.items():
        print(f"{cat:15s}: {total:,.2f}")

    spend = df_nonzero[df_nonzero["predicted_category"].isin(["Debit", "Shopping/UPI"])]["amount"].sum()
    money_in = df_nonzero[df_nonzero["predicted_category"].isin(["Credit", "Refund"])]["amount"].sum()

    print("\nApprox summary:")
    print(f"Total spent (Debit + Shopping/UPI): {spend:,.2f}")
    print(f"Total in (Credit + Refund):         {money_in:,.2f}")

    output_path = "data/processed/auto_dataset_with_amounts.csv"
    df_nonzero.to_csv(output_path, index=False, encoding="ISO-8859-1")
    print(f"\nSaved detailed file with amounts to: {output_path}")

if __name__ == "__main__":
    main()
