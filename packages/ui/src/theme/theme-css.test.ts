import { describe, expect, test } from "bun:test"
import { CATPPUCCIN_FLAVOR_NAMES, CATPPUCCIN_FLAVORS } from "./catppuccin"
import { DEFAULT_THEMES } from "./default-themes"
import { themeCacheCss } from "./theme-css"

describe("theme CSS cache", () => {
  test("caches complete native v2 CSS for locked Catppuccin themes", () => {
    for (const flavor of CATPPUCCIN_FLAVOR_NAMES) {
      const id = `catppuccin-${flavor}`
      const cached = themeCacheCss(DEFAULT_THEMES[id], id)

      expect(cached.light).toBe(cached.dark)
      expect(cached.light).toContain("--v2-overlay-simple-overlay-hover:")
      expect(cached.light).toContain(`--v2-border-border-focus: ${CATPPUCCIN_FLAVORS[flavor].swatches.lavender};`)
    }
  })
})
