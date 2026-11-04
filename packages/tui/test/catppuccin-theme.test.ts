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
      expect(source.base).toBeDefined()
      const document = parseTheme(source)
      expect(themeModes(document)).toEqual([mode])
      const theme = resolveThemeDocument(document, mode)
      expect(theme.background.base.equals(RGBA.fromHex(background))).toBe(true)
      expect(theme.text.base.equals(RGBA.fromHex(text))).toBe(true)
      expect(theme.markdown.text.equals(RGBA.fromHex(text))).toBe(true)
      expect(theme.diff.text.added.equals(RGBA.fromHex(green))).toBe(true)
      expect(theme.diff.text.removed.equals(RGBA.fromHex(red))).toBe(true)
      const swatches = CATPPUCCIN_FLAVORS[flavor].swatches
      expect(theme.text.formfield.base.equals(RGBA.fromHex(text))).toBe(true)
      expect(theme.background.raised.base.equals(RGBA.fromHex(swatches.mantle))).toBe(true)
      expect(theme.background.raised.high.equals(RGBA.fromHex(swatches.surface0))).toBe(true)
      expect(theme.background.formfield.base.equals(RGBA.fromHex(swatches.surface0))).toBe(true)
      expect(theme.background.formfield.hovered.equals(theme.background.formfield.pressed)).toBe(false)
      expect(theme.background.action.primary.hovered.equals(theme.background.action.primary.pressed)).toBe(false)
      expect(theme.background.action.primary.selected.equals(RGBA.fromHex(`${swatches.overlay2}40`))).toBe(true)
      expect(theme.surface("dialog").background.base.equals(RGBA.fromHex(swatches.mantle))).toBe(true)
      expect(theme.source(theme.background.base)?.hue).toBe("neutral")
      const raised =
        theme.increase(theme.background.base)
      expect(raised.equals(theme.background.base)).toBe(false)
      expect(theme.decrease(theme.text.feedback.warning.base, 2).equals(theme.text.feedback.warning.base)).toBe(
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
    expect(resolvedColors(resolveThemeDocument(document, "light"))).toEqual(
      resolvedColors(resolveThemeDocument(parseTheme(allThemes()["catppuccin-latte"]), "light")),
    )
    expect(document.dark).toEqual(parseTheme(allThemes()["catppuccin-mocha"]).dark)
    expect(DEFAULT_THEMES.catppuccin).toBeUndefined()
  })


})

function resolvedColors(value: unknown): RGBA[] {
  if (value instanceof RGBA) return [value]
  if (typeof value !== "object" || value === null) return []
  return Object.values(value).flatMap(resolvedColors)
}
