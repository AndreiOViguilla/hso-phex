import { createContext, useContext, useState, useEffect } from "react";

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [dark, setDark] = useState(() => localStorage.getItem("theme") === "dark");

  useEffect(() => {
    localStorage.setItem("theme", dark ? "dark" : "light");
    document.body.style.background = dark ? "#0f172a" : "#f0f2f5";
  }, [dark]);

  const toggle = () => setDark(d => !d);

  const t = dark ? {
    // Backgrounds
    bg:           "#0f172a",   // page bg
    card:         "#1e293b",   // card bg
    cardBorder:   "#334155",   // card border
    cardHover:    "#253348",
    // Text
    text:         "#f1f5f9",   // primary text
    textSub:      "#94a3b8",   // secondary text
    textMuted:    "#64748b",   // muted text
    // Inputs
    input:        "#1e293b",
    inputBorder:  "#475569",
    // Nav
    navBg:        "#0f172a",
    // Dividers
    divider:      "#334155",
    // Accent — claude purple/blue
    accent:       "#a78bfa",   // primary accent (purple)
    accentBg:     "#2e1065",   // accent background
    accentText:   "#a78bfa",
    accentBtn:    "#7c3aed",   // button bg
    accentBtnHover:"#6d28d9",
    // Blue (for bookings)
    blue:         "#60a5fa",
    blueBg:       "#1e3a5f",
    blueText:     "#93c5fd",
    // Green (for success)
    green:        "#34d399",
    greenBg:      "#064e3b",
    greenText:    "#6ee7b7",
    // Orange (for warnings)
    orange:       "#fb923c",
    orangeBg:     "#431407",
    orangeText:   "#fdba74",
    // Red (for errors)
    red:          "#f87171",
    redBg:        "#450a0a",
    // Teal (for drug test)
    teal:         "#2dd4bf",
    tealBg:       "#0d3330",
    tealText:     "#5eead4",
    // Step colors
    stepActive:   "#7c3aed",
    stepDone:     "#059669",
    stepLine:     "#334155",
    stepLineDone: "#059669",
    // Badge
    badgeBg:      "#2e1065",
    badgeText:    "#a78bfa",
  } : {
    bg:           "#f0f2f5",
    card:         "#ffffff",
    cardBorder:   "#e5e7eb",
    cardHover:    "#f9fafb",
    text:         "#111827",
    textSub:      "#6b7280",
    textMuted:    "#9ca3af",
    input:        "#ffffff",
    inputBorder:  "#d1d5db",
    navBg:        "#1e3a8a",
    divider:      "#e5e7eb",
    accent:       "#1d4ed8",
    accentBg:     "#eff6ff",
    accentText:   "#1d4ed8",
    accentBtn:    "#1d4ed8",
    accentBtnHover:"#1e40af",
    blue:         "#1d4ed8",
    blueBg:       "#eff6ff",
    blueText:     "#1d4ed8",
    green:        "#16a34a",
    greenBg:      "#f0fdf4",
    greenText:    "#16a34a",
    orange:       "#f97316",
    orangeBg:     "#fff7ed",
    orangeText:   "#c2410c",
    red:          "#dc2626",
    redBg:        "#fef2f2",
    teal:         "#0f766e",
    tealBg:       "#f0fdfa",
    tealText:     "#0f766e",
    stepActive:   "#1d4ed8",
    stepDone:     "#16a34a",
    stepLine:     "#e5e7eb",
    stepLineDone: "#16a34a",
    badgeBg:      "#eff6ff",
    badgeText:    "#1d4ed8",
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