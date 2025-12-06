import pandas as pd
import joblib

from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.metrics import classification_report

# 1) Load labeled dataset
df = pd.read_csv("data/processed/training_dataset.csv", encoding="ISO-8859-1")



# Keep only needed columns
df = df[["source_text", "category"]].dropna()

print("Total samples:", len(df))
print(df[["source_text", "category"]], "\n")

if len(df) < 5:
    print("⚠ WARNING: Very few samples. Model training will be weak, this is only a pipeline test.\n")

X = df["source_text"]
y = df["category"]
num_samples = len(df)
num_classes = y.nunique()

print(f"Samples: {num_samples}, Classes: {num_classes}")

# If dataset is very small, don't split — just train and test on all data
if num_samples < 20:
    print("⚠ Small dataset — training and evaluating on the SAME data (no real generalization yet).\n")
    X_train, X_test, y_train, y_test = X, X, y, y
else:
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.3, random_state=42, stratify=y
    )
# 3) Build text classification pipeline
model = Pipeline([
    ("tfidf", TfidfVectorizer()),
    ("clf", LogisticRegression(max_iter=1000))
])

# 4) Train
print("Training model...")
model.fit(X_train, y_train)
print("Training done.\n")

# 5) Evaluate (will be meaningless with tiny data, but okay for now)
y_pred = model.predict(X_test)
print("Classification report (may be nonsense if data is too small):\n")
print(classification_report(y_test, y_pred))
# 6) Save model to disk
models_dir = "models"
model_path = f"{models_dir}/category_model.joblib"

joblib.dump(model, model_path)
print(f"\nModel saved to: {model_path}")

