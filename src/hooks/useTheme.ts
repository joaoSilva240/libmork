"use client";

import { useTheme as useThemeContext, type ThemeContextValue } from "@/context/ThemeContext";

export function useTheme(): ThemeContextValue {
  return useThemeContext();
}

export type { ThemeContextValue };
export default useTheme;
