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

  // ---- App state ----
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

  // ---- Stats state ----
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState("");
  
   // ---- Monthly summary state ----
  const [monthlySummary, setMonthlySummary] = useState([]);

   // ---- Insights state ----
  const [insights, setInsights] = useState(null);

  // ---- Budgets state ----
  const [budgets, setBudgets] = useState([]);
  const [budgetsLoading, setBudgetsLoading] = useState(false);
  const [budgetsError, setBudgetsError] = useState("");
 // ---- Recurring payments state ----
  const [recurring, setRecurring] = useState([]);

  // current-month totals returned by /api/current-month-totals
const [currentMonthTotals, setCurrentMonthTotals] = useState({});
const [currentMonthTotalsLoading, setCurrentMonthTotalsLoading] = useState(false);


  // ---- Alerts state ----
  const [alerts, setAlerts] = useState([]);
  const [alertsLoading, setAlertsLoading] = useState(false);

  // ---- Helpers ----

   // ---- Alerts fetch ----
  const fetchAlerts = async () => {
    if (!token) return;
    setAlertsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/alerts`, {
        headers: authHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAlerts([]);
        return;
      }
      setAlerts(data.items || []);
    } catch (err) {
      console.error(err);
      setAlerts([]);
    } finally {
      setAlertsLoading(false);
    }
  };

  const fetchCurrentMonthTotals = async (monthValue) => {
  if (!token) return;
  setCurrentMonthTotalsLoading(true);
  try {
    let url = `${API_BASE}/api/current-month-totals`;
    if (monthValue && monthValue !== "all") {
      url += `?month=${monthValue}`;
    }
    const res = await fetch(url, { headers: authHeaders() });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("Failed to load current month totals", data);
      setCurrentMonthTotals({});
      return;
    }
    setCurrentMonthTotals(data.totals || {});
  } catch (err) {
    console.error(err);
    setCurrentMonthTotals({});
  } finally {
    setCurrentMonthTotalsLoading(false);
  }
};

      const fetchRecurring = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/recurring`, {
        headers: authHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error("Failed to load recurring payments", data);
        setRecurring([]);
        return;
      }
      setRecurring(data.items || []);
    } catch (err) {
      console.error(err);
      setRecurring([]);
    }
  };

    const fetchBudgets = async () => {
    if (!token) return;
    setBudgetsLoading(true);
    setBudgetsError("");
    try {
      const res = await fetch(`${API_BASE}/api/budgets`, {
        headers: authHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setBudgets([]);
        setBudgetsError(data.error || "Failed to load budgets");
        return;
      }
      setBudgets(data.items || []);
    } catch (err) {
      console.error(err);
      setBudgets([]);
      setBudgetsError("Failed to load budgets");
    } finally {
      setBudgetsLoading(false);
    }
  };


  const shorten = (text, max = 90) => {
    if (!text) return "";
    return text.length > max ? text.slice(0, max) + "…" : text;
  };

  const monthLabel = (m) => {
    if (!m || m === "all") return "All time";
    return m;
  };

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

  // ---- Stats fetch ----

  const fetchStats = async () => {
    if (!token) return;
    setStatsLoading(true);
    setStatsError("");
    try {
      const res = await fetch(`${API_BASE}/api/stats`, {
        headers: authHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStats(null);
        setStatsError(data.error || "Failed to load stats");
        return;
      }
      setStats({
        count: data.count || 0,
        first_date: data.first_date || null,
        last_date: data.last_date || null,
      });
    } catch (err) {
      console.error(err);
      setStats(null);
      setStatsError("Failed to load stats");
    } finally {
      setStatsLoading(false);
    }
  };

  // ---- Auth bootstrap ----

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

  // ---- Delete my data / account ----

  const handleDeleteMyData = async () => {
    if (!token) {
      alert("Please login first.");
      return;
    }

    const ok = window.confirm(
      "This will delete ALL your transactions for this account. Continue?"
    );
    if (!ok) return;

    try {
      const res = await fetch(`${API_BASE}/api/my-data`, {
        method: "DELETE",
        headers: authHeaders(),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert("Delete failed: " + (data.error || res.status));
        return;
      }

      setSummary(null);
      setCategoryTotals({});
      setTransactions([]);
      setMonthsAvailable([]);
      setSelectedMonth("all");
      setStats(null);

      alert(`Deleted ${data.deleted || 0} transactions for this user.`);
    } catch (err) {
      console.error(err);
      alert("Error deleting data.");
    }
  };

  const handleDeleteAccount = async () => {
    if (!token) {
      alert("Please login first.");
      return;
    }

    const ok = window.confirm(
      "This will delete your account AND all your transactions permanently.\nYou will be logged out.\n\nContinue?"
    );
    if (!ok) return;

    try {
      const res = await fetch(`${API_BASE}/auth/delete-account`, {
        method: "DELETE",
        headers: authHeaders(),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert("Account delete failed: " + (data.error || res.status));
        return;
      }

      window.localStorage.removeItem("paea_token");
      setToken(null);
      setCurrentUser(null);

      setSummary(null);
      setCategoryTotals({});
      setTransactions([]);
      setMonthsAvailable([]);
      setSelectedMonth("all");
      setStats(null);
      setActiveTab("dashboard");

      alert(
        `Account deleted. Removed ${data.sms_deleted || 0} transactions.\nYou are now logged out.`
      );
    } catch (err) {
      console.error(err);
      alert("Error deleting account.");
    }
  };

  const handleExportCSV = async () => {
  if (!token) {
    alert("Please login first.");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/export`, {
      headers: authHeaders(),
    });

    if (!res.ok) {
      alert("Export failed.");
      return;
    }

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "transactions_export.csv";
    a.click();
    window.URL.revokeObjectURL(url);
  } catch (err) {
    console.error(err);
    alert("Export error.");
  }
};


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

      const resMe = await fetch(`${API_BASE}/auth/me`, {
        headers: authHeaders({ Authorization: `Bearer ${data.token}` }),
      });
      if (resMe.ok) {
        const me = await resMe.json();
        setCurrentUser(me);
        if (me.is_admin) {
          setIsAdmin(true);   // create this state in App.jsx: const [isAdmin, setIsAdmin] = useState(false)
        } else {
          setIsAdmin(false);
        }
      }


      setSummary(null);
      setCategoryTotals({});
      setTransactions([]);
      setSelectedMonth("all");
      await fetchStats();
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
    setStats(null);
    setActiveTab("dashboard");
  };

  // ---- Summary fetch ----

  const fetchSummary = async (monthValue) => {
    if (!token) return;
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

  // ---- Effects ----

  useEffect(() => {
    if (token) {
      fetchSummary(selectedMonth);
      fetchStats();
      fetchMonthlySummary();
      fetchInsights(selectedMonth);
      fetchBudgets();
      fetchRecurring();
      fetchCurrentMonthTotals(selectedMonth);
      fetchAlerts(); // <-- fetch alerts here
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

  // ---- Upload (used from Settings) ----

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
        headers: authHeaders(),
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Upload failed");
      }

      const data = await res.json();

      if (data.summary) {
        await fetchSummary(selectedMonth);
        await fetchStats();
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
    const fetchMonthlySummary = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/monthly-summary`, {
        headers: authHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error("Failed to load monthly summary", data);
        setMonthlySummary([]);
        return;
      }
      setMonthlySummary(data.items || []);
    } catch (err) {
      console.error(err);
      setMonthlySummary([]);
    }
  };

  const fetchInsights = async (monthValue) => {
    if (!token) return;

    try {
      let url = `${API_BASE}/api/insights`;
      // If a specific month is selected, pass it; if "all", let backend use latest
      if (monthValue && monthValue !== "all") {
        url += `?month=${monthValue}`;
      }

      const res = await fetch(url, {
        headers: authHeaders(),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        console.error("Failed to load insights", data);
        setInsights(null);
        return;
      }

      setInsights(data);
    } catch (err) {
      console.error(err);
      setInsights(null);
    }
  };

    const knownBudgetCategories = [
    "Debit",
    "Shopping/UPI",
    "Travel",
    "Other",
  ];

  const getBudgetValue = (category) => {
    const found = budgets.find((b) => b.category === category);
    return found ? String(found.monthly_limit) : "";
  };

  const handleBudgetChange = (category, value) => {
    setBudgets((prev) => {
      const numeric = value === "" ? "" : Number(value);
      // keep as string in UI; convert to number on save
      const exists = prev.find((b) => b.category === category);
      if (!exists) {
        return [...prev, { id: null, category, monthly_limit: value }];
      }
      return prev.map((b) =>
        b.category === category ? { ...b, monthly_limit: value } : b
      );
    });
  };

  const handleSaveBudgets = async () => {
    if (!token) {
      alert("Please login first.");
      return;
    }

    const items = knownBudgetCategories
      .map((cat) => {
        const val = getBudgetValue(cat);
        if (val === "") return null;
        const num = Number(val);
        if (Number.isNaN(num) || num <= 0) return null;
        return { category: cat, monthly_limit: num };
      })
      .filter(Boolean);

    if (items.length === 0) {
      const ok = window.confirm(
        "No valid positive limits entered. This will clear all budgets for your account. Continue?"
      );
      if (!ok) return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/budgets`, {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ items }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert("Failed to save budgets: " + (data.error || res.status));
        return;
      }
      alert("Budgets saved.");
      // reload from server so we stay in sync
      fetchBudgets();
    } catch (err) {
      console.error(err);
      alert("Error saving budgets.");
    }
  };


  // ---- Transaction filters ----

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

  // ---- Auth screen ----

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

  // ---- Main UI ----

  return (
    <div className="app-root">
      <Navbar
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        currentUser={currentUser}
        onLogout={handleLogout}
        alerts={alerts}                 // <-- pass alerts
        refreshAlerts={fetchAlerts}
      />

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
            monthlySummary={monthlySummary}
            insights={insights}
            budgets={budgets}
            recurring={recurring}
            currentMonthTotals={currentMonthTotals}
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
          <>
            <section className="card">
              <h2>Settings</h2>
              <p style={{ fontSize: "0.9rem", color: "#4b5563" }}>
                Logged in as <b>{currentUser?.email}</b>
              </p>

              <hr style={{ margin: "12px 0" }} />

              <h3 style={{ marginBottom: 6 }}>Data overview</h3>
              {statsLoading ? (
                <p style={{ fontSize: "0.85rem", color: "#6b7280" }}>
                  Loading stats...
                </p>
              ) : statsError ? (
                <p
                  style={{
                    fontSize: "0.85rem",
                    color: "#b91c1c",
                  }}
                >
                  {statsError}
                </p>
              ) : stats && stats.count > 0 ? (
                <ul
                  style={{
                    fontSize: "0.85rem",
                    color: "#4b5563",
                    marginLeft: 16,
                    marginBottom: 8,
                  }}
                >
                  <li>
                    Total transactions: <b>{stats.count}</b>
                  </li>
                  {stats.first_date && (
                    <li>
                      From: <b>{stats.first_date}</b>
                    </li>
                  )}
                  {stats.last_date && (
                    <li>
                      Latest: <b>{stats.last_date}</b>
                    </li>
                  )}
                </ul>
              ) : (
                <p style={{ fontSize: "0.85rem", color: "#6b7280" }}>
                  No transactions stored yet for this account.
                </p>
              )}

              <hr style={{ margin: "12px 0" }} />

              <h3 style={{ marginBottom: 6 }}>Data control</h3>
              <p style={{ fontSize: "0.85rem", color: "#6b7280" }}>
                You can delete all transactions for this account. This will not
                delete your login, only the SMS/transaction records.
              </p>

              <button
                className="primary-btn"
                style={{ marginTop: 10 }}
                type="button"
                onClick={handleDeleteMyData}
              >
                Delete all my data
              </button>

              <hr style={{ margin: "16px 0" }} />

              <h3 style={{ marginBottom: 6 }}>Account</h3>
              <p style={{ fontSize: "0.85rem", color: "#b91c1c" }}>
                Deleting your account will remove your login and all
                transactions. This cannot be undone.
              </p>

              <button
                className="primary-btn"
                style={{ marginTop: 10, backgroundColor: "#b91c1c" }}
                type="button"
                onClick={handleDeleteAccount}
              >
                Delete my account
              </button>
            </section>

            {/* New Budgets card */}
            <section className="card">
              <h2>Budgets</h2>
              <p style={{ fontSize: "0.85rem", color: "#6b7280" }}>
                Set monthly limits for key spending categories. We&apos;ll use
                these to warn you when you are close to or over your limits.
              </p>

              {budgetsLoading && (
                <p style={{ fontSize: "0.85rem", color: "#6b7280" }}>
                  Loading budgets...
                </p>
              )}
              {budgetsError && (
                <p style={{ fontSize: "0.85rem", color: "#b91c1c" }}>
                  {budgetsError}
                </p>
              )}

              <table className="category-table" style={{ marginTop: 12 }}>
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Monthly limit (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {knownBudgetCategories.map((cat) => (
                    <tr key={cat}>
                      <td>{cat}</td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          step="100"
                          value={getBudgetValue(cat)}
                          onChange={(e) =>
                            handleBudgetChange(cat, e.target.value)
                          }
                          placeholder="e.g. 10000"
                          style={{
                            width: "100%",
                            padding: "4px 6px",
                            borderRadius: "6px",
                            border: "1px solid #d1d5db",
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <button
                className="primary-btn"
                style={{ marginTop: 10 }}
                type="button"
                onClick={handleSaveBudgets}
              >
                Save budgets
              </button>
            </section>

            <section className="card">
              <h2>Manual SMS backup upload</h2>
              <p style={{ fontSize: "0.85rem", color: "#6b7280" }}>
                If automatic phone sync is not available yet, you can import
                your SMS by uploading a backup file exported from{" "}
                <b>SMS Backup &amp; Restore</b> (XML) or a CSV.
              </p>

              <form
                onSubmit={handleUpload}
                style={{
                  marginTop: 12,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                <input type="file" name="file" accept=".xml,.csv" />
                <button
                  type="submit"
                  className="primary-btn"
                  disabled={uploading}
                >
                  {uploading ? "Uploading..." : "Upload &amp; Process"}
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
            </section>
          </>
        )}

      </main>
    </div>
  );
}

export default App;
