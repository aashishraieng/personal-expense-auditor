import pandas as pd

INPUT_PATH = "data/processed/auto_dataset_with_amounts.csv"

def main():
    df = pd.read_csv(INPUT_PATH, encoding="ISO-8859-1")

    required_cols = {"date", "predicted_category", "amount"}
    if not required_cols.issubset(df.columns):
        raise ValueError(f"File must have columns: {required_cols}. Run analyze_sms_file.py and summarize_expenses.py first.")

    # Parse date column to datetime
    df["date"] = pd.to_datetime(df["date"], errors="coerce")
    df = df.dropna(subset=["date"])

    # Keep only rows with non-zero amount
    df = df[df["amount"] > 0].copy()

    # Year-month
    df["year_month"] = df["date"].dt.to_period("M").astype(str)

    # Pivot: rows = month, columns = category, values = sum(amount)
    pivot = df.pivot_table(
        index="year_month",
        columns="predicted_category",
        values="amount",
        aggfunc="sum",
        fill_value=0.0
    )

    # Sort months
    pivot = pivot.sort_index()

    print("Monthly amount per category (approx):")
    print(pivot)

    output_path = "data/processed/monthly_category_summary.csv"
    pivot.to_csv(output_path, encoding="ISO-8859-1")
    print(f"\nSaved monthly category summary to: {output_path}")

if __name__ == "__main__":
    main()
