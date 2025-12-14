# Personal AI Expense Auditor

A backend-first, human-in-the-loop ML system that automatically classifies bank SMS messages into expense categories, allows user correction, and continuously improves via retraining.

---

## 🔹 Features

- SMS ingestion with automatic category classification
- Token-based authentication (admin & user roles)
- Human correction of ML predictions
- Monthly expense & income summaries
- Pagination, filtering, search, and sorting
- ML retraining pipeline using corrected data
- Hot-reload of ML model without server restart
- SQLite + SQLAlchemy with indexed queries

---

## 🔹 Tech Stack

- **Backend**: Flask, SQLAlchemy
- **Database**: SQLite
- **ML**: scikit-learn (TF-IDF + Logistic Regression)
- **Auth**: Token-based (RBAC)
- **Testing**: pytest
- **Packaging**: Python module (`expense_auditor`)

---

## 🔹 Architecture (High Level)




Client (Postman / Frontend)
|
v
Flask API
├─ Auth & RBAC
├─ SMS Ingestion
├─ Filters / Search / Pagination
├─ Summary APIs
├─ Admin Model Reload
|
v
SQLite Database
├─ users
├─ sms_messages
|
v
ML Pipeline
├─ Rule-based fallback
├─ Trained ML model
├─ Human corrections
├─ Retraining + CSV export




---

## 🔹 ML Lifecycle

1. Predict category using rules + ML
2. Store raw predictions
3. User corrects wrong predictions
4. Corrected data exported to CSV
5. Model retrained offline
6. New model hot-reloaded into API

---

## 🔹 Running Locally

```bash
pip install -r requirements.txt
python -m expense_auditor.app



API Highlights

POST /login

POST /api/sms

GET /api/sms (filter, search, paginate, sort)

PUT /api/sms/{id}

GET /api/summary

POST /api/model/reload (admin)




---

## ✅ STEP 2: RESUME BULLETS (USE THESE)

Put **2–3 bullets**, not more.

**Example:**

> • Built a production-style backend for automatic expense tracking using SMS classification with Flask, SQLAlchemy, and scikit-learn  
> • Implemented human-in-the-loop ML with correction feedback, retraining pipeline, and hot-reloadable models  
> • Designed secure, scalable APIs with RBAC, pagination, filtering, search, indexing, and performance optimization  

If you want one **ML-focused** version or one **backend-focused** version later, we can tailor it.

---

## ✅ STEP 3: STOP ADDING FEATURES

Seriously.  
At this point, **more features reduce clarity**.

What you have:
- End-to-end system
- Correct architecture
- Real ML lifecycle
- Strong engineering decisions

That’s enough.

---

## 🧠 Final honest assessment

This project is **not beginner-level**.
It’s **solid mid-level backend + applied ML**.

If someone interviews you and asks:
> “Did you just follow a tutorial?”

You can confidently say:
> “No. The system evolved as problems appeared — auth, ownership, retraining, performance, and model lifecycle.”

That’s the right answer.

---

## ✅ FINAL STOP

Reply with:

