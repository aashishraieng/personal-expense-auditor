import os
import pandas as pd

BASE_PATH = os.path.join("data", "processed", "training_dataset.csv")
CORR_PATH = os.path.join("data", "processed", "corrections_web.csv")
OUT_PATH = os.path.join("data", "processed", "final_training_data.csv")


def load_base():
    """
    Load the manually labeled base dataset.
    Expected columns: source_text, category
    """
    if not os.path.exists(BASE_PATH):
        print("[WARN] Base training dataset not found, starting empty:", BASE_PATH)
        return pd.DataFrame(columns=["source_text", "category"])

    df = pd.read_csv(BASE_PATH, encoding="ISO-8859-1")
    expected = {"source_text", "category"}
    missing = expected - set(df.columns)
    if missing:
        raise ValueError(f"Base dataset missing columns: {missing}")

    df = df.dropna(subset=["source_text", "category"])
    df["source_text"] = df["source_text"].astype(str).str.strip()
    df["category"] = df["category"].astype(str).str.strip()

    return df


def load_corrections():
    """
    Load corrections collected from the web UI.
    Expected columns: text, new_category, timestamp (optional)
    We keep the LAST correction per text.
    """
    if not os.path.exists(CORR_PATH):
        print("[INFO] No corrections file found:", CORR_PATH)
        return pd.DataFrame(columns=["text", "new_category"])

    df = pd.read_csv(CORR_PATH, encoding="utf-8")

    if "text" not in df.columns or "new_category" not in df.columns:
        print("[WARN] corrections_web.csv missing required columns. Found:", df.columns.tolist())
        return pd.DataFrame(columns=["text", "new_category"])

    df = df.dropna(subset=["text", "new_category"])
    df["text"] = df["text"].astype(str).str.strip()
    df["new_category"] = df["new_category"].astype(str).str.strip()

    # If timestamp exists, sort so the last row is the latest correction
    if "timestamp" in df.columns:
        df = df.sort_values("timestamp", ascending=True)

    # Keep LAST correction per text
    df = df.drop_duplicates(subset=["text"], keep="last")

    return df[["text", "new_category"]]


def main():
    base_df = load_base()
    corr_df = load_corrections()

    print(f"[BASE] Rows: {len(base_df)}")
    print(f"[CORR] Unique corrected texts: {len(corr_df)}")

    # Map: text -> latest corrected category
    corr_map = dict(zip(corr_df["text"], corr_df["new_category"]))

    # Apply corrections to base dataset where text matches
    if corr_map:
        base_df["category"] = base_df.apply(
            lambda row: corr_map.get(row["source_text"], row["category"]),
            axis=1,
        )

    # Build extra rows for corrections that are NOT in base_df
    base_texts = set(base_df["source_text"])
    extra_rows = []
    for _, row in corr_df.iterrows():
        if row["text"] not in base_texts:
            extra_rows.append(
                {"source_text": row["text"], "category": row["new_category"]}
            )

    extra_df = pd.DataFrame(extra_rows)
    if not extra_df.empty:
        print(f"[EXTRA] Adding {len(extra_df)} corrected-only rows (not in base).")

    # Combine
    final_df = pd.concat(
        [base_df[["source_text", "category"]], extra_df],
        ignore_index=True,
    )

    # Drop exact duplicate (text, category) pairs
    final_df = final_df.drop_duplicates(subset=["source_text", "category"])

    # Shuffle for training
    if len(final_df) > 0:
        final_df = final_df.sample(frac=1.0, random_state=42).reset_index(drop=True)

    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    final_df.to_csv(OUT_PATH, index=False, encoding="utf-8")

    print(f"[OUT] Saved final training file to: {OUT_PATH}")
    print(f"[OUT] Total rows: {len(final_df)}")
    if len(final_df) > 0:
        print("[OUT] Class distribution:")
        print(final_df["category"].value_counts())


if __name__ == "__main__":
    main()
