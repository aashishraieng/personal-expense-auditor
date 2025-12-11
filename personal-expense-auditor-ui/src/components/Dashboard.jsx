import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
  CartesianGrid,
} from "recharts";

function Dashboard({
  summary,
  categoryTotals,
  monthsAvailable,
  selectedMonth,
  setSelectedMonth,
  monthlySummary,
  insights,
  budgets,
  recurring,
  currentMonthTotals,
}) {
  const monthLabel = (m) => {
    if (!m || m === "all") return "All time";
    return m;
  };

  // --- Top category & net, prefer backend insights when available ---
  let topCategory = null;
  let topCategoryAmount = 0;

  const entries = Object.entries(categoryTotals || {});
  if (entries.length > 0) {
    entries.sort((a, b) => b[1] - a[1]); // fallback if no insights
    [topCategory, topCategoryAmount] = entries[0];
  }

  if (insights && insights.top_category) {
    topCategory = insights.top_category.category;
    topCategoryAmount = insights.top_category.amount;
  }

  const net = insights ? insights.net : summary ? summary.net : 0;

  // --- Data for category bar chart ---
  const chartData = entries;
  const maxAmount = chartData.length
    ? Math.max(...chartData.map(([, amt]) => amt))
    : 0;

  const barWidth = (amt) => {
    if (!maxAmount || maxAmount <= 0) return "0%";
    const pct = (amt / maxAmount) * 100;
    return `${pct.toFixed(1)}%`;
  };

  // --- Monthly summary chart data ---
  const monthlyChartData = (monthlySummary || []).map((item) => ({
    month: item.month,
    spent: Number(item.spent || 0),
    income: Number(item.income || 0),
    net: Number(item.net || 0),
  }));

  const hasMonthlyData = monthlyChartData.length > 0;

  // --- Budgets & warnings: use currentMonthTotals when available ---
  const monthTotals =
    currentMonthTotals && Object.keys(currentMonthTotals).length > 0
      ? currentMonthTotals
      : categoryTotals || {};

  const budgetList = Array.isArray(budgets) ? budgets : [];

  const budgetRows = budgetList.map((b) => {
    const cat = b.category;
    const limit = Number(b.monthly_limit || 0);
    const spent = Number(monthTotals?.[cat] || 0);
    const ratio = limit > 0 ? spent / limit : 0;
    let status = "ok";
    if (ratio >= 1) status = "over";
    else if (ratio >= 0.75) status = "warning";
    return {
      category: cat,
      limit,
      spent,
      ratio,
      status,
    };
  });

  // --- Recurring payments ---
  const recurringItems = Array.isArray(recurring) ? recurring : [];

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
          <div className={`card ${net < 0 ? "negative" : "positive"}`}>
            <div className="card-label">Net (In - Spent)</div>
            <div className="card-value">₹{net.toFixed(2)}</div>
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
              <b style={{ color: net >= 0 ? "#16a34a" : "#b91c1c" }}>
                ₹{net.toFixed(2)}
              </b>{" "}
              ({net >= 0 ? "surplus" : "deficit"}).
            </li>

            {insights &&
              Array.isArray(insights.spikes) &&
              insights.spikes.length > 0 &&
              insights.spikes.map((s) => (
                <li key={s.category}>
                  Spending in <b>{s.category}</b> is about{" "}
                  <b>
                    {typeof s.ratio === "number" ? s.ratio.toFixed(1) : s.ratio}
                    ×
                  </b>{" "}
                  your usual average (₹
                  {s.current && s.current.toFixed
                    ? s.current.toFixed(2)
                    : s.current}
                  vs avg previous ₹
                  {s.avg_previous && s.avg_previous.toFixed
                    ? s.avg_previous.toFixed(2)
                    : s.avg_previous}
                  ).
                </li>
              ))}
          </ul>
        </section>
      )}

      {/* Budgets & warnings */}
      {summary && budgetRows.length > 0 && (
        <section className="card">
          <h2>Budgets &amp; warnings</h2>
          <p style={{ fontSize: "0.85rem", color: "#6b7280" }}>
            For the selected period, this compares your spending to your monthly
            limits.
          </p>

          <table className="category-table" style={{ marginTop: 12 }}>
            <thead>
              <tr>
                <th>Category</th>
                <th>Spent (₹)</th>
                <th>Limit (₹)</th>
                <th>Progress</th>
              </tr>
            </thead>
            <tbody>
              {budgetRows.map((row) => {
                const pct = row.limit > 0 ? (row.spent / row.limit) * 100 : 0;
                let barColor = "#22c55e"; // green
                if (row.status === "warning") barColor = "#eab308"; // amber
                if (row.status === "over") barColor = "#ef4444"; // red

                return (
                  <tr key={row.category}>
                    <td>{row.category}</td>
                    <td>₹{row.spent.toFixed(2)}</td>
                    <td>₹{row.limit.toFixed(2)}</td>
                    <td>
                      <div
                        style={{
                          minWidth: 180,
                          maxWidth: 260,
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <div
                          style={{
                            flexGrow: 1,
                            height: 10,
                            borderRadius: 9999,
                            backgroundColor: "#e5e7eb",
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              width: `${Math.min(pct, 130).toFixed(1)}%`,
                              height: "100%",
                              borderRadius: 9999,
                              backgroundColor: barColor,
                            }}
                          />
                        </div>
                        <span
                          style={{
                            fontSize: "0.8rem",
                            color: row.status === "over" ? "#b91c1c" : "#4b5563",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {pct.toFixed(0)}%
                          {row.status === "over"
                            ? " (over)"
                            : row.status === "warning"
                            ? " (high)"
                            : ""}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      {/* Recurring payments */}
      {summary && recurringItems.length > 0 && (
        <section className="card">
          <h2>Recurring payments</h2>
          <p style={{ fontSize: "0.85rem", color: "#6b7280" }}>
            These look like subscriptions or regular payments based on repeated
            similar amounts over time.
          </p>

          <table className="category-table" style={{ marginTop: 12 }}>
            <thead>
              <tr>
                <th>Category</th>
                <th>Amount (₹)</th>
                <th>Times charged</th>
                <th>First seen</th>
                <th>Last seen</th>
              </tr>
            </thead>
            <tbody>
              {recurringItems.map((item, idx) => (
                <tr key={`${item.category}-${item.amount}-${idx}`}>
                  <td>{item.category}</td>
                  <td>
                    ₹
                    {typeof item.amount === "number"
                      ? item.amount.toFixed(2)
                      : item.amount}
                  </td>
                  <td>{item.count}</td>
                  <td>{item.first_date || "-"}</td>
                  <td>{item.last_date || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* Monthly trend charts */}
      {hasMonthlyData && (
        <section className="card">
          <h2>Monthly trends</h2>
          <p style={{ fontSize: "0.85rem", color: "#6b7280" }}>
            See how your spending and income change month to month.
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0,1fr)",
              gap: 16,
              marginTop: 16,
            }}
          >
            {/* Net line chart */}
            <div style={{ width: "100%", height: 260 }}>
              <h3 style={{ fontSize: "0.9rem", marginBottom: 4, color: "#4b5563" }}>
                Net balance per month
              </h3>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="net"
                    stroke="#2563eb"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Spent vs Income bar chart */}
            <div style={{ width: "100%", height: 260 }}>
              <h3 style={{ fontSize: "0.9rem", marginBottom: 4, color: "#4b5563" }}>
                Spent vs Income
              </h3>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="spent" name="Spent" fill="#ef4444" />
                  <Bar dataKey="income" name="Income" fill="#22c55e" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
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
                <div style={{ width: 80, textAlign: "right", color: "#4b5563" }}>
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
