import os
import pandas as pd

from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report
import joblib

DATA_PATH = os.path.join("data", "processed", "final_training_data.csv")
MODEL_PATH = os.path.join("models", "category_model.joblib")


def load_data():
    if not os.path.exists(DATA_PATH):
        raise FileNotFoundError(
            f"Final training data not found: {DATA_PATH}\n"
            f"Run build_training_data.py first."
        )

    # We saved this as UTF-8
    df = pd.read_csv(DATA_PATH, encoding="utf-8")

    if "source_text" not in df.columns or "category" not in df.columns:
        raise ValueError("final_training_data.csv must have columns: source_text, category")

    df = df.dropna(subset=["source_text", "category"])
    df["source_text"] = df["source_text"].astype(str).str.strip()
    df["category"] = df["category"].astype(str).str.strip()

    df = df[df["source_text"] != ""]
    df = df[df["category"] != ""]

    if df.empty:
        raise ValueError("No valid rows in final_training_data.csv after cleaning.")

    return df


def build_model():
    # Simple but strong baseline: Tfidf + LogisticRegression
    # (You can swap this for LinearSVC if you prefer)
    pipe = Pipeline(
        steps=[
            (
                "tfidf",
                TfidfVectorizer(
                    ngram_range=(1, 2),
                    max_features=20000,
                    min_df=2,
                    lowercase=True,
                    strip_accents="unicode",
                ),
            ),
            (
                "clf",
                LogisticRegression(
                    max_iter=200,
                    n_jobs=-1,
                    class_weight="balanced",
                ),
            ),
        ]
    )
    return pipe


def main():
    print(f"Loading data from: {DATA_PATH}")
    df = load_data()
    print(f"Total samples: {len(df)}")

    print(df.head())
    print()

    y_counts = df["category"].value_counts()
    print("Class distribution:")
    print(y_counts)
    print()

    X = df["source_text"].values
    y = df["category"].values

    # Split with stratify when possible
    try:
        X_train, X_test, y_train, y_test = train_test_split(
            X,
            y,
            test_size=0.3,
            random_state=42,
            stratify=y,
        )
    except ValueError:
        # In case some class has only 1 sample etc.
        X_train, X_test, y_train, y_test = train_test_split(
            X,
            y,
            test_size=0.3,
            random_state=42,
        )

    print("Training model...")
    model = build_model()
    model.fit(X_train, y_train)
    print("Training done.")

    print("\nClassification report (may be noisy if data is small):\n")
    y_pred = model.predict(X_test)
    print(classification_report(y_test, y_pred))

    os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
    joblib.dump(model, MODEL_PATH)
    print(f"\nModel saved to: {MODEL_PATH}")


if __name__ == "__main__":
    main()
