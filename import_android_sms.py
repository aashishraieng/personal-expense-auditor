import argparse
import csv
import os
import xml.etree.ElementTree as ET
from datetime import datetime

def guess_category(text: str) -> str:
    t = text.lower()

    if any(k in t for k in ["credited", "credit", "received", "cr."]):
        return "Credit"
    if any(k in t for k in ["debited", "debit", "spent", "withdrawn", "withdrawal", "dr."]):
        return "Debit"
    if any(k in t for k in ["upi", "gpay", "phonepe", "paytm", "amazon", "flipkart", "swiggy", "zomato", "pos txn"]):
        return "Shopping/UPI"
    if any(k in t for k in ["ticket", "booking", "pnr", "flight", "train", "bus", "hotel"]):
        return "Travel"
    if any(k in t for k in ["refund", "reversed", "chargeback"]):
        return "Refund"
    if any(k in t for k in ["a/c", "acc", "account", "statement", "chequebook", "password", "pin"]):
        return "Account/Service"
    return "Unknown"

def is_potential_transaction(text: str) -> bool:
    t = text.lower()
    keywords = [
        "debited", "credited", "txn", "transaction",
        "rs ", "inr", "aed", "₹", "a/c", "acc", "account",
        "upi", "gpay", "phonepe", "paytm", "atm", "pos"
    ]
    return any(k in t for k in keywords)

def parse_android_sms_xml(input_path: str, output_path: str) -> None:
    if not os.path.exists(input_path):
        raise FileNotFoundError(f"Input XML not found: {input_path}")

    tree = ET.parse(input_path)
    root = tree.getroot()

    rows = []
    count_total = 0
    count_kept = 0

    for sms in root.findall("sms"):
        count_total += 1
        body = sms.attrib.get("body", "").strip()
        address = sms.attrib.get("address", "").strip()
        date_ms = sms.attrib.get("date", "").strip()
        sms_type = sms.attrib.get("type", "").strip()

        if not body:
            continue

        if not is_potential_transaction(body):
            continue

        iso_date = ""
        if date_ms.isdigit():
            try:
                dt = datetime.fromtimestamp(int(date_ms) / 1000.0)
                iso_date = dt.isoformat(sep=" ")
            except Exception:
                iso_date = ""

        probable_category = guess_category(body)

        rows.append({
            "source_text": body,
            "address": address,
            "date": iso_date,
            "sms_type": sms_type,
            "probable_category": probable_category,
        })
        count_kept += 1

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=["source_text", "address", "date", "sms_type", "probable_category"]
        )
        writer.writeheader()
        writer.writerows(rows)

    print(f"Total SMS: {count_total}")
    print(f"Filtered transaction-like SMS: {count_kept}")
    print(f"Saved to: {output_path}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", default="data/raw/sms_backup.xml")
    parser.add_argument("--output", default="data/processed/auto_dataset_from_sms.csv")
    args = parser.parse_args()
    parse_android_sms_xml(args.input, args.output)

if __name__ == "__main__":
    main()
