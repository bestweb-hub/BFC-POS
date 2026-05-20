"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import type { Settings } from "@shared/schema";

type ThemeState = {
  colorTheme: string;
  primaryColor: string | null;
  componentSize: string;
  fontSize: string;
  compactMode: boolean;
  showAnimations: boolean;
  layoutPreference: string;
};

const defaultTheme: ThemeState = {
  colorTheme: "orange",
  primaryColor: null,
  componentSize: "medium",
  fontSize: "medium",
  compactMode: false,
  showAnimations: true,
  layoutPreference: "grid",
};

// HSL values for preset color themes (h s% l%) — exported for Settings preview swatches
export const COLOR_THEMES: Record<string, { primary: string; secondary: string; accent: string; name: string }> = {
  orange: { primary: "24 95% 53%", secondary: "280 65% 60%", accent: "142 76% 36%", name: "Orange" },
  blue: { primary: "217 91% 60%", secondary: "262 83% 58%", accent: "142 76% 36%", name: "Blue" },
  green: { primary: "142 76% 36%", secondary: "200 98% 39%", accent: "24 95% 53%", name: "Green" },
  purple: { primary: "262 83% 58%", secondary: "217 91% 60%", accent: "142 76% 36%", name: "Purple" },
  teal: { primary: "173 80% 40%", secondary: "200 98% 39%", accent: "24 95% 53%", name: "Teal" },
  red: { primary: "0 84% 60%", secondary: "24 95% 53%", accent: "142 76% 36%", name: "Red" },
  indigo: { primary: "239 84% 67%", secondary: "262 83% 58%", accent: "142 76% 36%", name: "Indigo" },
  amber: { primary: "38 92% 50%", secondary: "24 95% 53%", accent: "142 76% 36%", name: "Amber" },
  rose: { primary: "347 77% 50%", secondary: "262 83% 58%", accent: "142 76% 36%", name: "Rose" },
};

function hexToHsl(hex: string): string | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return null;
  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function applyTheme(theme: ThemeState, isDark: boolean) {
  const root = document.documentElement;
  const preset = COLOR_THEMES[theme.colorTheme] || COLOR_THEMES.orange;

  // Primary color: custom hex or preset
  let primaryHsl: string;
  if (theme.primaryColor && /^#[0-9A-Fa-f]{6}$/.test(theme.primaryColor)) {
    primaryHsl = hexToHsl(theme.primaryColor) || preset.primary;
  } else {
    primaryHsl = preset.primary;
  }
  const secondaryHsl = theme.primaryColor ? primaryHsl : preset.secondary;
  const accentHsl = theme.primaryColor ? primaryHsl : preset.accent;

  root.style.setProperty("--primary", primaryHsl);
  root.style.setProperty("--secondary", secondaryHsl);
  root.style.setProperty("--accent", accentHsl);
  root.style.setProperty("--ring", primaryHsl);
  if (isDark) {
    root.style.setProperty("--sidebar-primary", primaryHsl);
    root.style.setProperty("--sidebar-ring", primaryHsl);
  }

  // Font size scale
  const fontScale = theme.fontSize === "small" ? "0.9375" : theme.fontSize === "large" ? "1.0625" : "1";
  root.style.setProperty("--font-size-scale", fontScale);

  // Compact mode: reduce spacing + data attribute for CSS overrides
  const spacing = theme.compactMode ? "0.2rem" : "0.25rem";
  root.style.setProperty("--spacing", spacing);
  root.setAttribute("data-compact-mode", theme.compactMode ? "true" : "false");

  // Component size
  const sizeScale = theme.componentSize === "small" ? "0.9" : theme.componentSize === "large" ? "1.1" : "1";
  root.style.setProperty("--component-size", sizeScale);

  // Animations
  if (!theme.showAnimations) {
    root.classList.add("reduce-motion");
  } else {
    root.classList.remove("reduce-motion");
  }

  // Data attributes for layout preference (e.g. grid vs list)
  root.setAttribute("data-layout-preference", theme.layoutPreference || "grid");
}

/** Build ThemeState from API settings or form data for preview. */
export function buildThemeFromSettings(s: Partial<Settings> | null | undefined): ThemeState {
  if (!s) return defaultTheme;
  return {
    colorTheme: s.colorTheme || "orange",
    primaryColor: s.primaryColor ?? null,
    componentSize: s.componentSize || "medium",
    fontSize: s.fontSize || "medium",
    compactMode: s.compactMode === "true",
    showAnimations: s.showAnimations !== "false",
    layoutPreference: s.layoutPreference || "grid",
  };
}

/** Apply theme to document (used by ThemeProvider and Settings preview). */
export function applyThemeToDocument(theme: ThemeState) {
  const isDark = document.documentElement.classList.contains("dark");
  applyTheme(theme, isDark);
}

const ThemeContext = React.createContext<ThemeState>(defaultTheme);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { data: settings } = useQuery<Settings>({ queryKey: ["/api/settings"] });
  const [isDark, setIsDark] = React.useState(false);

  React.useEffect(() => {
    const isDarkMode = document.documentElement.classList.contains("dark");
    setIsDark(isDarkMode);
  }, []);

  const theme: ThemeState = React.useMemo(() => {
    if (!settings) return defaultTheme;
    return {
      colorTheme: settings.colorTheme || "orange",
      primaryColor: settings.primaryColor ?? null,
      componentSize: settings.componentSize || "medium",
      fontSize: settings.fontSize || "medium",
      compactMode: settings.compactMode === "true",
      showAnimations: settings.showAnimations !== "false",
      layoutPreference: settings.layoutPreference || "grid",
    };
  }, [settings]);

  React.useEffect(() => {
    applyThemeToDocument(theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={theme}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return React.useContext(ThemeContext);
}
