import joblib

MODEL_PATH = "models/category_model.joblib"

def load_model():
    model_obj = joblib.load(MODEL_PATH)
    # Two possibilities:
    # 1) You saved a Pipeline directly -> use it as-is
    # 2) You saved a dict -> extract the pipeline
    if isinstance(model_obj, dict):
        # adjust key names if your train file uses different ones
        pipeline = model_obj.get("pipeline") or model_obj.get("model") or model_obj.get("clf")
    else:
        pipeline = model_obj
    return pipeline

def predict_category(texts):
    """
    texts: list of strings (SMS messages)
    returns: list of predicted category labels
    """
    pipeline = load_model()
    preds = pipeline.predict(texts)
    return preds

if __name__ == "__main__":
    pipeline = load_model()

    print("Enter SMS text (blank line to exit):")
    while True:
        sms = input("> ").strip()
        if not sms:
            break
        pred = pipeline.predict([sms])[0]
        print(f"Predicted category: {pred}")
