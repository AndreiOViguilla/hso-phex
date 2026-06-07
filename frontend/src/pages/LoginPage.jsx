import { useState } from "react";

const Logo = () => (
  <div style={{ width: 60, height: 60, borderRadius: "50%", background: "#eff6ff", border: "2px solid #bfdbfe", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  </div>
);

const EyeIcon = ({ open }) => open ? (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
) : (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
);

// Simple in-memory "database" for demo
const USERS = {};

export default function LoginPage({ onLogin, onBack }) {
  const [tab,       setTab]       = useState("signin"); // "signin" | "register"
  const [idNumber,  setIdNumber]  = useState("");
  const [firstName,     setFirstName]     = useState("");
  const [lastName,      setLastName]      = useState("");
  const [middleInitial, setMiddleInitial] = useState("");
  const [gender,        setGender]        = useState("");
  const [email,     setEmail]     = useState("");
  const [password,  setPassword]  = useState("");
  const [confirm,   setConfirm]   = useState("");
  const [showPass,  setShowPass]  = useState(false);
  const [showConf,  setShowConf]  = useState(false);
  const [error,     setError]     = useState("");
  const [success,   setSuccess]   = useState("");
  const [loading,   setLoading]   = useState(false);

  const inp = (extra) => ({
    width: "100%", padding: "11px 14px", border: "1.5px solid #d1d5db",
    borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none",
    boxSizing: "border-box", background: "#fff", ...extra,
  });

  const reset = () => { setError(""); setSuccess(""); };

  const handleRegister = async () => {
    reset();
    if (idNumber.trim().length < 7)  { setError("Enter a valid student ID (7+ digits)."); return; }
    if (!email.includes("@"))         { setError("Enter a valid email address."); return; }
    if (password.length < 6)          { setError("Password must be at least 6 characters."); return; }
    if (password !== confirm)         { setError("Passwords do not match."); return; }

    setLoading(true);
    try {
      const resp = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ studentId: idNumber.trim(), email, password, firstName: firstName.trim() || email.split("@")[0], lastName: lastName.trim() || "-", middleInitial: middleInitial.trim(), gender }),
      });
      const data = await resp.json();
      if (!resp.ok) { setError(data.error || data.errors?.[0]?.msg || "Registration failed"); setLoading(false); return; }
      // Also store in memory as fallback
      USERS[email] = { idNumber: idNumber.trim(), password, middleInitial: middleInitial.trim() };
      setSuccess("Account created! You can now sign in.");
      setTab("signin");
      setPassword(""); setConfirm("");
    } catch {
      // No backend — use in-memory fallback
      if (USERS[email]) { setError("An account with this email already exists."); setLoading(false); return; }
      USERS[email] = { idNumber: idNumber.trim(), password };
      setSuccess("Account created! You can now sign in.");
      setTab("signin");
      setPassword(""); setConfirm("");
    }
    setLoading(false);
  };

  const handleSignIn = async () => {
    reset();
    if (!email.includes("@"))  { setError("Enter your email address."); return; }
    if (!password)             { setError("Enter your password."); return; }

    setLoading(true);
    try {
      const resp = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",  // send/receive cookies
        body: JSON.stringify({ email, password }),
      });
      const data = await resp.json();
      if (!resp.ok) { setError(data.error || "Login failed"); setLoading(false); return; }
      // Save JWT token for future API calls
      // Cookie set by server automatically — no localStorage needed
      setLoading(false);
      onLogin(data.user.studentId, data.user);
      return;
    } catch {
      // No backend — fall back to in-memory
    }

    // In-memory fallback for demo without backend
    const user = USERS[email];
    if (!user)                      { setError("No account found with this email."); setLoading(false); return; }
    if (user.password !== password) { setError("Incorrect password."); setLoading(false); return; }
    setLoading(false);
    onLogin(user.idNumber, user);
  };

  const submitBtn = (label) => (
    <button
      onClick={tab === "signin" ? handleSignIn : handleRegister}
      disabled={loading}
      style={{
        background: loading ? "#93c5fd" : "#1d4ed8", color: "#fff", border: "none",
        borderRadius: 10, padding: "13px", fontSize: 15, fontWeight: 700,
        cursor: loading ? "default" : "pointer", fontFamily: "inherit", width: "100%",
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 4,
      }}
    >
      {loading ? (
        <>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" style={{ animation: "spin 0.8s linear infinite" }}>
            <path d="M21 12a9 9 0 1 1-6.22-8.56"/>
          </svg>
          {tab === "signin" ? "Signing in…" : "Creating account…"}
        </>
      ) : label}
    </button>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#f0f2f5", display: "flex", flexDirection: "column", fontFamily: "'DM Sans','Inter',sans-serif" }}>

      {/* Top bar */}
      <div style={{ background: "#1e3a8a", padding: "12px 24px", display: "flex", alignItems: "center", gap: 10 }}>
        {onBack && (
          <button onClick={onBack} style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", width: 32, height: 32, borderRadius: 8, cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginRight: 4 }}>←</button>
        )}
        <span style={{ color: "#fff", fontSize: 13, fontWeight: 600, letterSpacing: "0.04em" }}>DLSU · Health Services Office</span>
      </div>

      {/* Card */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 16px" }}>
        <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", padding: "36px 32px", width: "100%", maxWidth: 400 }}>

          <Logo />
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#111827", marginBottom: 4 }}>PHEx Portal</div>
            <div style={{ fontSize: 13, color: "#6b7280" }}>AY 2025–2026 · Manila Campus</div>
          </div>

          {/* Tabs */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", background: "#f3f4f6", borderRadius: 10, padding: 4, marginBottom: 22, gap: 4 }}>
            {[["signin", "Sign in"], ["register", "Register"]].map(([key, label]) => (
              <button key={key} onClick={() => { setTab(key); reset(); }}
                style={{
                  padding: "9px", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 700,
                  cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s",
                  background: tab === key ? "#fff" : "transparent",
                  color: tab === key ? "#111827" : "#6b7280",
                  boxShadow: tab === key ? "0 1px 4px rgba(0,0,0,0.1)" : "none",
                }}>
                {label}
              </button>
            ))}
          </div>

          {/* Success message */}
          {success && (
            <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "10px 12px", fontSize: 12, color: "#16a34a", marginBottom: 14, display: "flex", gap: 6, alignItems: "center" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              {success}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

            {/* Register only — student ID + name */}
            {tab === "register" && (
              <>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 5 }}>Student ID number</label>
                  <input style={inp()} placeholder="e.g. 12512345" value={idNumber} maxLength={10}
                    onChange={e => setIdNumber(e.target.value)} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 60px", gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 5 }}>First name</label>
                    <input style={inp()} placeholder="Juan" value={firstName}
                      onChange={e => setFirstName(e.target.value)} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 5 }}>Last name</label>
                    <input style={inp()} placeholder="Dela Cruz" value={lastName}
                      onChange={e => setLastName(e.target.value)} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 5 }}>M.I.</label>
                    <input style={inp()} placeholder="O." value={middleInitial} maxLength={3}
                      onChange={e => setMiddleInitial(e.target.value)} />
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 8 }}>Gender</label>
                  <div style={{ display: "flex", gap: 12 }}>
                    {["Female", "Male"].map(g => (
                      <label key={g} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 14, color: "#374151", flex: 1, padding: "10px 14px", border: `1.5px solid ${gender === g ? "#1d4ed8" : "#d1d5db"}`, borderRadius: 8, background: gender === g ? "#eff6ff" : "#fff", transition: "all 0.15s" }}>
                        <input type="radio" name="reg-gender" value={g} checked={gender === g} onChange={() => setGender(g)} style={{ accentColor: "#1d4ed8" }} />
                        {g}
                      </label>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Email */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 5 }}>Email address</label>
              <input style={inp()} placeholder="you@email.com" type="email" value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === "Enter" && tab === "signin" && handleSignIn()} />
            </div>

            {/* Password */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 5 }}>Password</label>
              <div style={{ position: "relative" }}>
                <input style={inp({ paddingRight: 44 })} type={showPass ? "text" : "password"}
                  placeholder="Enter your password" value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && tab === "signin" && handleSignIn()} />
                <button onClick={() => setShowPass(v => !v)}
                  style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#9ca3af", padding: 4 }}>
                  <EyeIcon open={showPass} />
                </button>
              </div>
            </div>

            {/* Confirm password — register only */}
            {tab === "register" && (
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 5 }}>Confirm password</label>
                <div style={{ position: "relative" }}>
                  <input style={inp({ paddingRight: 44 })} type={showConf ? "text" : "password"}
                    placeholder="Re-enter your password" value={confirm}
                    onChange={e => setConfirm(e.target.value)} />
                  <button onClick={() => setShowConf(v => !v)}
                    style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#9ca3af", padding: 4 }}>
                    <EyeIcon open={showConf} />
                  </button>
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 12px", fontSize: 12, color: "#dc2626" }}>
                {error}
              </div>
            )}

            {tab === "signin" && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "2px 0" }}>
                <div style={{ flex: 1, height: 1, background: "#e5e7eb" }} />
                <span style={{ fontSize: 11, color: "#9ca3af", whiteSpace: "nowrap" }}>or continue with</span>
                <div style={{ flex: 1, height: 1, background: "#e5e7eb" }} />
              </div>
            )}

            {tab === "signin" && (
              <button
                disabled
                title="Google sign-in coming soon"
                style={{
                  width: "100%", padding: "11px 14px", border: "1.5px solid #e5e7eb",
                  borderRadius: 10, background: "#fafafa", cursor: "not-allowed",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                  fontSize: 14, fontWeight: 600, color: "#9ca3af", fontFamily: "inherit",

                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" style={{ flexShrink: 0, opacity: 1 }}>
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Sign in with Google
                <span style={{ fontSize: 10, background: "#f3f4f6", color: "#6b7280", padding: "2px 6px", borderRadius: 4, fontWeight: 500 }}>Coming soon</span>
              </button>
            )}

            {submitBtn(tab === "signin" ? "Sign in" : "Create account")}

            {/* Switch tab hint */}
            <div style={{ textAlign: "center", fontSize: 12, color: "#9ca3af" }}>
              {tab === "signin" ? (
                <>Don't have an account?{" "}
                  <button onClick={() => { setTab("register"); reset(); }}
                    style={{ background: "none", border: "none", color: "#1d4ed8", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", fontSize: 12 }}>
                    Register
                  </button>
                </>
              ) : (
                <>Already have an account?{" "}
                  <button onClick={() => { setTab("signin"); reset(); }}
                    style={{ background: "none", border: "none", color: "#1d4ed8", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", fontSize: 12 }}>
                    Sign in
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Demo note */}
          <div style={{ marginTop: 20, padding: "10px 14px", background: "#f9fafb", borderRadius: 8, fontSize: 11, color: "#9ca3af", textAlign: "center", lineHeight: 1.6 }}>
            Demo mode — register with any email & password to get started.
          </div>
        </div>
      </div>



      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}