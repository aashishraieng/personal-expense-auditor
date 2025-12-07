function Dashboard({
  summary,
  categoryTotals,
  monthsAvailable,
  selectedMonth,
  setSelectedMonth,
  uploading,
  lastUpdated,
  onUpload,
}) {
  const monthLabel = (m) => {
    if (!m || m === "all") return "All time";
    return m;
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
      {summary && (
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
      )}

      {/* Upload + Category breakdown */}
      <section className="layout-grid">
        {/* Upload panel */}
        <div className="card">
          <h2>Upload SMS Backup</h2>
          <p>Upload your SMS backup XML file exported from your phone.</p>
          <form onSubmit={onUpload}>
            <input type="file" name="file" />
            <br />
            <button className="primary-btn" type="submit" disabled={uploading}>
              {uploading ? "Uploading..." : "Upload & Process"}
            </button>
          </form>
          {lastUpdated && (
            <p
              style={{
                marginTop: "8px",
                fontSize: "0.8rem",
                color: "#6b7280",
              }}
            >
              Last updated: {lastUpdated}
            </p>
          )}
        </div>

        {/* Category breakdown */}
        <div className="card">
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
            <p>No summary yet. Upload a file to see breakdown.</p>
          )}
        </div>
      </section>
    </>
  );
}

export default Dashboard;
