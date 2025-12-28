# Personal Expense Auditor

A full-stack application for tracking personal expenses from SMS messages. It works by uploading a CSV of SMS messages, which are then parsed and categorized (using keywords or ML) to generate financial summaries.

## Project Structure

### Backend (`src/expense_auditor/`)
The backend is built with **Flask** and **SQLAlchemy**.

- **`app.py`**: The main entry point.
  - **Routes**:
    - `POST /login`: Authenticate user.
    - `POST /signup`: Register new user.
    - `GET /health`: Health check (`{"status": "ok"}`).
    - `POST /api/sms/upload`: Upload CSV file. Parsed `source_text`, `date`, `amount`. Uses `amount_extractor.py`.
    - `GET /api/sms`: Fetch all SMS messages for the user.
    - `PUT /api/sms/<id>`: Update category/amount of a message.
    - `GET /api/summary`: Fetch monthly financial summary (Expense/Income/Net).
    - `GET /api/model/status`: Check ML model status (Admin only).
  - **Key Functions**:
    - `upload_sms_csv`: Handles file parsing, duplicate prevention, and DB insertion.
    - `monthly_summary`: Aggregates data by category/month.

- **`db.py`**: Database models.
  - `User`: Handles authentication (email, password hash, token, admin status).
  - `SMSMessage`: Stores transaction details. Unique constraint on `(user_id, text, amount)` to prevent duplicates.
  - `UserSettings`: Metrics settings (confidence threshold).
  - `Budget`: Monthly category budgets.

- **`auth_utils.py`**: Security helpers.
  - `hash_password`: BCrypt hashing.
  - `verify_password`: Verify hash.
  - `make_token`: Generate session token.

- **`sms_classifier.py`**: Classification logic.
  - `classify_sms_with_confidence`: Uses regex rules first (e.g., "debited" -> Expense), falls back to ML model (`category_model.joblib`).

- **`utils/amount_extractor.py`**: Regex utility to extract money from text (supports `Rs.`, `₹`, `INR`).

### Frontend (`frontend/src/`)
The frontend is a **React (Vite)** application tailored with **Tailwind CSS**.

- **`main.jsx`**: Entry point. Wraps app in `BrowserRouter` and `AuthProvider`.
- **`App.jsx`**: Main routing logic.
  - `/login`, `/signup`: Public routes.
  - `/`, `/dashboard`, `/summary`, `/settings`: Protected routes (require auth).

- **`api/client.js`**: Core API wrapper.
  - Attaches `Authorization: Bearer <token>`.
  - Automatically handles 401 Unauthorized (redirects to login).
  - **Special Logic**: Smartly handles `FormData` for file uploads by NOT forcing `Content-Type: application/json`.

- **`api/sms.js`**: SMS-specific API calls.
  - `fetchSMS`, `updateSMS`, `uploadSMSFile`, `getMonthlySummary`.

- **`context/AuthContext.jsx`**: Manages global auth state (`user`, `token`, `isAuthenticated`). Persists to `localStorage`.

- **`pages/`**:
  - `Login.jsx` / `Signup.jsx`: Auth forms.
  - `Dashboard.jsx`: Displays list of transactions with filters.
  - `Summary.jsx`: Monthly financial overview charts (Expense vs Income).
  - `Settings.jsx`: File upload UI and preference management.

## Setup & Running

1. **Backend**:
   ```bash
   # In root directory
   python -m expense_auditor.app
   # Runs on http://127.0.0.1:5000
   ```

2. **Frontend**:
   ```bash
   cd frontend
   npm run dev
   # Runs on http://localhost:5173
   ```

## Key Features implemented
- **Duplicate Prevention**: Uploading the same CSV twice will skip existing records based on text/amount match.
- **Smart Amount Extraction**: Handles `INR 500`, `Rs. 500`, `₹500` formats.
- **Session Persistence**: Users stay logged in on refresh.
- **Responsive UI**: Tailwind-styled components.
