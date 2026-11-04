import { describe, expect, test } from "bun:test"
import { CATPPUCCIN_FLAVOR_NAMES, CATPPUCCIN_FLAVORS } from "./catppuccin"
import type { DesktopTheme } from "./types"
import { themeCacheCss } from "./theme-css"

describe("theme CSS cache", () => {
  test("caches complete native v2 CSS for locked Catppuccin themes", async () => {
    for (const flavor of CATPPUCCIN_FLAVOR_NAMES) {
      const id = `catppuccin-${flavor}`
      const cached = themeCacheCss((await Bun.file(new URL(`./themes/${id}.json`, import.meta.url)).json()) as DesktopTheme, id)

      expect(cached.light).toBe(cached.dark)
      expect(cached.light).toContain("--v2-overlay-simple-overlay-hover:")
      expect(cached.light).toContain(`--v2-border-border-focus: ${CATPPUCCIN_FLAVORS[flavor].swatches.lavender};`)
    }
  })
})
