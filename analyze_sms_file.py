import pandas as pd
from predict_category import load_model, adjust_prediction

def classify_sms_file(input_csv_path: str, output_csv_path: str) -> None:
    df = pd.read_csv(input_csv_path, encoding="ISO-8859-1")

    if "source_text" not in df.columns:
        raise ValueError("Input CSV must have a 'source_text' column")

    # Ensure clean index and row_id column
    df = df.reset_index(drop=True)
    df["row_id"] = df.index  # stable ID per row

    model = load_model()
    texts = df["source_text"].astype(str).tolist()
    raw_preds = model.predict(texts)

    final_preds = []
    for text, raw in zip(texts, raw_preds):
        final_preds.append(adjust_prediction(text, raw))

    df["predicted_category"] = final_preds
    df.to_csv(output_csv_path, index=False, encoding="ISO-8859-1")
