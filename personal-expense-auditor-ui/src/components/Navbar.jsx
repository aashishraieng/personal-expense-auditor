import React from "react";


export default function Navbar({
  activeTab,
  onChangeTab,
  currentUser,
  onLogout,
}) {
  return (
    <nav className="navbar-root">
      <div className="navbar-left">
        <div className="app-title">Personal Expense Auditor</div>

        <button
          className={activeTab === "dashboard" ? "nav-btn active" : "nav-btn"}
          onClick={() => onChangeTab("dashboard")}
        >
          Dashboard
        </button>

        <button
          className={activeTab === "transactions" ? "nav-btn active" : "nav-btn"}
          onClick={() => onChangeTab("transactions")}
        >
          Transactions
        </button>

        <button
          className={activeTab === "settings" ? "nav-btn active" : "nav-btn"}
          onClick={() => onChangeTab("settings")}
        >
          Settings
        </button>

        {/* ⭐ Show ADMIN only for true admins */}
        {currentUser?.is_admin === true && (
          <button
            className={activeTab === "admin" ? "nav-btn active" : "nav-btn"}
            onClick={() => onChangeTab("admin")}
            style={{ color: "#dc2626", fontWeight: 600 }}
          >
            Admin
          </button>
        )}
      </div>

      <div className="navbar-right">
        <span className="user-email">{currentUser?.email}</span>

        <button className="logout-btn" onClick={onLogout}>
          Logout
        </button>
      </div>
    </nav>
  );
}
