// src/ThemeContext.js
import { createContext, useContext, useState, useEffect } from "react";

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [dark, setDark] = useState(() => localStorage.getItem("theme") === "dark");

  useEffect(() => {
    localStorage.setItem("theme", dark ? "dark" : "light");
    document.body.style.background = dark ? "#0f172a" : "#f0f2f5";
  }, [dark]);

  const toggle = () => setDark(d => !d);

  // Color tokens
  const t = dark ? {
    bg:         "#0f172a",
    card:       "#1e293b",
    cardBorder: "#334155",
    text:       "#f1f5f9",
    textSub:    "#94a3b8",
    textMuted:  "#64748b",
    input:      "#1e293b",
    inputBorder:"#475569",
    navBg:      "#0f172a",
    divider:    "#334155",
    badgeBg:    "#1e3a5f",
    badgeText:  "#93c5fd",
  } : {
    bg:         "#f0f2f5",
    card:       "#ffffff",
    cardBorder: "#e5e7eb",
    text:       "#111827",
    textSub:    "#6b7280",
    textMuted:  "#9ca3af",
    input:      "#ffffff",
    inputBorder:"#d1d5db",
    navBg:      "#1e3a8a",
    divider:    "#e5e7eb",
    badgeBg:    "#eff6ff",
    badgeText:  "#1d4ed8",
  };

  return (
    <ThemeContext.Provider value={{ dark, toggle, t }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
