import os
import pandas as pd
from joblib import load

# Path to the trained category model
MODEL_PATH = os.path.join("models", "category_model.joblib")

# Load once at import time
CATEGORY_MODEL = load(MODEL_PATH)


def classify_sms_file(input_csv: str, output_csv: str) -> None:
    """
    Read SMS CSV with column 'source_text',
    predict category for each row using the ML model,
    and save to output_csv with added columns:
      - row_id (1..N)
      - predicted_category

    This is used by:
      - app.py /api/upload (XML path)
      - HTML /upload route
    """
    if not os.path.exists(input_csv):
        raise FileNotFoundError(f"Input CSV not found: {input_csv}")

    # Be permissive on encoding (matches rest of project)
    try:
        df = pd.read_csv(input_csv, encoding="ISO-8859-1")
    except Exception:
        df = pd.read_csv(input_csv)  # fallback

    if "source_text" not in df.columns:
        raise ValueError("Input CSV must contain a 'source_text' column")

    # Clean texts
    texts = df["source_text"].fillna("").astype(str).tolist()

    # Predict categories using trained model
    preds = CATEGORY_MODEL.predict(texts)

    # Attach predictions
    df["predicted_category"] = preds

    # Stable row_id column for UI / PATCH API
    df.insert(0, "row_id", range(1, len(df) + 1))

    # Save classified CSV
    os.makedirs(os.path.dirname(output_csv), exist_ok=True)
    df.to_csv(output_csv, index=False, encoding="ISO-8859-1")

    print(
        f"[CLASSIFY] Read {len(df)} rows from {input_csv} "
        f"-> wrote classified file to {output_csv}"
    )


if __name__ == "__main__":
    """
    Optional CLI usage:

    python analyze_sms_file.py \
        --input data/processed/auto_dataset_from_sms_web.csv \
        --output data/processed/auto_dataset_classified_web.csv
    """
    import argparse

    parser = argparse.ArgumentParser(
        description="Classify SMS CSV using trained category model."
    )
    parser.add_argument(
        "--input",
        "-i",
        default=os.path.join(
            "data", "processed", "auto_dataset_from_sms_web.csv"
        ),
        help="Input CSV path (default: data/processed/auto_dataset_from_sms_web.csv)",
    )
    parser.add_argument(
        "--output",
        "-o",
        default=os.path.join(
            "data", "processed", "auto_dataset_classified_web.csv"
        ),
        help="Output CSV path (default: data/processed/auto_dataset_classified_web.csv)",
    )

    args = parser.parse_args()
    classify_sms_file(args.input, args.output)
