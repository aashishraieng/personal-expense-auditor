📌 Personal AI Expense Auditor

AI-powered personal expense tracker & SMS analyzer.

📖 Overview

Personal AI Expense Auditor automatically reads bank SMS messages, classifies transaction type using a machine learning model, extracts transaction amounts, and generates a complete expense dashboard with analytics.

It gives users financial clarity straight from SMS — no manual bookkeeping.

🚀 Features

| Capability                                | Status            |
| ----------------------------------------- | ----------------- |
| Upload SMS backup (XML — Android)         | ✔                 |
| Parse & extract bank transactions         | ✔                 |
| AI classification of SMS                  | ✔                 |
| Amount & category extraction              | ✔                 |
| Monthly spending & income analytics       | ✔                 |
| React dashboard (charts, filters, search) | ✔                 |
| Category correction (model feedback loop) | ✔                 |
| Automatic summary update                  | ✔                 |
| SQLite database backend                   | ✔                 |
| Model retraining from user corrections    | 🔜 (script ready) |
| Multi-user accounts                       | 🔜                |
| Mobile app integration                    | 🔜                |


🧠 Project Workflow

Android SMS Backup (.xml)
           ↓
Flask Backend Upload API
           ↓
SMS Parser (import_android_sms.py)
           ↓
Transaction Classification (category_model.joblib)
           ↓
Amount Extraction
           ↓
CSV → Summary → Sync to SQLite
           ↓
React Dashboard (Charts + Tables)
           ↓
User Category Corrections
           ↓
corrections_web.csv (feedback for retraining)
           ↓
retrain_from_corrections.py (manual model improvement)


🏗 System Architecture

                     ┌─────────────┐
                     │  React UI   │
                     └─────┬───────┘
                           │ REST
                           ▼
                    ┌───────────────┐
                    │   Flask API   │
                    └──────┬────────┘
                           │
     ┌─────────────────────┼──────────────────────┐
     ▼                     ▼                      ▼
 XML Parser         ML Classifier        Expense Summarizer
(import_android_   (category_model.       (summarize_expenses.py)
   sms.py)              joblib)
     │                     │                      │
     └───────────────┬─────┴────────────┬─────────┘
                     ▼                  ▼
  CSV (classified + amounts)      corrections_web.csv
                     ▼
                SQLite Database
          (sms_messages table for UI/API)

📂 Folder Structure

project/
│ app.py                          → Flask backend + API
│ retrain_from_corrections.py     → Model retraining (corrected data)
│ train_category_model.py         → Initial model training
│ import_android_sms.py           → Parse SMS XML to CSV
│ analyze_sms_file.py             → Classify SMS CSV
│ summarize_expenses.py           → Compute totals & amounts
│ summarize_by_month.py           → Monthly analytics
│ summarize_by_month_category.py  → Monthly category analytics
│ db.py                            → SQLite DB + ORM model
│
├─ data/
│  ├─ raw/                        → Uploaded XML backups
│  ├─ processed/                  → Classified & amount CSVs
│  ├─ expense_db.sqlite           → Live DB for the app
│
├─ models/
│  └─ category_model.joblib       → ML classifier (TF-IDF + Logistic Regression)
│
└─ frontend/
   └─ personal-expense-auditor-ui → React dashboard
      ├─ src/App.jsx              → UI logic + API + charts
      ├─ Recharts graphs
      ├─ Category correction UI
      └─ Monthly filter + search


🔧 Tech Stack

| Layer            | Technologies                               |
| ---------------- | ------------------------------------------ |
| Frontend         | React, Recharts, Fetch API                 |
| Backend          | Flask, REST API                            |
| Machine Learning | Scikit-learn, TF-IDF + Logistic Regression |
| Data Processing  | Pandas                                     |
| Database         | SQLite                                     |
| Language         | Python + JavaScript                        |


🖼 Screenshots

![Dashboard Preview](assets/dashboard.png)
![Transactions Page](assets/transactions.png)


▶ Running the Project

1️⃣ Backend setup

pip install -r requirements.txt
python app.py

Runs at:
http://127.0.0.1:5000

2️⃣ Frontend setup

cd frontend/personal-expense-auditor-ui
npm install
npm run dev

Runs at:
http://localhost:5173



🔁 Improving the Model (Self-Learning)

Every time you correct a category in the UI:

It updates in CSV

It updates the dashboard

It is recorded in data/processed/corrections_web.csv

To retrain the model with real corrections:
python retrain_from_corrections.py

Generates new:
models/category_model.joblib

Restart Flask → the app now uses the improved model.

🚀 Roadmap

| Phase                                    | Status      |
| ---------------------------------------- | ----------- |
| CSV storage                              | ✔ Completed |
| SQLite backend for transactions          | ✔ Completed |
| Online model retraining from corrections | 🔜          |
| Multi-user authentication                | 🔜          |
| Token-based Android auto-sync            | 🔜          |
| Push notifications / spend alerts        | 🔜          |
| Full deployment (Render/EC2/Vercel)      | 🔜 Planned  |


Deployment choice selected: Cloud deployment soon

for install through requirements.txt
pip install -r requirements.txt
