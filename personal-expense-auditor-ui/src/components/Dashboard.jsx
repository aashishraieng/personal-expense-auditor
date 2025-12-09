import React from "react";

function Dashboard({
  summary,
  categoryTotals,
  monthsAvailable,
  selectedMonth,
  setSelectedMonth,
}) {
  const monthLabel = (m) => {
    if (!m || m === "all") return "All time";
    return m;
  };

  // --- Simple insights based on categoryTotals & summary ---
  let topCategory = null;
  let topCategoryAmount = 0;

  const entries = Object.entries(categoryTotals || {});
  if (entries.length > 0) {
    // Sort by amount descending
    entries.sort((a, b) => b[1] - a[1]);
    [topCategory, topCategoryAmount] = entries[0];
  }

  const net = summary ? summary.net : 0;

  // --- Data for bar chart ---
  const chartData = entries; // already sorted: [ [cat, amt], ... ]
  const maxAmount = chartData.length
    ? Math.max(...chartData.map(([, amt]) => amt))
    : 0;

  const barWidth = (amt) => {
    if (!maxAmount || maxAmount <= 0) return "0%";
    const pct = (amt / maxAmount) * 100;
    return `${pct.toFixed(1)}%`;
  };

  return (
    <>
      {/* Month selector */}
      <div style={{ marginBottom: "12px" }}>
        <label
          style={{ fontSize: "0.85rem", color: "#4b5563", marginRight: 8 }}
        >
          Period:
        </label>
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          style={{ padding: "4px 6px", borderRadius: "6px" }}
        >
          <option value="all">All time</option>
          {monthsAvailable.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        {summary && (
          <span
            style={{
              marginLeft: 12,
              fontSize: "0.8rem",
              color: "#6b7280",
            }}
          >
            Showing: {monthLabel(selectedMonth)}
          </span>
        )}
      </div>

      {/* Summary cards */}
      {summary ? (
        <section className="summary-grid">
          <div className="card">
            <div className="card-label">Total Spent</div>
            <div className="card-value">
              ₹{summary.total_spent.toFixed(2)}
            </div>
          </div>
          <div className="card">
            <div className="card-label">Total Income</div>
            <div className="card-value">
              ₹{summary.total_income.toFixed(2)}
            </div>
          </div>
          <div
            className={`card ${summary.net < 0 ? "negative" : "positive"}`}
          >
            <div className="card-label">Net (In - Spent)</div>
            <div className="card-value">₹{summary.net.toFixed(2)}</div>
          </div>
        </section>
      ) : (
        <section className="card">
          <h2>Overview</h2>
          <p>No summary yet.</p>
          <p style={{ fontSize: "0.85rem", color: "#6b7280" }}>
            Upload an SMS backup from <b>Settings</b> to see your expenses and
            income here.
          </p>
        </section>
      )}

      {/* Insights */}
      {summary && (
        <section className="card">
          <h2>Insights</h2>
          <ul style={{ fontSize: "0.9rem", color: "#4b5563", marginLeft: 16 }}>
            {topCategory && (
              <li>
                Biggest spend category for <b>{monthLabel(selectedMonth)}</b> is{" "}
                <b>{topCategory}</b> with{" "}
                <b>₹{topCategoryAmount.toFixed(2)}</b>.
              </li>
            )}
            <li>
              Net position for <b>{monthLabel(selectedMonth)}</b> is{" "}
              <b
                style={{
                  color: net >= 0 ? "#16a34a" : "#b91c1c",
                }}
              >
                ₹{net.toFixed(2)}
              </b>{" "}
              ({net >= 0 ? "surplus" : "deficit"}).
            </li>
          </ul>
        </section>
      )}

      {/* Category bar chart */}
      {summary && chartData.length > 0 && (
        <section className="card">
          <h2>Spending by category</h2>
          <p style={{ fontSize: "0.85rem", color: "#6b7280" }}>
            Relative size of each category for {monthLabel(selectedMonth)}.
          </p>
          <div
            style={{
              marginTop: 12,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            {chartData.map(([cat, amt]) => (
              <div
                key={cat}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: "0.85rem",
                }}
              >
                <div
                  style={{
                    width: 110,
                    textAlign: "right",
                    paddingRight: 4,
                    color: "#4b5563",
                  }}
                >
                  {cat}
                </div>
                <div
                  style={{
                    flexGrow: 1,
                    height: 12,
                    borderRadius: 9999,
                    backgroundColor: "#e5e7eb",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: barWidth(amt),
                      height: "100%",
                      borderRadius: 9999,
                      background:
                        "linear-gradient(90deg, #3b82f6, #6366f1, #8b5cf6)",
                    }}
                  />
                </div>
                <div
                  style={{
                    width: 80,
                    textAlign: "right",
                    color: "#4b5563",
                  }}
                >
                  ₹{amt.toFixed(0)}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Category breakdown table */}
      <section className="card">
        <h2>Category Breakdown</h2>
        {summary ? (
          <table className="category-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(categoryTotals).map(([cat, amt]) => (
                <tr key={cat}>
                  <td>{cat}</td>
                  <td>₹{amt.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No data for categories yet.</p>
        )}
      </section>
    </>
  );
}

export default Dashboard;
