import argparse
import pandas as pd

from predict_category import load_model, adjust_prediction

def analyze_file(input_path: str, output_path: str):
    df = pd.read_csv(input_path, encoding="ISO-8859-1")

    if "source_text" not in df.columns:
        raise ValueError("Input CSV must have a 'source_text' column")

    model = load_model()

    texts = df["source_text"].astype(str).tolist()
    raw_preds = model.predict(texts)

    final_preds = []
    for text, raw in zip(texts, raw_preds):
        final_preds.append(adjust_prediction(text, raw))

    df["predicted_category"] = final_preds

    df.to_csv(output_path, index=False, encoding="ISO-8859-1")
    print(f"Saved predictions to: {output_path}")

    # Print summary
    counts = df["predicted_category"].value_counts().sort_index()
    print("\nCategory counts:")
    print(counts)

def main():
    parser = argparse.ArgumentParser(description="Analyze SMS file with trained model.")
    parser.add_argument(
        "--input",
        type=str,
        default="data/processed/auto_dataset_from_sms.csv",
        help="Path to input CSV with 'source_text' column",
    )
    parser.add_argument(
        "--output",
        type=str,
        default="data/processed/auto_dataset_with_predictions.csv",
        help="Path to output CSV with predictions",
    )
    args = parser.parse_args()
    analyze_file(args.input, args.output)

if __name__ == "__main__":
    main()
