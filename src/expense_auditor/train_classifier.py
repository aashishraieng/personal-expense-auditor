import os
import pandas as pd
from sklearn.pipeline import Pipeline
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from joblib import dump
from expense_auditor.db import SessionLocal, SMSMessage

MODEL_PATH = os.path.join("models", "category_model.joblib")

def train_and_save():
    session = SessionLocal()
    try:
        # 1. Fetch all data from DB to train (including manual corrections)
        messages = session.query(SMSMessage).all()
        
        if not messages:
            print("No data in database to train on.")
            return False

        # Convert to DataFrame
        data = [{
            "text": m.text,
            "category": m.category
        } for m in messages]
        
        df = pd.DataFrame(data)

        # 2. ML Pipeline
        X = df["text"]
        y = df["category"]

        pipeline = Pipeline([
            ("tfidf", TfidfVectorizer(ngram_range=(1, 2), stop_words="english")),
            ("clf", LogisticRegression(max_iter=1000, class_weight="balanced")),
        ])

        pipeline.fit(X, y)

        # 3. Save Model
        os.makedirs("models", exist_ok=True)
        dump(pipeline, MODEL_PATH)

        # 4. Reset 'corrected' flags in DB
        # This makes the "New corrections" count on the dashboard go to 0
        session.query(SMSMessage).filter(SMSMessage.corrected == True).update({"corrected": False})
        session.commit()

        print(f"Model retrained and saved to {MODEL_PATH}")
        return True
    except Exception as e:
        print(f"Training error: {e}")
        session.rollback()
        return False
    finally:
        session.close()

if __name__ == "__main__":
    train_and_save()