import { useState } from "react";

function AuthScreen({
  authMode,
  setAuthMode,
  authError,
  authLoading,
  onLogin,
  onSignup,
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const onSubmit = (e) => {
    e.preventDefault();
    if (!email || !password) {
      // let parent set error if you want, but for now just simple alert
      alert("Email and password are required.");
      return;
    }
    if (authMode === "login") {
      onLogin(email, password);
    } else {
      onSignup(email, password);
    }
  };

  return (
    <div className="app-root" style={{ justifyContent: "center" }}>
      <main className="main" style={{ maxWidth: 420, margin: "0 auto" }}>
        <div className="card">
          <h2 style={{ marginBottom: "4px" }}>Personal AI Expense Auditor</h2>
          <p style={{ fontSize: "0.9rem", color: "#4b5563", marginBottom: 12 }}>
            AI-powered personal expense tracker &amp; SMS analyzer.
          </p>

          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <button
              className={`nav-btn ${authMode === "login" ? "active" : ""}`}
              type="button"
              onClick={() => setAuthMode("login")}
            >
              Login
            </button>
            <button
              className={`nav-btn ${authMode === "signup" ? "active" : ""}`}
              type="button"
              onClick={() => setAuthMode("signup")}
            >
              Sign up
            </button>
          </div>

          {authError && <div className="error-banner">{authError}</div>}
          {authLoading && (
            <div className="info-banner">Checking session...</div>
          )}

          <form onSubmit={onSubmit}>
            <div style={{ marginBottom: 8 }}>
              <label style={{ fontSize: "0.85rem", color: "#4b5563" }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  width: "100%",
                  padding: "6px 8px",
                  borderRadius: "6px",
                  marginTop: 4,
                }}
              />
            </div>

            <div style={{ marginBottom: 8 }}>
              <label style={{ fontSize: "0.85rem", color: "#4b5563" }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  width: "100%",
                  padding: "6px 8px",
                  borderRadius: "6px",
                  marginTop: 4,
                }}
              />
            </div>

            <button
              className="primary-btn"
              type="submit"
              disabled={authLoading}
              style={{ width: "100%", marginTop: 8 }}
            >
              {authMode === "login"
                ? authLoading
                  ? "Logging in..."
                  : "Login"
                : authLoading
                ? "Signing up..."
                : "Sign up"}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}

export default AuthScreen;
