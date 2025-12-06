import pandas as pd

INPUT_PATH = "data/processed/auto_dataset_with_amounts.csv"

def main():
    df = pd.read_csv(INPUT_PATH, encoding="ISO-8859-1")

    if "date" not in df.columns:
        raise ValueError("Expected a 'date' column from SMS import. Make sure import_android_sms.py filled it.")

    if "predicted_category" not in df.columns or "amount" not in df.columns:
        raise ValueError("File must have 'predicted_category' and 'amount' columns. Run analyze_sms_file.py and summarize_expenses.py first.")

    # Parse date column to datetime
    df["date"] = pd.to_datetime(df["date"], errors="coerce")
    df = df.dropna(subset=["date"])

    # Create year-month column
    df["year_month"] = df["date"].dt.to_period("M").astype(str)

    # Filter only rows with a positive amount
    df = df[df["amount"] > 0].copy()

    # Define spending vs income
    spend_mask = df["predicted_category"].isin(["Debit", "Shopping/UPI"])
    income_mask = df["predicted_category"].isin(["Credit", "Refund"])

    monthly_spend = df[spend_mask].groupby("year_month")["amount"].sum()
    monthly_income = df[income_mask].groupby("year_month")["amount"].sum()

    # Combine into one table
    summary = pd.DataFrame({
        "spent": monthly_spend,
        "in": monthly_income
    }).fillna(0.0)

    summary["net"] = summary["in"] - summary["spent"]

    print("Monthly summary (approx):")
    print(summary.sort_index())

    output_path = "data/processed/monthly_summary.csv"
    summary.to_csv(output_path, encoding="ISO-8859-1")
    print(f"\nSaved monthly summary to: {output_path}")

if __name__ == "__main__":
    main()
