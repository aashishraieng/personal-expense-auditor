import re

# List of known merchants we can detect (we will expand later)
KNOWN_MERCHANTS = [
    "Meesho", "Swiggy", "Zomato", "Uber", "Airtel", "Netflix",
    "Amazon", "Flipkart", "PhonePe", "Jio"
]

def extract_merchant(text: str):
    for merchant in KNOWN_MERCHANTS:
        # Case-insensitive search
        if re.search(merchant, text, re.IGNORECASE):
            return merchant
    return "Unknown"


if __name__ == "__main__":
    sms_list = [
        "Dear SBI UPI User, ur A/cX8742 credited with Rs1800 on 02Dec25 against reversal of txn",
        "Rs.176 credited to your Meesho Balance. Updated Balance Rs.176."
    ]

    for sms in sms_list:
        merchant = extract_merchant(sms)
        print(f"SMS: {sms}")
        print(f"Extracted merchant: {merchant}\n")
