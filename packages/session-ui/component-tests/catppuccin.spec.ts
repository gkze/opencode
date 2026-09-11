import { fileURLToPath } from "node:url"
import { expect, story } from "../../storybook/playwright/story"

const fixture = `/@fs/${fileURLToPath(new URL("./catppuccin.fixture.tsx", import.meta.url)).replaceAll("\\", "/")}`
const flavors = [
  {
    name: "latte",
    mode: "light",
    keyword: "#8839ef",
    constant: "#fe640b",
    operator: "#04a5e5",
  },
  {
    name: "frappe",
    mode: "dark",
    keyword: "#ca9ee6",
    constant: "#ef9f76",
    operator: "#99d1db",
  },
  {
    name: "macchiato",
    mode: "dark",
    keyword: "#c6a0f6",
    constant: "#f5a97f",
    operator: "#91d7e3",
  },
  {
    name: "mocha",
    mode: "dark",
    keyword: "#cba6f7",
    constant: "#fab387",
    operator: "#89dceb",
  },
] as const

// Migrated from packages/ui/src/catppuccin-markdown.test.ts in the fork.
// Exercise production Markdown, highlighting and theme application in Chromium.
for (const flavor of flavors) {
  story(`${flavor.name} preserves readable Markdown and the canonical syntax palette`, async ({ mount, page }) => {
    const storyRoot = await mount("components-markdown--complete-response", {
      globals: { theme: flavor.mode === "light" ? "dark" : "light" },
    })
    await expect(storyRoot.locator('[data-component="markdown"]')).toHaveAttribute("data-markdown-ready", "")
    await page.evaluate(
      async ({ fixture, name }) => {
        const { mountCatppuccin } = await import(fixture)
        mountCatppuccin(`catppuccin-${name}`)
      },
      { fixture, name: flavor.name },
    )
    const root = page.getByTestId("catppuccin-fixture")
    await root.getByRole("button", { name: "Apply Catppuccin" }).click()
    await expect(page.locator("html")).toHaveAttribute("data-theme", `catppuccin-${flavor.name}`)
    await expect(page.locator("html")).toHaveAttribute("data-color-scheme", flavor.mode)
    const tokens = await page.locator("html").evaluate((element) => {
      const style = getComputedStyle(element)
      return {
        background: style.getPropertyValue("--background-stronger").trim(),
        text: style.getPropertyValue("--text-base").trim(),
        body: style.getPropertyValue("--v2-text-text-base").trim(),
      }
    })
    const code = root.locator(".shiki")
    await expect(code).toBeVisible()
    await expect(code).toHaveCSS("background-color", rgb(tokens.background))
    await expect(code).toHaveCSS("color", rgb(tokens.text))
    await expect(root.locator('[data-component="markdown"] p')).toHaveCSS("color", rgb(tokens.body))
    for (const role of ["keyword", "constant", "operator"] as const) {
      await expect(code.locator(`span[style*="var(--syntax-${role})"]`).first()).toHaveCSS("color", rgb(flavor[role]))
    }
    const colors = await root.evaluate((root) => {
      const read = (selector: string) => {
        const element = root.querySelector(selector)
        if (!element) throw new Error(`Missing rendered ${selector}`)
        const style = getComputedStyle(element)
        return { foreground: style.color, background: style.backgroundColor }
      }
      return {
        code: read(".shiki"),
        body: read('[data-component="markdown"] p'),
        surface: read('[data-testid="catppuccin-surface"]'),
        icons: ["base", "muted", "faint"].map((role) => read(`[data-testid="catppuccin-icon-${role}"]`)),
      }
    })
    expect(contrast(colors.code.foreground, colors.code.background)).toBeGreaterThan(5.5)
    expect(contrast(colors.body.foreground, colors.surface.background)).toBeGreaterThan(5.5)
    for (const [index, minimum] of [7, 3, 1.5].entries()) {
      expect(contrast(colors.icons[index]!.foreground, colors.surface.background)).toBeGreaterThanOrEqual(minimum)
    }
  })
}

function rgb(hex: string) {
  return `rgb(${[1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16)).join(", ")})`
}

// Independent reference calculation: the original regression caught rendered
// foreground/background wiring, so importing the production helper would hide a
// matching error in both the resolver and the assertion.
function contrast(first: string, second: string) {
  const luminance = (color: string) => {
    const match = /^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/.exec(color)
    if (!match) throw new Error(`Expected an opaque computed RGB color, received ${color}`)
    return match.slice(1).reduce((sum, channel, index) => {
      const value = Number(channel) / 255
      return (
        sum + (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4) * [0.2126, 0.7152, 0.0722][index]!
      )
    }, 0)
  }
  const light = Math.max(luminance(first), luminance(second))
  const dark = Math.min(luminance(first), luminance(second))
  return (light + 0.05) / (dark + 0.05)
}
