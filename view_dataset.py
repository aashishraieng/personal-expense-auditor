import pandas as pd

df = pd.read_csv("auto_dataset_from_sms.csv")

print("\n📌 Total transactions:", len(df))
print("\n📌 Dataset preview:\n")
print(df[["source_text", "amount", "merchant", "category", "flow", "date"]].to_string(index=False))
