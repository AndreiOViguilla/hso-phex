import { useState } from "react";
import { useTheme } from "../ThemeContext";
import { useModal } from "../components/Modal";
import { getAuthHeader } from "../App";

const Logo = () => (
  <div style={{ width: 60, height: 60, borderRadius: "50%", background: "#eff6ff", border: "2px solid #bfdbfe", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
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
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
  </svg>
);

export default function LoginPage({ onLogin, onBack }) {
  const { show } = useModal();
  const { dark, t } = useTheme();
  const [tab,           setTab]           = useState("signin");
  const [idNumber,      setIdNumber]      = useState("");
  const [firstName,     setFirstName]     = useState("");
  const [lastName,      setLastName]      = useState("");
  const [middleInitial, setMiddleInitial] = useState("");
  const [gender,        setGender]        = useState("");
  const [email,         setEmail]         = useState("");
  const [password,      setPassword]      = useState("");
  const [confirm,       setConfirm]       = useState("");
  const [showPass,      setShowPass]      = useState(false);
  const [showConf,      setShowConf]      = useState(false);
  const [loading,       setLoading]       = useState(false);
  const [forgotOpen,    setForgotOpen]    = useState(false);
  const [forgotEmail,   setForgotEmail]   = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);

  const inp = (extra) => ({ width: "100%", padding: "11px 14px", border: `1.5px solid ${t.inputBorder}`, borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box", background: t.input, color: t.text, ...extra });
  const reset = () => {};

  const handleRegister = async () => {
    reset();
    if (idNumber.trim().length < 7) { show({ type: "error", message: "Enter a valid student ID (7+ digits)." }); return; }
    if (!email.includes("@"))        { show({ type: "error", message: "Enter a valid email address." }); return; }
    if (password.length < 6)         { show({ type: "error", message: "Password must be at least 6 characters." }); return; }
    if (password !== confirm)        { show({ type: "error", message: "Passwords do not match." }); return; }
    setLoading(true);
    try {
      const resp = await fetch("/api/auth/register", {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ studentId: idNumber.trim(), email, password, firstName: firstName.trim() || email.split("@")[0], lastName: lastName.trim() || "-", middleInitial: middleInitial.trim(), gender }),
      });
      const data = await resp.json();
      if (!resp.ok) { show({ type: "error", message: data.error || data.errors?.[0]?.msg || "Registration failed" }); setLoading(false); return; }
      show({ type: "success", title: "Account created!", message: "Your account has been created. You can now sign in." });
      setTab("signin"); setPassword(""); setConfirm("");
    } catch { show({ type: "error", message: "Could not connect to server. Please try again." }); }
    setLoading(false);
  };

  const handleSignIn = async () => {
    reset();
    if (!email.includes("@")) { show({ type: "error", message: "Enter your email address." }); return; }
    if (!password)             { show({ type: "error", message: "Enter your password." }); return; }
    setLoading(true);
    try {
      const resp = await fetch("/api/auth/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      const data = await resp.json();
      if (!resp.ok) { show({ type: "error", message: data.error || "Login failed" }); setLoading(false); return; }
      localStorage.setItem("token", data.token);
      setLoading(false);
      onLogin(data.user.studentId, data.user, data.token);
    } catch { show({ type: "error", message: "Could not connect to server. Please try again." }); setLoading(false); }
  };

  const handleForgot = async (type) => {
    if (!forgotEmail.includes("@")) { show({ type: "error", message: "Enter your email address." }); return; }
    setForgotLoading(true);
    try {
      const endpoint = type === "password" ? "/api/auth/forgot-password" : "/api/auth/forgot-booking-code";
      const resp = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail }),
      });
      const data = await resp.json();
      if (!resp.ok) show({ type: "error", message: data.error || "Failed to send email." });
      else { show({ type: "success", title: "Email sent!", message: data.message }); setForgotOpen(false); setForgotEmail(""); }
    } catch { show({ type: "error", message: "Could not connect to server." }); }
    setForgotLoading(false);
  };

  const submitBtn = (label) => (
    <button onClick={tab === "signin" ? handleSignIn : handleRegister} disabled={loading}
      style={{ background: loading ? "#93c5fd" : "#1d4ed8", color: "#fff", border: "none", borderRadius: 10, padding: "13px", fontSize: 15, fontWeight: 700, cursor: loading ? "default" : "pointer", fontFamily: "inherit", width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 4 }}>
      {loading ? (<><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" style={{ animation: "spin 0.8s linear infinite" }}><path d="M21 12a9 9 0 1 1-6.22-8.56"/></svg>{tab === "signin" ? "Signing in…" : "Creating account…"}</>) : label}
    </button>
  );

  const ForgotModal = forgotOpen && (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) setForgotOpen(false); }}>
      <div style={{ background: t.card, border: `1px solid ${t.cardBorder}`, borderRadius: 18, padding: "32px 28px", maxWidth: 380, width: "100%", boxShadow: "0 24px 80px rgba(0,0,0,0.22)", fontFamily: "'DM Sans',sans-serif" }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: t.text, marginBottom: 6 }}>
          {forgotOpen === "password" ? "Forgot password?" : "Forgot booking code?"}
        </div>
        <div style={{ fontSize: 13, color: t.textSub, lineHeight: 1.6, marginBottom: 20 }}>
          {forgotOpen === "password"
            ? "Enter your email and we'll send you a link to reset your password."
            : "Enter your email and we'll send you your booking codes."}
        </div>
        <label style={{ fontSize: 12, fontWeight: 600, color: t.textSub, display: "block", marginBottom: 6 }}>Email address</label>
        <input
          placeholder="you@dlsu.edu.ph"
          value={forgotEmail}
          onChange={e => setForgotEmail(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleForgot(forgotOpen)}
          style={{ width: "100%", padding: "11px 14px", border: `1.5px solid ${t.inputBorder}`, borderRadius: 10, fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box", marginBottom: 20, background: t.input, color: t.text }}
          autoFocus
        />
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => { setForgotOpen(false); setForgotEmail(""); }} style={{ flex: 1, padding: "11px", border: `1.5px solid ${t.cardBorder}`, borderRadius: 10, background: t.card, color: t.text, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
          <button onClick={() => handleForgot(forgotOpen)} disabled={forgotLoading} style={{ flex: 1, padding: "11px", border: "none", borderRadius: 10, background: t.accentBtn, color: "#fff", fontSize: 14, fontWeight: 700, cursor: forgotLoading ? "default" : "pointer", fontFamily: "inherit", opacity: forgotLoading ? 0.7 : 1 }}>
            {forgotLoading ? "Sending…" : "Send email"}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: t.bg, display: "flex", flexDirection: "column", fontFamily: "'DM Sans','Inter',sans-serif" }}>
      <div style={{ background: "#1e3a8a", padding: "12px 24px", display: "flex", alignItems: "center", gap: 10 }}>
        {onBack && <button onClick={onBack} style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", width: 32, height: 32, borderRadius: 8, cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginRight: 4 }}>←</button>}
        <span style={{ color: "#fff", fontSize: 13, fontWeight: 600, letterSpacing: "0.04em" }}>DLSU · Health Services Office</span>
      </div>
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 16px" }}>
        <div style={{ background: t.card, borderRadius: 16, border: `1px solid ${t.cardBorder}`, padding: "36px 32px", width: "100%", maxWidth: 400 }}>
          <Logo />
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: t.text, marginBottom: 4 }}>PHEx Portal</div>
            <div style={{ fontSize: 13, color: t.textSub }}>AY 2025–2026 · Manila Campus</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", background: "#f3f4f6", borderRadius: 10, padding: 4, marginBottom: 22, gap: 4 }}>
            {[["signin", "Sign in"], ["register", "Register"]].map(([key, label]) => (
              <button key={key} onClick={() => { setTab(key); reset(); }} style={{ padding: "9px", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s", background: tab === key ? "#fff" : "transparent", color: tab === key ? "#111827" : "#6b7280", boxShadow: tab === key ? "0 1px 4px rgba(0,0,0,0.1)" : "none" }}>{label}</button>
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {tab === "register" && (<>
              <div><label style={{ fontSize: 12, fontWeight: 600, color: t.textSub, display: "block", marginBottom: 5 }}>Student ID number</label><input style={inp()} placeholder="e.g. 12512345" value={idNumber} maxLength={10} onChange={e => setIdNumber(e.target.value)} /></div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 60px", gap: 10 }}>
                <div><label style={{ fontSize: 12, fontWeight: 600, color: t.textSub, display: "block", marginBottom: 5 }}>First name</label><input style={inp()} placeholder="Juan" value={firstName} onChange={e => setFirstName(e.target.value)} /></div>
                <div><label style={{ fontSize: 12, fontWeight: 600, color: t.textSub, display: "block", marginBottom: 5 }}>Last name</label><input style={inp()} placeholder="Dela Cruz" value={lastName} onChange={e => setLastName(e.target.value)} /></div>
                <div><label style={{ fontSize: 12, fontWeight: 600, color: t.textSub, display: "block", marginBottom: 5 }}>M.I.</label><input style={inp()} placeholder="O." value={middleInitial} maxLength={3} onChange={e => setMiddleInitial(e.target.value)} /></div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 8 }}>Gender</label>
                <div style={{ display: "flex", gap: 12 }}>
                  {["Female", "Male"].map(g => (<label key={g} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 14, color: "#374151", flex: 1, padding: "10px 14px", border: `1.5px solid ${gender === g ? "#1d4ed8" : "#d1d5db"}`, borderRadius: 8, background: gender === g ? "#eff6ff" : "#fff", transition: "all 0.15s" }}><input type="radio" name="reg-gender" value={g} checked={gender === g} onChange={() => setGender(g)} style={{ accentColor: "#1d4ed8" }} />{g}</label>))}
                </div>
              </div>
            </>)}
            <div><label style={{ fontSize: 12, fontWeight: 600, color: t.textSub, display: "block", marginBottom: 5 }}>Email address</label><input style={inp()} placeholder="you@dlsu.edu.ph" type="email" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && tab === "signin" && handleSignIn()} /></div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: t.textSub, display: "block", marginBottom: 5 }}>Password</label>
              <div style={{ position: "relative" }}>
                <input style={inp({ paddingRight: 44 })} type={showPass ? "text" : "password"} placeholder="Enter your password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && tab === "signin" && handleSignIn()} />
                <button onClick={() => setShowPass(v => !v)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#9ca3af", padding: 4 }}><EyeIcon open={showPass} /></button>
              </div>
            </div>
            {tab === "register" && (<div><label style={{ fontSize: 12, fontWeight: 600, color: t.textSub, display: "block", marginBottom: 5 }}>Confirm password</label><div style={{ position: "relative" }}><input style={inp({ paddingRight: 44 })} type={showConf ? "text" : "password"} placeholder="Re-enter your password" value={confirm} onChange={e => setConfirm(e.target.value)} /><button onClick={() => setShowConf(v => !v)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#9ca3af", padding: 4 }}><EyeIcon open={showConf} /></button></div></div>)}

            {tab === "signin" && (<>
              <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "2px 0" }}><div style={{ flex: 1, height: 1, background: "#e5e7eb" }} /><span style={{ fontSize: 11, color: "#9ca3af", whiteSpace: "nowrap" }}>or continue with</span><div style={{ flex: 1, height: 1, background: "#e5e7eb" }} /></div>
              <button disabled title="Coming soon" style={{ width: "100%", padding: "11px 14px", border: "1.5px solid #e5e7eb", borderRadius: 10, background: "#fafafa", cursor: "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, fontSize: 14, fontWeight: 600, color: "#9ca3af", fontFamily: "inherit" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" style={{ flexShrink: 0 }}><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                Sign in with Google <span style={{ fontSize: 10, background: "#f3f4f6", color: "#6b7280", padding: "2px 6px", borderRadius: 4, fontWeight: 500 }}>Coming soon</span>
              </button>
            </>)}
            {submitBtn(tab === "signin" ? "Sign in" : "Create account")}
            {tab === "signin" && (
              <div style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: 4 }}>
                <button onClick={() => setForgotOpen("password")} style={{ background: "none", border: "none", color: t.accent, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Forgot password?</button>
                <button onClick={() => setForgotOpen("code")} style={{ background: "none", border: "none", color: t.accent, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Forgot booking code?</button>
              </div>
            )}
            <div style={{ textAlign: "center", fontSize: 12, color: "#9ca3af" }}>
              {tab === "signin" ? (<>Don't have an account?{" "}<button onClick={() => { setTab("register"); reset(); }} style={{ background: "none", border: "none", color: "#1d4ed8", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", fontSize: 12 }}>Register</button></>) : (<>Already have an account?{" "}<button onClick={() => { setTab("signin"); reset(); }} style={{ background: "none", border: "none", color: "#1d4ed8", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", fontSize: 12 }}>Sign in</button></>)}
            </div>
          </div>
        </div>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      {ForgotModal}
    </div>
  );
}