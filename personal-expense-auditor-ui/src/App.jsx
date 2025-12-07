import { useEffect, useState } from "react";
import "./App.css";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";


const API_BASE = "http://127.0.0.1:5000";

function App() {
  const [summary, setSummary] = useState(null);
  const [categoryTotals, setCategoryTotals] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Tabs
  const [activeTab, setActiveTab] = useState("dashboard");

  // Transactions state
  const [transactions, setTransactions] = useState([]);
  const [txLoading, setTxLoading] = useState(false);
  const [txError, setTxError] = useState("");

  // Filters
  const [txCategoryFilter, setTxCategoryFilter] = useState("all");
  const [txSearch, setTxSearch] = useState("");

  // NEW: month selection
  const [monthsAvailable, setMonthsAvailable] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState("all"); // "all" or "YYYY-MM"

  // --- Helpers ---

  const shorten = (text, max = 90) => {
    if (!text) return "";
    return text.length > max ? text.slice(0, max) + "…" : text;
  };

  const monthLabel = (m) => {
    if (!m || m === "all") return "All time";
    return m; // could format nicer later
  };

  const categoryChartData = Object.entries(categoryTotals).map(
    ([cat, amt]) => ({
      category: cat,
      amount: amt,
    })
  );


  // --- Fetch summary (overall or by month) ---

  const fetchSummary = async (monthValue) => {
    setLoading(true);
    setError("");
    try {
      let url = `${API_BASE}/api/summary`;
      if (monthValue && monthValue !== "all") {
        url += `?month=${monthValue}`;
      }
      const res = await fetch(url);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Failed to load summary");
      }
      const data = await res.json();

      setSummary({
        total_spent: data.total_spent || 0,
        total_income: data.total_income || 0,
        net: data.net || 0,
      });
      setCategoryTotals(data.category_totals || {});
      setMonthsAvailable(data.months_available || []);
      setLastUpdated(new Date().toLocaleString());
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to load summary from backend.");
      setSummary(null);
      setCategoryTotals({});
    } finally {
      setLoading(false);
    }
  };

  // Initial load + when selectedMonth changes
  useEffect(() => {
    fetchSummary(selectedMonth);
  }, [selectedMonth]);

  // --- Fetch transactions (by month) when Transactions tab is active or month changes ---

  useEffect(() => {
    const fetchTransactions = async () => {
      setTxLoading(true);
      setTxError("");
      try {
        let url = `${API_BASE}/api/transactions?limit=200`;
        if (selectedMonth && selectedMonth !== "all") {
          url += `&month=${selectedMonth}`;
        }
        const res = await fetch(url);
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.error || "Failed to load transactions");
        }
        const data = await res.json();
        setTransactions(data.items || []);
        // months_available also returned here, but summary endpoint is main source
        if (data.months_available && data.months_available.length > 0) {
          setMonthsAvailable(data.months_available);
        }
      } catch (err) {
        console.error(err);
        setTxError(err.message || "Failed to load transactions");
        setTransactions([]);
      } finally {
        setTxLoading(false);
      }
    };

    if (activeTab === "transactions") {
      fetchTransactions();
    }
  }, [activeTab, selectedMonth]);

  // --- Upload handler ---

  const handleUpload = async (event) => {
    event.preventDefault();
    const fileInput = event.target.elements.file;
    if (!fileInput.files || fileInput.files.length === 0) {
      alert("Please choose a file first.");
      return;
    }

    const file = fileInput.files[0];
    const formData = new FormData();
    formData.append("file", file);

    setUploading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/upload`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Upload failed");
      }

      const data = await res.json();

      if (data.summary) {
        // Refresh summary using current month selection
        await fetchSummary(selectedMonth);
        // Force re-fetch of transactions when tab opened next
        setTransactions([]);
      } else {
        setError("File uploaded, but no summary generated.");
      }
    } catch (err) {
      console.error(err);
      setError(err.message || "Upload failed.");
    } finally {
      setUploading(false);
      event.target.reset();
    }
  };

  // Categories list for transaction filter
  const transactionCategories = Array.from(
    new Set(transactions.map((tx) => tx.category))
  ).sort();

  // Apply filters: category + search
    const filteredTransactions = transactions.filter((tx) => {
    if (txCategoryFilter !== "all" && tx.category !== txCategoryFilter) {
      return false;
    }
    if (txSearch.trim()) {
      const q = txSearch.toLowerCase();
      return (
        String(tx.text).toLowerCase().includes(q) ||
        String(tx.category).toLowerCase().includes(q)
      );
    }
    return true;
  });

  const filteredTotalAmount = filteredTransactions.reduce(
    (sum, tx) => sum + (tx.amount || 0),
    0
  );

  return (
    <div className="app-root">
      {/* Top Navbar */}
      <header className="navbar">
        <div className="navbar-title">Personal Expense Auditor</div>
        <nav className="navbar-links">
          <button
            className={`nav-btn ${activeTab === "dashboard" ? "active" : ""}`}
            onClick={() => setActiveTab("dashboard")}
          >
            Dashboard
          </button>
          <button
            className={`nav-btn ${
              activeTab === "transactions" ? "active" : ""
            }`}
            onClick={() => setActiveTab("transactions")}
          >
            Transactions
          </button>
          <button
            className={`nav-btn ${activeTab === "settings" ? "active" : ""}`}
            onClick={() => setActiveTab("settings")}
          >
            Settings
          </button>
        </nav>
      </header>

      {/* Main Content */}
      <main className="main">
        {error && activeTab === "dashboard" && (
          <div className="error-banner">{error}</div>
        )}
        {loading && activeTab === "dashboard" && (
          <div className="info-banner">Loading summary...</div>
        )}

        {activeTab === "dashboard" && (
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

            {/* Top summary cards */}
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
                  className={`card ${
                    summary.net < 0 ? "negative" : "positive"
                  }`}
                >
                  <div className="card-label">Net (In - Spent)</div>
                  <div className="card-value">
                    ₹{summary.net.toFixed(2)}
                  </div>
                </div>
              </section>
            )}

            {/* Upload + Category breakdown layout */}
            <section className="layout-grid">
              {/* Upload panel */}
              <div className="card">
                <h2>Upload SMS Backup</h2>
                <p>Upload your SMS backup XML file exported from your phone.</p>
                <form onSubmit={handleUpload}>
                  <input type="file" name="file" />
                  <br />
                  <button
                    className="primary-btn"
                    type="submit"
                    disabled={uploading}
                  >
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

                            {/* Category table + chart */}
              <div className="card">
                <h2>Category Breakdown</h2>
                {summary ? (
                  <>
                    {/* Chart */}
                    {categoryChartData.length > 0 && (
                      <div style={{ width: "100%", height: 220, marginBottom: 12 }}>
                        <ResponsiveContainer>
                          <BarChart data={categoryChartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="category" />
                            <YAxis />
                            <Tooltip
                              formatter={(value) =>
                                `₹${Number(value).toFixed(2)}`
                              }
                            />
                            <Bar dataKey="amount" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}

                    {/* Table */}
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
                  </>
                ) : (
                  <p>No summary yet. Upload a file to see breakdown.</p>
                )}
              </div>

            </section>
          </>
        )}

        {activeTab === "transactions" && (
          <section className="card">
            <h2>Recent Transactions</h2>
            {txError && <div className="error-banner">{txError}</div>}
            {txLoading && (
              <div className="info-banner">Loading transactions...</div>
            )}

            {/* Month + filters */}
            <div
              style={{
                display: "flex",
                gap: "12px",
                margin: "12px 0",
                flexWrap: "wrap",
              }}
            >
              {/* Month selector */}
              <div>
                <label
                  style={{ fontSize: "0.85rem", color: "#4b5563" }}
                  htmlFor="monthFilter"
                >
                  Month
                </label>
                <br />
                <select
                  id="monthFilter"
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
              </div>

              {/* Category filter */}
              <div>
                <label
                  style={{ fontSize: "0.85rem", color: "#4b5563" }}
                  htmlFor="categoryFilter"
                >
                  Category
                </label>
                <br />
                <select
                  id="categoryFilter"
                  value={txCategoryFilter}
                  onChange={(e) => setTxCategoryFilter(e.target.value)}
                  style={{ padding: "4px 6px", borderRadius: "6px" }}
                >
                  <option value="all">All</option>
                  {transactionCategories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Search box */}
              <div>
                <label
                  style={{ fontSize: "0.85rem", color: "#4b5563" }}
                  htmlFor="searchInput"
                >
                  Search text
                </label>
                <br />
                <input
                  id="searchInput"
                  type="text"
                  value={txSearch}
                  onChange={(e) => setTxSearch(e.target.value)}
                  placeholder="Search in SMS text..."
                  style={{
                    padding: "4px 6px",
                    borderRadius: "6px",
                    minWidth: "220px",
                  }}
                />
              </div>
            </div>

            {!txLoading && filteredTransactions.length === 0 && !txError && (
              <p>No transactions match the current filters.</p>
            )}

            {filteredTransactions.length > 0 && (
               <>
                <p
                  style={{
                    fontSize: "0.85rem",
                    color: "#4b5563",
                    marginBottom: "6px",
                  }}
                >
                  {filteredTransactions.length} transactions · Total amount: ₹
                  {filteredTotalAmount.toFixed(2)}
                </p>

              <table className="category-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Category</th>
                    <th>Amount (₹)</th>
                    <th>Text</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.map((tx) => (
                    <tr key={tx.id}>
                      <td style={{ whiteSpace: "nowrap" }}>{tx.date}</td>

                      {/* Category correction dropdown */}
                      <td>
                        <select
                          value={tx.category}
                          onChange={async (e) => {
                            const newCat = e.target.value;
                            try {
                              const res = await fetch(
                                `${API_BASE}/api/transactions/${tx.id}`,
                                {
                                  method: "PATCH",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ category: newCat }),
                                }
                              );
                              const data = await res.json();
                              if (!res.ok) {
                                alert(
                                  "Update failed: " +
                                    (data.error || "unknown error")
                                );
                                return;
                              }

                              // Update row immediately in UI
                              setTransactions((prev) =>
                                prev.map((t) =>
                                  t.id === tx.id ? { ...t, category: newCat } : t
                                )
                              );

                              // Refresh summary for current month
                              await fetchSummary(selectedMonth);
                            } catch (err) {
                              console.error(err);
                              alert("Update failed");
                            }
                          }}
                        >
                          <option value="Debit">Debit</option>
                          <option value="Credit">Credit</option>
                          <option value="Refund">Refund</option>
                          <option value="Shopping/UPI">Shopping/UPI</option>
                          <option value="Travel">Travel</option>
                          <option value="Account/Service">
                            Account/Service
                          </option>
                          <option value="Other">Other</option>
                        </select>
                      </td>

                      <td>₹{tx.amount.toFixed(2)}</td>
                      <td>{shorten(tx.text)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </>
            )}
          </section>
        )}

        {activeTab === "settings" && (
          <section className="card">
            <h2>Settings</h2>
            <p>Settings will go here in a later phase.</p>
          </section>
        )}
      </main>
    </div>
  );
}

export default App;
