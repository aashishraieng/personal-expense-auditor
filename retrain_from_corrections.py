import os
import pandas as pd

from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.metrics import classification_report
import joblib


BASE_DATASET = os.path.join("data", "processed", "training_dataset.csv")
CORRECTIONS_CSV = os.path.join("data", "processed", "corrections_web.csv")
MODEL_PATH = os.path.join("models", "category_model.joblib")


def load_base_dataset():
    if not os.path.exists(BASE_DATASET):
        print(f"[WARN] Base dataset not found: {BASE_DATASET}")
        return pd.DataFrame(columns=["source_text", "category"])

    df = pd.read_csv(BASE_DATASET, encoding="ISO-8859-1")
    # Keep only rows with non-empty category
    if "source_text" not in df.columns or "category" not in df.columns:
        raise ValueError("Base dataset must have 'source_text' and 'category' columns")

    df["category"] = df["category"].astype(str).str.strip()
    df["source_text"] = df["source_text"].astype(str)

    df = df[(df["category"] != "") & (df["category"].str.lower() != "nan")]
    return df[["source_text", "category"]].copy()


def load_corrections():
    if not os.path.exists(CORRECTIONS_CSV):
        print(f"[INFO] No corrections file found at {CORRECTIONS_CSV}.")
        return pd.DataFrame(columns=["source_text", "category"])

    df = pd.read_csv(CORRECTIONS_CSV, encoding="utf-8")
    if "text" not in df.columns or "new_category" not in df.columns:
        print("[WARN] Corrections CSV missing 'text' or 'new_category' columns.")
        return pd.DataFrame(columns=["source_text", "category"])

    df["source_text"] = df["text"].astype(str)
    df["category"] = df["new_category"].astype(str).str.strip()
    df = df[(df["category"] != "") & (df["category"].str.lower() != "nan")]
    return df[["source_text", "category"]].copy()


def build_training_data():
    base_df = load_base_dataset()
    corr_df = load_corrections()

    print(f"[INFO] Base labeled samples     : {len(base_df)}")
    print(f"[INFO] Correction labeled samples: {len(corr_df)}")

    all_df = pd.concat([base_df, corr_df], ignore_index=True)

    # If the same text appears multiple times with different categories,
    # we keep the LAST occurrence (usually the latest correction).
    all_df = all_df.dropna(subset=["source_text", "category"])
    all_df["source_text"] = all_df["source_text"].astype(str)
    all_df["category"] = all_df["category"].astype(str)

    all_df = all_df.drop_duplicates(subset=["source_text"], keep="last").reset_index(drop=True)

    print(f"[INFO] Combined unique texts     : {len(all_df)}")

    if len(all_df) == 0:
        raise ValueError("No training data available after combining base + corrections.")

    return all_df


def train_and_evaluate(df: pd.DataFrame):
    X = df["source_text"].values
    y = df["category"].values

    # Simple split for evaluation
    if len(df) >= 50 and len(df["category"].unique()) > 1:
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=y
        )
    else:
        # Not enough data for a good split; train on all, no test
        X_train, y_train = X, y
        X_test, y_test = None, None

    # Text pipeline: TF-IDF + Logistic Regression
    pipeline = Pipeline(
        [
            ("tfidf", TfidfVectorizer(max_features=5000, ngram_range=(1, 2))),
            ("clf", LogisticRegression(max_iter=1000, n_jobs=-1)),
        ]
    )

    print("[INFO] Training model...")
    pipeline.fit(X_train, y_train)
    print("[INFO] Training done.")

    if X_test is not None:
        print("\n[INFO] Evaluation on hold-out set:")
        y_pred = pipeline.predict(X_test)
        print(classification_report(y_test, y_pred))

    # Save the model
    os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
    joblib.dump(pipeline, MODEL_PATH)
    print(f"[INFO] New model saved to: {MODEL_PATH}")


if __name__ == "__main__":
    df_all = build_training_data()
    print("\n[INFO] Class distribution in combined training data:")
    print(df_all["category"].value_counts())
    train_and_evaluate(df_all)
