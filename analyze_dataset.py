import pandas as pd

df = pd.read_csv("dataset_labeled.csv")

print("\n📌 Total rows:", len(df))

print("\n📌 Category counts:")
print(df["category"].value_counts(), "\n")

print("\n📌 Sub-category counts:")
print(df["sub_category"].value_counts(), "\n")

print("\n📌 Flow counts:")
print(df["flow"].value_counts(), "\n")
