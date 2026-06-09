import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useTheme } from "../ThemeContext";
import { useModal } from "../components/Modal";

export default function ResetPasswordPage({ onBack }) {
  const { dark, toggle, t } = useTheme();
  const { show } = useModal();
  const [searchParams] = useSearchParams();
  const [token,    setToken]    = useState(searchParams.get("token") || "");
  const [password, setPassword] = useState("");
  const [confirm,  setConfirm]  = useState("");
  const [loading,  setLoading]  = useState(false);
  const [done,     setDone]     = useState(false);

  useEffect(() => {
    if (!token) {
      show({ type: "error", message: "Invalid or missing reset token. Please request a new reset link." });
    }
  }, []);

  const handleReset = async () => {
    if (password.length < 6) { show({ type: "error", message: "Password must be at least 6 characters." }); return; }
    if (password !== confirm)  { show({ type: "error", message: "Passwords do not match." }); return; }
    setLoading(true);
    try {
      const resp = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await resp.json();
      if (!resp.ok) { show({ type: "error", message: data.error || "Reset failed." }); setLoading(false); return; }
      setDone(true);
    } catch { show({ type: "error", message: "Could not connect to server." }); }
    setLoading(false);
  };

  const inp = { width: "100%", padding: "11px 14px", border: `1.5px solid ${t.inputBorder}`, borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box", background: t.input, color: t.text };

  return (
    <div style={{ minHeight: "100vh", background: t.bg, display: "flex", flexDirection: "column", fontFamily: "'DM Sans','Inter',sans-serif" }}>
      <div style={{ background: dark ? "#1e293b" : "#1e3a8a", padding: "12px 24px", display: "flex", alignItems: "center", gap: 10, borderBottom: dark ? `1px solid ${t.cardBorder}` : "none" }}>
        <span style={{ color: "#fff", fontSize: 13, fontWeight: 600, letterSpacing: "0.04em", flex: 1 }}>DLSU · Health Services Office</span>
        <button onClick={toggle} title={dark ? "Light mode" : "Dark mode"} style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", width: 34, height: 34, borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {dark
            ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
            : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
          }
        </button>
      </div>
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 16px" }}>
        <div style={{ background: t.card, borderRadius: 16, border: `1px solid ${t.cardBorder}`, padding: "36px 32px", width: "100%", maxWidth: 400 }}>
          {done ? (
            <div style={{ textAlign: "center" }}>
              <div style={{ width: 56, height: 56, borderRadius: "50%", background: t.greenBg, border: `2px solid ${t.green}44`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={t.green} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color: t.text, marginBottom: 8 }}>Password reset!</div>
              <div style={{ fontSize: 13, color: t.textSub, marginBottom: 24 }}>Your password has been updated. You can now sign in.</div>
              <button onClick={onBack} style={{ width: "100%", padding: "13px", background: t.accentBtn, color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                Go to sign in
              </button>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 20, fontWeight: 800, color: t.text, marginBottom: 6 }}>Reset password</div>
              <div style={{ fontSize: 13, color: t.textSub, marginBottom: 24 }}>Enter your new password below.</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: t.textSub, display: "block", marginBottom: 5 }}>New password</label>
                  <input style={inp} type="password" placeholder="At least 6 characters" value={password} onChange={e => setPassword(e.target.value)} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: t.textSub, display: "block", marginBottom: 5 }}>Confirm password</label>
                  <input style={inp} type="password" placeholder="Re-enter password" value={confirm} onChange={e => setConfirm(e.target.value)} onKeyDown={e => e.key === "Enter" && handleReset()} />
                </div>
                <button onClick={handleReset} disabled={loading} style={{ width: "100%", padding: "13px", background: loading ? (t.accentBtn + "99") : t.accentBtn, color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: loading ? "default" : "pointer", fontFamily: "inherit" }}>
                  {loading ? "Resetting…" : "Reset password"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}