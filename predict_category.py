import joblib
from pathlib import Path

# 1) Load saved model
model_path = Path("models/category_model.joblib")

if not model_path.exists():
    raise FileNotFoundError(f"Model file not found at {model_path}. Train it first with train_category_model.py")

model = joblib.load(model_path)
print(f"Loaded model from: {model_path}\n")

print("Type/paste an SMS message and press Enter to predict its category.")
print("Type 'q' and press Enter to quit.\n")

while True:
    sms = input("SMS> ").strip()
    if sms.lower() == "q":
        print("Exiting.")
        break
    if not sms:
        continue

    pred = model.predict([sms])[0]
    print(f"Predicted category: {pred}")
    print("-" * 60)
