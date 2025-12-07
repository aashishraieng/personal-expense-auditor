function Navbar({ activeTab, onChangeTab, currentUser, onLogout }) {
  return (
    <header className="navbar">
      <div className="navbar-title">Personal Expense Auditor</div>

      <nav className="navbar-links">
        <button
          className={`nav-btn ${activeTab === "dashboard" ? "active" : ""}`}
          onClick={() => onChangeTab("dashboard")}
        >
          Dashboard
        </button>
        <button
          className={`nav-btn ${activeTab === "transactions" ? "active" : ""}`}
          onClick={() => onChangeTab("transactions")}
        >
          Transactions
        </button>
        <button
          className={`nav-btn ${activeTab === "settings" ? "active" : ""}`}
          onClick={() => onChangeTab("settings")}
        >
          Settings
        </button>
      </nav>

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: "0.8rem", color: "#e5e7eb" }}>
          {currentUser?.email}
        </span>
        <button className="nav-btn" onClick={onLogout}>
          Logout
        </button>
      </div>
    </header>
  );
}

export default Navbar;
