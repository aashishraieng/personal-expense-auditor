import re
import csv
from datetime import datetime
from pathlib import Path
MERCHANT_CATEGORY_MAP = {
    "Swiggy": "Food",
    "Zomato": "Food",
    "Uber": "Travel",
    "Ola": "Travel",
    "Airtel": "Recharge",
    "Jio": "Recharge",
    "Netflix": "Subscription",
    "Amazon": "Shopping",
    "Flipkart": "Shopping",
    "Meesho": "Shopping",
    "PhonePe": "UPI Service",
    "Google": "UPI Service",
    "SBI": "Bank",
}

# ---------- Amount extraction ----------
def extract_amount(text: str):
    # Supports Rs.176 / Rs 176 / Rs:176 / Rs:500.00 / ₹176 / INR 176 / Rs 74 etc.
    match = re.search(r'(₹|Rs\.?|INR)\s*[:\.]?\s*([0-9]+(?:\.[0-9]+)?)', text, re.IGNORECASE)
    if match:
        return float(match.group(2))  # use float because amounts may have decimals
    return None

# ---------- Merchant extraction ----------
KNOWN_MERCHANTS = [
    "Meesho", "Swiggy", "Zomato", "Uber", "Airtel", "Netflix",
    "Amazon", "Flipkart", "PhonePe", "Jio"
]

def extract_merchant(text: str):
    for merchant in KNOWN_MERCHANTS:
        if re.search(merchant, text, re.IGNORECASE):
            return merchant
    return "Unknown"

# ---------- Date extraction ----------
def extract_date(text: str):
    patterns = [
        r'(\d{2}[A-Za-z]{3}\d{2})',        # 02Dec25
        r'(\d{2}-[A-Za-z]{3}-\d{2})',      # 02-Dec-25
        r'(\d{2}-\d{2}-\d{4})',            # 18-11-2025
        r'(\d{2}/\d{2}/\d{4})'             # 18/11/2025
    ]

    for p in patterns:
        match = re.search(p, text)
        if match:
            raw = match.group(1)

            for fmt in ("%d%b%y", "%d-%b-%y", "%d-%m-%Y", "%d/%m/%Y"):
                try:
                    dt = datetime.strptime(raw, fmt).strftime("%Y-%m-%d")
                    return dt
                except:
                    continue

    return "Unknown"
def categorize_transaction(text: str, amount: float, merchant: str) -> str:
    t = text.lower()

    # 1) Refund / reversal (highest priority)
    if "reversal" in t or "refunded" in t or "refund" in t or "reversed" in t:
        return "Refund"

    # 2) Wallet / app balance credit (also refund)
    if "credited" in t and ("balance" in t or "wallet" in t):
        return "Refund"

    # 3) Outgoing money (expense): debited / sent / paid
    if "debited" in t or "sent from" in t or "payment of" in t or "payment made" in t or "paid to" in t or "upi payment" in t:
        return "Expense"

    # 4) General incoming credit (salary / transfer etc.)
    if "credited" in t or "credit of" in t or "received from" in t:
        return "Incoming"

    # 5) Fallback: merchant-based type (we'll refine later)
    if merchant in MERCHANT_CATEGORY_MAP:
        return MERCHANT_CATEGORY_MAP[merchant]

    # 6) Default
    return "Other"
EXPENSE_LIKE_CATEGORIES = {
    "Expense",
    "Food",
    "Travel",
    "Shopping",
    "Recharge",
    "Subscription",
    "UPI Service"
}

def derive_flow(category: str) -> str:
    category = category.strip()

    if category == "Refund":
        return "REFUND"
    if category == "Incoming":
        return "IN"
    if category in EXPENSE_LIKE_CATEGORIES:
        return "OUT"
    return "OTHER"




# ---------- Main processing ----------
def process_all_sms(input_dir: Path, output_csv: Path):
    if not input_dir.exists():
        raise FileNotFoundError(f"Folder not found: {input_dir}")

    rows = []
    sms_count = 0

    # Go through ALL .txt files in the folder
    for sms_file in sorted(input_dir.glob("*.txt")):
        print(f"Reading: {sms_file}")
        with sms_file.open(encoding="utf-8") as f:
            for line in f:
                text = line.strip()
                if not text:
                    continue

                sms_count += 1
                amount = extract_amount(text)
                merchant = extract_merchant(text)
                date = extract_date(text)

                print(f"  SMS: {text}")
                print(f"    amount: {amount}, merchant: {merchant}, date: {date}")

                # Only keep rows where we found an amount
                if amount is not None:
                    category = categorize_transaction(text, amount, merchant)
                    flow = derive_flow(category)

                    rows.append({
                        "source_text": text,
                        "amount": amount,
                        "merchant": merchant,
                        "category": category,
                        "flow": flow,
                        "date": date
                    })



    print(f"\nTotal SMS read: {sms_count}")
    print(f"Total transactions detected (amount found): {len(rows)}")

    if not rows:
        print("No valid transaction SMS found. Nothing to save.")
        return

    with output_csv.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(
    f,
    fieldnames=["source_text", "amount", "merchant", "category", "flow", "date"]
)

        writer.writeheader()
        writer.writerows(rows)

    print(f"\nSaved {len(rows)} rows to {output_csv}")


if __name__ == "__main__":
    input_dir = Path("data/sms_raw")
    output_file = Path("auto_dataset_from_sms.csv")
    process_all_sms(input_dir, output_file)
