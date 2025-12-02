import re
from datetime import datetime

def extract_date(text: str):
    # Look for formats like 02Dec25, 02-Dec-25, 18-11-2025, etc.
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

            # Convert 02Dec25 → 2025-12-02
            try:
                dt = datetime.strptime(raw, "%d%b%y").strftime("%Y-%m-%d")
                return dt
            except:
                pass
            
            # Convert 02-Dec-25 → 2025-12-02
            try:
                dt = datetime.strptime(raw, "%d-%b-%y").strftime("%Y-%m-%d")
                return dt
            except:
                pass

            # Convert 18-11-2025 → 2025-11-18
            try:
                dt = datetime.strptime(raw, "%d-%m-%Y").strftime("%Y-%m-%d")
                return dt
            except:
                pass

            # Convert 18/11/2025 → 2025-11-18
            try:
                dt = datetime.strptime(raw, "%d/%m/%Y").strftime("%Y-%m-%d")
                return dt
            except:
                pass

    return "Unknown"


if __name__ == "__main__":
    sms_list = [
        "Dear SBI UPI User, ur A/cX8742 credited with Rs1800 on 02Dec25 against reversal of txn",
        "Rs.176 credited to your Meesho Balance. Updated Balance Rs.176."
    ]

    for sms in sms_list:
        dt = extract_date(sms)
        print(f"SMS: {sms}")
        print(f"Extracted date: {dt}\n")
