import { catppuccinTerminalTheme } from "@opencode/ui/theme/catppuccin-terminal"
import { rgbToOklch, type ResolvedThemeTokens } from "@opencode/theme/tui"
import type { RGBA } from "@opentui/core"
import { CATPPUCCIN_THEMES } from "./catppuccin"
import type { ThemeDocumentSource } from "./index"

export function terminalPalette(
  theme: ResolvedThemeTokens,
  mode: "dark" | "light",
  background: RGBA,
  name = "",
  source?: ThemeDocumentSource,
) {
  // Custom files can replace a built-in name with their own tokens.
  const builtin = Object.entries(CATPPUCCIN_THEMES).some(([id, value]) => id === name && value === source)
  const catppuccin = builtin ? catppuccinTerminalTheme(name, mode) : undefined
  if (catppuccin) {
    const ansi = [
      "black",
      "red",
      "green",
      "yellow",
      "blue",
      "magenta",
      "cyan",
      "white",
      "brightBlack",
      "brightRed",
      "brightGreen",
      "brightYellow",
      "brightBlue",
      "brightMagenta",
      "brightCyan",
      "brightWhite",
    ] as const
    return Buffer.from(
      ansi.map((key, index) => `\x1b]4;${index};${catppuccin[key]}\x1b\\`).join("") +
        `\x1b]10;${catppuccin.foreground}\x1b\\\x1b]11;${catppuccin.background}\x1b\\\x1b]12;${catppuccin.cursor}\x1b\\`,
    )
  }

  const black = theme.hue.neutral[mode === "dark" ? 800 : 200]
  const white = theme.hue.neutral[mode === "dark" ? 200 : 800]
  const brightWhite = theme.hue.neutral[mode === "dark" ? 100 : 900]
  const blue = terminalHue(theme, rgbToOklch(0, 0, 1).h)
  const magenta = terminalHue(theme, rgbToOklch(1, 0, 1).h)
  const normal = [
    theme.text.feedback.error.base,
    theme.text.feedback.success.base,
    theme.text.feedback.warning.base,
    blue,
    magenta,
    theme.text.feedback.info.base,
    white,
  ]
  const colors = [
    black,
    ...normal,
    theme.text.muted,
    ...normal.slice(0, -1).map((color) => theme.decrease(color)),
    brightWhite,
  ]
  return Buffer.from(
    colors
      .map((color, index) => `\x1b]4;${index};${hex(color)}\x1b\\`)
      .concat(
        `\x1b]10;${hex(theme.text.base)}\x1b\\`,
        `\x1b]11;${hex(background)}\x1b\\`,
        `\x1b]12;${hex(theme.text.base)}\x1b\\`,
      )
      .join(""),
  )
}

function terminalHue(theme: ResolvedThemeTokens, target: number) {
  const nearest = Object.values(theme.hue)
    .map((scale) => {
      const color = scale[200]
      const [red, green, blue, alpha] = color.toInts()
      const converted = rgbToOklch(red / 255, green / 255, blue / 255)
      return { color, alpha, chroma: converted.c, distance: hueDistance(converted.h, target) }
    })
    .filter((item) => item.alpha > 0 && item.chroma >= 0.03)
    .sort((first, second) => first.distance - second.distance)[0]
  if (!nearest || nearest.distance > 30) return theme.hue.accent[200]
  return nearest.color
}

function hueDistance(first: number, second: number) {
  const difference = Math.abs(first - second)
  return Math.min(difference, 360 - difference)
}

function hex(color: RGBA) {
  return `#${color
    .toInts()
    .slice(0, 3)
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("")}`
}
