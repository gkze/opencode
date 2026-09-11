import { describe, expect, test } from "bun:test"
import { CATPPUCCIN_FLAVORS } from "./catppuccin-palette"
import { catppuccinTerminalTheme } from "./catppuccin-terminal"

describe("Catppuccin terminal colors", () => {
  test.each(Object.keys(CATPPUCCIN_FLAVORS) as (keyof typeof CATPPUCCIN_FLAVORS)[])(
    "%s supplies the official ANSI palette, window colors and cursor text",
    (flavor) => {
      const palette = CATPPUCCIN_FLAVORS[flavor]
      const theme = catppuccinTerminalTheme(`catppuccin-${flavor}`, flavor === "latte" ? "light" : "dark")
      expect(theme).toMatchObject(palette.ansi)
      expect(theme?.background).toBe(palette.swatches.base)
      expect(theme?.foreground).toBe(palette.swatches.text)
      expect(theme?.cursor).toBe(palette.swatches.rosewater)
      expect(theme?.cursorAccent).toBe(flavor === "latte" ? palette.swatches.base : palette.swatches.crust)
      expect(theme?.selectionBackground).toBe(`${palette.swatches.overlay2}40`)
      expect(theme?.selectionForeground).toBe(palette.swatches.text)
    },
  )

  test("light mode and the legacy name follow the desktop flavor policy", () => {
    expect(catppuccinTerminalTheme("catppuccin-frappe", "light")).toEqual(
      catppuccinTerminalTheme("catppuccin-latte", "light"),
    )
    expect(catppuccinTerminalTheme("catppuccin", "dark")).toEqual(catppuccinTerminalTheme("catppuccin-mocha", "dark"))
    expect(catppuccinTerminalTheme("catppuccin", "light")).toEqual(catppuccinTerminalTheme("catppuccin-latte", "light"))
  })

  test.each(["opencode", "frappe", "catppuccin-custom", "catppuccin-constructor"])(
    "%s retains its existing terminal resolver",
    (id) => expect(catppuccinTerminalTheme(id, "dark")).toBeUndefined(),
  )
})
