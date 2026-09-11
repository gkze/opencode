import { catppuccinTerminalTheme } from "@opencode/ui/theme/catppuccin-terminal"
import type { ResolvedThemeTokens } from "@opencode/theme/tui"
import type { RGBA } from "@opentui/core"
import { CATPPUCCIN_THEMES } from "./catppuccin"
import type { ThemeDocumentSource } from "./index"

export function terminalPalette(
  theme: ResolvedThemeTokens,
  mode: "dark" | "light",
  background: RGBA,
  name: string,
  source: ThemeDocumentSource | undefined,
) {
  // Custom files and plugins can replace a built-in name with their own tokens.
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

  const base = mode === "dark" ? 200 : 800
  const bright = mode === "dark" ? 100 : 900
  const colors = [
    background,
    theme.text.feedback.error.default,
    theme.text.feedback.success.default,
    theme.text.feedback.warning.default,
    theme.hue.blue[base],
    theme.hue.purple[base],
    theme.text.feedback.info.default,
    theme.text.default,
    theme.text.subdued,
    theme.text.feedback.error.subdued,
    theme.text.feedback.success.subdued,
    theme.text.feedback.warning.subdued,
    theme.hue.blue[bright],
    theme.hue.purple[bright],
    theme.hue.cyan[bright],
    theme.hue.neutral[mode === "dark" ? 100 : 900],
  ]
  return Buffer.from(
    colors
      .map((color, index) => `\x1b]4;${index};${hex(color)}\x1b\\`)
      .concat(
        `\x1b]10;${hex(theme.text.default)}\x1b\\`,
        `\x1b]11;${hex(background)}\x1b\\`,
        `\x1b]12;${hex(theme.text.default)}\x1b\\`,
      )
      .join(""),
  )
}

function hex(color: RGBA) {
  return `#${color
    .toInts()
    .slice(0, 3)
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("")}`
}
