import { describe, expect, test } from "bun:test"
import { RGBA } from "@opentui/core"
import { resolveThemeDocument, themeModes } from "@opencode/theme/tui"
import { CATPPUCCIN_FLAVORS } from "../../ui/src/theme/catppuccin-palette"
import { allThemes, DEFAULT_THEMES, parseTheme } from "../src/theme"

const flavors = [
  ["latte", "light", "#eff1f5", "#4c4f69", "#40a02b", "#d20f39"],
  ["frappe", "dark", "#303446", "#c6d0f5", "#a6d189", "#e78284"],
  ["macchiato", "dark", "#24273a", "#cad3f5", "#a6da95", "#ed8796"],
  ["mocha", "dark", "#1e1e2e", "#cdd6f4", "#a6e3a1", "#f38ba8"],
] as const

describe("Catppuccin native TUI resolution", () => {
  test.each(flavors)(
    "resolves %s with its own appearance and semantic colors",
    (flavor, mode, background, text, green, red) => {
      const source = allThemes()[`catppuccin-${flavor}`]
      expect(source.version).toBe(2)
      const document = parseTheme(source)
      expect(themeModes(document)).toEqual([mode])
      const theme = resolveThemeDocument(document, mode)
      expect(theme.background.default.equals(RGBA.fromHex(background))).toBe(true)
      expect(theme.text.default.equals(RGBA.fromHex(text))).toBe(true)
      expect(theme.markdown.text.equals(RGBA.fromHex(text))).toBe(true)
      expect(theme.diff.text.added.equals(RGBA.fromHex(green))).toBe(true)
      expect(theme.diff.text.removed.equals(RGBA.fromHex(red))).toBe(true)
      const swatches = CATPPUCCIN_FLAVORS[flavor].swatches
      expect(theme.text.formfield.default.equals(RGBA.fromHex(text))).toBe(true)
      expect(theme.text.status.running.equals(RGBA.fromHex(swatches.blue))).toBe(true)
      expect(theme.background.surface.offset.equals(RGBA.fromHex(swatches.mantle))).toBe(true)
      expect(theme.background.surface.overlay.equals(RGBA.fromHex(swatches.surface0))).toBe(true)
      expect(theme.background.formfield.default.equals(RGBA.fromHex(swatches.surface0))).toBe(true)
      expect(theme.background.formfield.hovered.equals(theme.background.formfield.pressed)).toBe(false)
      expect(theme.background.action.primary.hovered.equals(theme.background.action.primary.pressed)).toBe(false)
      expect(theme.background.action.primary.selected.equals(RGBA.fromHex(`${swatches.overlay2}40`))).toBe(true)
      expect(theme.contextual.elevated.background.default.equals(RGBA.fromHex(swatches.mantle))).toBe(true)
      expect(theme.contextual.overlay.background.default.equals(RGBA.fromHex(swatches.surface0))).toBe(true)
      expect(theme.source(theme.background.default)?.hue).toBe("neutral")
      const raised =
        mode === "light" ? theme.increase(theme.background.default) : theme.decrease(theme.background.default)
      expect(raised.equals(theme.background.default)).toBe(false)
      expect(theme.decrease(theme.text.feedback.warning.default, 2).equals(theme.text.feedback.warning.default)).toBe(
        false,
      )

      // Verify the consumed v2 document, including inferred/default and contextual roles.
      const canonical = new Set(
        [...Object.values(swatches), ...Object.values(CATPPUCCIN_FLAVORS[flavor].ansi)].map((color) =>
          RGBA.fromHex(color).toInts().slice(0, 3).join(","),
        ),
      )
      for (const color of resolvedColors(theme)) {
        const channels = color.toInts()
        if (channels[3] === 0) continue
        expect(canonical.has(channels.slice(0, 3).join(","))).toBe(true)
        expect([15, 26, 38, 56, 64, 255]).toContain(channels[3])
      }

    },
  )

  test("retains compatibility for existing unnamed Catppuccin configs", () => {
    const document = parseTheme(allThemes().catppuccin)
    expect(themeModes(document)).toEqual(["light", "dark"])
    expect(document.light).toEqual(parseTheme(allThemes()["catppuccin-latte"]).light)
    expect(document.dark).toEqual(parseTheme(allThemes()["catppuccin-mocha"]).dark)
    expect(DEFAULT_THEMES.catppuccin).toBeUndefined()
  })


})

function resolvedColors(value: unknown): RGBA[] {
  if (value instanceof RGBA) return [value]
  if (typeof value !== "object" || value === null) return []
  return Object.values(value).flatMap(resolvedColors)
}
