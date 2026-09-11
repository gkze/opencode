export type ThemeColorScheme = "light" | "dark" | "system"

const lockedModes = new Map<string, "light" | "dark">([
  ["catppuccin-latte", "light"],
  ["catppuccin-frappe", "dark"],
  ["catppuccin-macchiato", "dark"],
  ["catppuccin-mocha", "dark"],
])

export const themeAppearanceMode = (themeId: string) => lockedModes.get(themeId)

export const parseColorScheme = (value: string | null | undefined): ThemeColorScheme | undefined =>
  value === "light" || value === "dark" || value === "system" ? value : undefined

export const resolveLegacyThemeId = (themeId: string, mode: "light" | "dark") => {
  if (themeId !== "catppuccin") return themeId
  return mode === "light" ? "catppuccin-latte" : "catppuccin-mocha"
}

export const resolveThemeMode = (themeId: string, colorScheme: ThemeColorScheme, systemMode: "light" | "dark") =>
  themeAppearanceMode(themeId) ?? (colorScheme === "system" ? systemMode : colorScheme)

const names = [...lockedModes.keys()]

export const compareThemeIds = (a: string, b: string) => {
  const ai = names.indexOf(a)
  const bi = names.indexOf(b)
  if (ai !== -1 || bi !== -1) return (ai === -1 ? names.length : ai) - (bi === -1 ? names.length : bi)
  return a.localeCompare(b, undefined, { sensitivity: "base" })
}
