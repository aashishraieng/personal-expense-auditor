# src/expense_auditor/train_classifier.py
import os
import pandas as pd
from sklearn.pipeline import Pipeline
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from joblib import dump

DATA_PATH = os.path.join("data", "corrections_train.csv")
MODEL_PATH = os.path.join("models", "category_model.joblib")


def main():
    if not os.path.exists(DATA_PATH):
        raise RuntimeError("No training data found. Run export_corrections_csv first.")

    df = pd.read_csv(DATA_PATH)

    if df.empty:
        raise RuntimeError("Training dataset is empty.")

    X = df["text"]
    y = df["category"]

    pipeline = Pipeline([
        ("tfidf", TfidfVectorizer(
            ngram_range=(1, 2),
            stop_words="english",
            min_df=1
        )),
        ("clf", LogisticRegression(
            max_iter=1000,
            class_weight="balanced"
        )),
    ])

    pipeline.fit(X, y)

    os.makedirs("models", exist_ok=True)
    dump(pipeline, MODEL_PATH)

    print(f"Model trained and saved to {MODEL_PATH}")
    print("Classes:", pipeline.named_steps["clf"].classes_)


if __name__ == "__main__":
    main()
