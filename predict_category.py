import joblib
import re

MODEL_PATH = "models/category_model.joblib"

# --- your merchant keyword list (expand later if needed) ---
MERCHANT_KEYWORDS = [
    "amazon", "flipkart", "zomato", "swiggy", "meesho", "myntra",
    "jiomart", "bigbasket", "ola", "uber",
    "paytm", "phonepe", "google pay", "gpay",
    "razorpay", "jio", "airtel", "vodafone", "vi "
]

def load_model():
    model_obj = joblib.load(MODEL_PATH)
    if isinstance(model_obj, dict):
        pipeline = (
            model_obj.get("pipeline")
            or model_obj.get("model")
            or model_obj.get("clf")
        )
    else:
        pipeline = model_obj
    return pipeline

def looks_like_merchant(text_lower: str) -> bool:
    return any(k in text_lower for k in MERCHANT_KEYWORDS)

def adjust_prediction(text: str, raw_pred: str) -> str:
    """
    Apply your business rules on top of model prediction.
    """
    t = text.lower()

    # 1) Refund always wins if clearly mentioned
    if any(k in t for k in ["refund", "refunded", "reversed", "credited back", "cashback"]):
        return "Refund"

    # 2) Travel: PNR + train/flight/bus patterns
    if "pnr" in t and any(k in t for k in ["trn:", "train", "flight", "bus", "coach"]):
        return "Travel"

    # 3) Pure info / data alerts / offers stay as Other
    if any(k in t for k in ["data pack", "data usage", "plan expires", "recharge now", "offer", "cashback upto"]):
        if raw_pred not in ["Refund", "Travel"]:
            return "Other"

    # 4) UPI / transaction logic
    is_debit_like = any(k in t for k in ["debited", "dr.", "withdrawn", "cash withdrawal"])
    is_credit_like = any(k in t for k in ["credited", "cr."])
    is_upi = "upi" in t or " sent from a/c" in t or " payment of rs" in t

    # If clearly a *credit* (salary, income), let model decide between Credit/Refund rules above
    if is_credit_like and not any(k in t for k in ["refund", "reversed", "cashback"]):
        if raw_pred in ["Credit", "Refund"]:
            return raw_pred
        return "Credit"

    # If clearly a *debit* via UPI or "sent from a/c ..."
    if is_upi or is_debit_like:
        # Your rule: to person -> Debit, to merchant -> Shopping/UPI
        # We approximate using merchant keywords
        if looks_like_merchant(t):
            return "Shopping/UPI"
        # If we see "to <name>" and not merchanty, treat as personal
        if " to " in t:
            return "Debit"

    # 5) Fallback: use model prediction
    return raw_pred

def predict_category(texts):
    pipeline = load_model()
    raw_preds = pipeline.predict(texts)
    final_preds = []
    for text, raw in zip(texts, raw_preds):
        final_preds.append(adjust_prediction(text, raw))
    return final_preds

if __name__ == "__main__":
    pipeline = load_model()
    print("Enter SMS text (blank line to exit):")
    while True:
        sms = input("> ").strip()
        if not sms:
            break
        raw_pred = pipeline.predict([sms])[0]
        final_pred = adjust_prediction(sms, raw_pred)
        print(f"Model: {raw_pred} | Final: {final_pred}")
