import { themeAppearanceMode } from "./appearance"
import { resolveThemeVariant, themeToCss } from "./resolve"
import type { DesktopTheme, ThemeVariant } from "./types"
import { resolveThemeVariantV2, themeV2ToCss } from "./v2/resolve"

export function themeVariantCss(variant: ThemeVariant, isDark: boolean) {
  return `${themeToCss(resolveThemeVariant(variant, isDark))}\n  ${themeV2ToCss(resolveThemeVariantV2(variant, isDark))}`
}

export function themeCacheCss(theme: DesktopTheme, themeId: string) {
  const locked = themeAppearanceMode(themeId)
  if (locked) {
    const css = themeVariantCss(locked === "dark" ? theme.dark : theme.light, locked === "dark")
    return { light: css, dark: css }
  }

  return {
    light: themeVariantCss(theme.light, false),
    dark: themeVariantCss(theme.dark, true),
  }
}
