import re

def extract_amount(text: str):
    # Look for patterns like Rs1800, Rs.176, ₹249, etc.
    match = re.search(r'(₹|Rs\.?|INR)\s*([0-9]+)', text, re.IGNORECASE)
    if match:
        return int(match.group(2))
    return None


if __name__ == "__main__":
    sms_list = [
        "Dear SBI UPI User, ur A/cX8742 credited with Rs1800 on 02Dec25 against reversal of txn",
        "Rs.176 credited to your Meesho Balance. Updated Balance Rs.176."
    ]

    for sms in sms_list:
        amount = extract_amount(sms)
        print(f"SMS: {sms}")
        print(f"Extracted amount: {amount}\n")
