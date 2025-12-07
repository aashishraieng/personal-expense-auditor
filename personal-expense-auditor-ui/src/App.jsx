import { useEffect, useState } from "react";
import "./App.css";
import AuthScreen from "./components/AuthScreen";
import Navbar from "./components/Navbar";
import Dashboard from "./components/Dashboard";


const API_BASE = "http://127.0.0.1:5000";

function App() {
  // ---- Auth state ----
  const [token, setToken] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const [authMode, setAuthMode] = useState("login"); // "login" or "signup"

  // ---- Existing app state ----
  const [summary, setSummary] = useState(null);
  const [categoryTotals, setCategoryTotals] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  const [activeTab, setActiveTab] = useState("dashboard");

  const [transactions, setTransactions] = useState([]);
  const [txLoading, setTxLoading] = useState(false);
  const [txError, setTxError] = useState("");

  const [txCategoryFilter, setTxCategoryFilter] = useState("all");
  const [txSearch, setTxSearch] = useState("");

  const [monthsAvailable, setMonthsAvailable] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState("all");

  // ---- Helpers ----

  const shorten = (text, max = 90) => {
    if (!text) return "";
    return text.length > max ? text.slice(0, max) + "…" : text;
  };

  const monthLabel = (m) => {
    if (!m || m === "all") return "All time";
    return m;
  };

  // Build headers with token
  const authHeaders = (extra = {}) => {
    const h = { ...extra };
    if (token) {
      h["Authorization"] = `Bearer ${token}`;
    }
    return h;
  };

  const categoryChartData = Object.entries(categoryTotals).map(
    ([cat, amt]) => ({
      category: cat,
      amount: amt,
    })
  );

  // ---- Auth bootstrap: load token from localStorage & validate ----

  useEffect(() => {
    const savedToken = window.localStorage.getItem("paea_token");
    if (!savedToken) {
      setAuthLoading(false);
      return;
    }

    const validate = async () => {
      try {
        setAuthLoading(true);
        setAuthError("");
        const res = await fetch(`${API_BASE}/auth/me`, {
          headers: authHeaders({ Authorization: `Bearer ${savedToken}` }),
        });
        if (!res.ok) {
          window.localStorage.removeItem("paea_token");
          setToken(null);
          setCurrentUser(null);
        } else {
          const data = await res.json();
          setToken(savedToken);
          setCurrentUser(data);
        }
      } catch (err) {
        console.error(err);
        window.localStorage.removeItem("paea_token");
        setToken(null);
        setCurrentUser(null);
      } finally {
        setAuthLoading(false);
      }
    };

    validate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Auth actions ----

  const handleLogin = async (email, password) => {
    setAuthError("");
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.error || "Login failed");
        return;
      }
      if (!data.token) {
        setAuthError("No token returned from server.");
        return;
      }
      window.localStorage.setItem("paea_token", data.token);
      setToken(data.token);

      // Fetch user info
      const resMe = await fetch(`${API_BASE}/auth/me`, {
        headers: authHeaders({ Authorization: `Bearer ${data.token}` }),
      });
      if (resMe.ok) {
        const me = await resMe.json();
        setCurrentUser(me);
      }

      // Reset app state
      setSummary(null);
      setCategoryTotals({});
      setTransactions([]);
      setSelectedMonth("all");
      setActiveTab("dashboard");
    } catch (err) {
      console.error(err);
      setAuthError("Login error");
    }
  };

  const handleSignup = async (email, password) => {
    setAuthError("");
    try {
      const res = await fetch(`${API_BASE}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.error || "Signup failed");
        return;
      }
      // Auto-login after signup:
      await handleLogin(email, password);
    } catch (err) {
      console.error(err);
      setAuthError("Signup error");
    }
  };

  const handleLogout = () => {
    window.localStorage.removeItem("paea_token");
    setToken(null);
    setCurrentUser(null);
    setSummary(null);
    setCategoryTotals({});
    setTransactions([]);
    setMonthsAvailable([]);
    setSelectedMonth("all");
    setActiveTab("dashboard");
  };

  // ---- Data fetching with auth ----

  const fetchSummary = async (monthValue) => {
    if (!token) return; // require login
    setLoading(true);
    setError("");
    try {
      let url = `${API_BASE}/api/summary`;
      if (monthValue && monthValue !== "all") {
        url += `?month=${monthValue}`;
      }
      const res = await fetch(url, {
        headers: authHeaders(),
      });
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

  // Fetch summary when month or token changes and user is logged in
  useEffect(() => {
    if (token) {
      fetchSummary(selectedMonth);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth, token]);

  useEffect(() => {
    const fetchTransactions = async () => {
      if (!token) return;
      setTxLoading(true);
      setTxError("");
      try {
        let url = `${API_BASE}/api/transactions?limit=200`;
        if (selectedMonth && selectedMonth !== "all") {
          url += `&month=${selectedMonth}`;
        }
        const res = await fetch(url, {
          headers: authHeaders(),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.error || "Failed to load transactions");
        }
        const data = await res.json();
        setTransactions(data.items || []);
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

    if (activeTab === "transactions" && token) {
      fetchTransactions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, selectedMonth, token]);

  const handleUpload = async (event) => {
    event.preventDefault();
    if (!token) {
      alert("Please login first.");
      return;
    }

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
        headers: authHeaders(), // Authorization only; don't set Content-Type here
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Upload failed");
      }

      const data = await res.json();

      if (data.summary) {
        await fetchSummary(selectedMonth);
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

  const transactionCategories = Array.from(
    new Set(transactions.map((tx) => tx.category))
  ).sort();

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

  

  // ---- If not logged in, show auth screen ----

    if (!token || !currentUser) {
    if (authLoading) {
      return (
        <div className="app-root">
          <main className="main">
            <div className="info-banner">Checking session...</div>
          </main>
        </div>
      );
    }
    return (
      <AuthScreen
        authMode={authMode}
        setAuthMode={setAuthMode}
        authError={authError}
        authLoading={authLoading}
        onLogin={handleLogin}
        onSignup={handleSignup}
      />
    );
  }

  // ---- Main app UI (user is logged in) ----

  return (
    <div className="app-root">
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      {/* Main Content */}
      <main className="main">
        {error && activeTab === "dashboard" && (
          <div className="error-banner">{error}</div>
        )}
        {loading && activeTab === "dashboard" && (
          <div className="info-banner">Loading summary...</div>
        )}

        {activeTab === "dashboard" && (
          <Dashboard
            summary={summary}
            categoryTotals={categoryTotals}
            monthsAvailable={monthsAvailable}
            selectedMonth={selectedMonth}
            setSelectedMonth={setSelectedMonth}
            uploading={uploading}
            lastUpdated={lastUpdated}
            onUpload={handleUpload}
          />
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
                                    headers: authHeaders({
                                      "Content-Type": "application/json",
                                    }),
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

                                setTransactions((prev) =>
                                  prev.map((t) =>
                                    t.id === tx.id
                                      ? { ...t, category: newCat }
                                      : t
                                  )
                                );

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
