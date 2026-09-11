import { CATPPUCCIN_FLAVORS } from "./catppuccin-palette"

/** Official terminal colors; undefined leaves other themes on their existing resolver. */
export function catppuccinTerminalTheme(id: string, mode: "light" | "dark") {
  const name = id === "catppuccin" ? "mocha" : id.replace(/^catppuccin-/, "")
  if (id !== "catppuccin" && !id.startsWith("catppuccin-")) return
  if (!Object.hasOwn(CATPPUCCIN_FLAVORS, name)) return
  const flavor = mode === "light" ? "latte" : (name as keyof typeof CATPPUCCIN_FLAVORS)
  const palette = CATPPUCCIN_FLAVORS[flavor]
  return {
    ...palette.ansi,
    background: palette.swatches.base,
    foreground: palette.swatches.text,
    cursor: palette.swatches.rosewater,
    cursorAccent: flavor === "latte" ? palette.swatches.base : palette.swatches.crust,
    selectionBackground: `${palette.swatches.overlay2}40`,
    selectionForeground: palette.swatches.text,
  }
}
