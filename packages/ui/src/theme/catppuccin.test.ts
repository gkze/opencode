import { describe, expect, test } from "bun:test"
import { flavorEntries, flavors, version } from "@catppuccin/palette"
import postcss from "postcss"
import { compareThemeIds, parseColorScheme, resolveLegacyThemeId, resolveThemeMode } from "./appearance"
import { CATPPUCCIN_FLAVOR_NAMES, createCatppuccinDesktopTheme } from "./catppuccin"
import { CATPPUCCIN_FLAVORS, CATPPUCCIN_PALETTE_VERSION } from "./catppuccin-palette"
import { contrastRatio, blend } from "./color"
import { DEFAULT_THEMES } from "./default-themes"
import { resolveThemeVariant } from "./resolve"
import type { HexColor } from "./types"
import { resolveThemeVariantV2 } from "./v2/resolve"

const cssTokens = new Set<string>()
for (const directory of ["../", "../../../app/src/", "../../../session-ui/src/"]) {
  const cwd = new URL(directory, import.meta.url).pathname
  for await (const path of new Bun.Glob("**/*.css").scan({ cwd, absolute: true })) {
    postcss.parse(await Bun.file(path).text(), { from: path }).walkDecls((declaration) => {
      for (const match of declaration.value.matchAll(/var\(\s*--(v2-[\w-]+)/g)) {
        if (match[1].startsWith("v2-font-")) continue
        cssTokens.add(match[1])
      }
      if (path.endsWith("/tokens/colors.css") && declaration.prop.startsWith("--v2-"))
        cssTokens.add(declaration.prop.slice(2))
    })
  }
}

function value(tokens: Record<string, string>, key: string, visited: string[] = []): string {
  if (visited.includes(key)) throw new Error(`Cyclic theme reference: ${[...visited, key].join(" -> ")}`)
  if (!(key in tokens)) throw new Error(`Unmapped theme token: ${key}`)
  return tokens[key].replace(/var\(--([\w-]+)\)/g, (_, ref: string) => value(tokens, ref, [...visited, key]))
}

function opaque(color: string, background: HexColor): HexColor {
  if (!/^#[\da-f]{6}([\da-f]{2})?$/i.test(color)) throw new Error(`Expected resolved hex color: ${color}`)
  if (color.length === 7) return color as HexColor
  return blend(color.slice(0, 7) as HexColor, background, parseInt(color.slice(7), 16) / 255)
}

describe("Catppuccin fidelity", () => {
  test("pins every official swatch and ANSI color to the upstream dataset", () => {
    expect(CATPPUCCIN_PALETTE_VERSION).toBe(version)
    for (const [name, flavor] of flavorEntries) {
      expect(Object.fromEntries(flavor.colorEntries.map(([name, color]) => [name, color.hex]))).toEqual(
        CATPPUCCIN_FLAVORS[name].swatches,
      )
      expect(Object.fromEntries(flavor.ansiColorEntries.flatMap(([name, color]) => [
          [name, color.normal.hex],
          [`bright${name.charAt(0).toUpperCase()}${name.slice(1)}`, color.bright.hex],
        ]))).toEqual(CATPPUCCIN_FLAVORS[name].ansi)
    }
  })

  test.each(CATPPUCCIN_FLAVOR_NAMES)("assigns %s roles to official colors after final resolution", (flavor) => {
    const theme = DEFAULT_THEMES[`catppuccin-${flavor}`]
    const dark = flavors[flavor].dark
    const colors = flavors[flavor].colors
    const variant = dark ? theme.dark : theme.light
    const legacy = resolveThemeVariant(variant, dark)
    const tokens = resolveThemeVariantV2(variant, dark)
    expect(theme).toEqual(createCatppuccinDesktopTheme(flavor))
    for (const [role, color] of [
      ["v2-background-bg-base", colors.base.hex],
      ["v2-background-bg-deep", colors.mantle.hex],
      ["v2-background-bg-layer-01", colors.surface0.hex],
      ["v2-text-text-base", colors.text.hex],
      ["v2-text-text-muted", colors.subtext1.hex],
      ["v2-text-text-faint", dark ? colors.subtext0.hex : colors.subtext1.hex],
      ["v2-text-text-accent", colors.blue.hex],
      ["v2-border-border-focus", colors.lavender.hex],
    ]) expect(value(tokens, role), `${flavor} ${role}`).toBe(color)
    for (const [role, color] of [
      ["background-base", colors.base.hex],
      ["text-base", colors.text.hex],
      ["markdown-text", colors.text.hex],
      ["syntax-keyword", colors.mauve.hex],
      ["syntax-string", colors.green.hex],
    ]) expect(value(legacy, role), `${flavor} ${role}`).toBe(color)
  })

  test.each(CATPPUCCIN_FLAVOR_NAMES)("covers upstream tokens and CSS consumers for %s without generated colors", (flavor) => {
    const theme = DEFAULT_THEMES[`catppuccin-${flavor}`]
    for (const dark of [false, true]) {
      const variant = dark ? theme.dark : theme.light
      const colors = new Set<string>(Object.values(CATPPUCCIN_FLAVORS[dark ? flavor : "latte"].swatches))
      const tokens = resolveThemeVariantV2(variant, dark)
      const legacy = resolveThemeVariant(variant, dark)
      if (!variant.palette) throw new Error(`Missing ${flavor} palette`)
      const required = new Set([...Object.keys(resolveThemeVariantV2({ palette: variant.palette }, dark)), ...cssTokens])
      expect([...required].filter((token) => !(token in (variant.v2Overrides ?? {}))), "Unmapped upstream/CSS tokens").toEqual([])
      for (const [token, raw] of Object.entries({ ...legacy, ...tokens })) {
        const resolved = value({ ...legacy, ...tokens }, token)
        expect(resolved, token).not.toMatch(/rgba?\(|oklch\(|color-mix\(|var\(/)
        for (const match of resolved.matchAll(/#[\da-f]+/gi)) {
          expect(match[0], token).toMatch(/^#[\da-f]{6}([\da-f]{2})?$/i)
          expect(colors.has(match[0].slice(0, 7).toLowerCase()), `${flavor} ${token}: ${raw}`).toBe(true)
        }
      }
    }
  })

  test.each(CATPPUCCIN_FLAVOR_NAMES)("keeps %s readable against its final backgrounds and distinct states", (flavor) => {
    const dark = flavors[flavor].dark
    const theme = DEFAULT_THEMES[`catppuccin-${flavor}`]
    const tokens = resolveThemeVariantV2(dark ? theme.dark : theme.light, dark)
    const background = value(tokens, "v2-background-bg-base") as HexColor
    for (const role of ["base", "muted", "faint", "code-path"]) {
      expect(contrastRatio(opaque(value(tokens, `v2-text-text-${role}`), background), background), role).toBeGreaterThanOrEqual(4.5)
    }
    for (const role of ["inverse", "contrast", "message-local"]) {
      const fill = value(tokens, `v2-background-bg-${role}`) as HexColor
      expect(contrastRatio(opaque(value(tokens, `v2-text-text-${role}`), fill), fill), role).toBeGreaterThanOrEqual(4.5)
    }
    for (const role of ["label", "metadata", "message-user", "message-assistant", "message-system", "numeric"]) {
      expect(contrastRatio(opaque(value(tokens, `v2-context-${role}`), background), background), role).toBeGreaterThanOrEqual(4.5)
    }
    const button = value(tokens, "v2-background-bg-icon-button-contrast") as HexColor
    const highlight = opaque(value(tokens, `v2-alpha-light-${dark ? 60 : 20}`), button)
    expect(highlight, "Submit gradient must remain visible").not.toBe(button)
    const hover = opaque(value(tokens, "v2-overlay-simple-overlay-hover"), background)
    const pressed = opaque(value(tokens, "v2-overlay-simple-overlay-pressed"), background)
    expect(hover).not.toBe(background)
    expect(pressed).not.toBe(hover)
    for (const state of ["success", "warning", "danger", "info"]) {
      const fill = opaque(value(tokens, `v2-state-bg-${state}`), background)
      const foreground = opaque(value(tokens, `v2-state-fg-${state}`), fill)
      expect(contrastRatio(foreground, fill), state).toBeGreaterThanOrEqual(4.5)
    }
  })

  test("replaces the upstream generic theme while migrating saved selections", () => {
    expect(Object.keys(DEFAULT_THEMES).filter((id) => id.startsWith("catppuccin")).sort(compareThemeIds)).toEqual(
      CATPPUCCIN_FLAVOR_NAMES.map((name) => `catppuccin-${name}`),
    )
    expect(resolveLegacyThemeId("catppuccin", "light")).toBe("catppuccin-latte")
    expect(resolveLegacyThemeId("catppuccin", "dark")).toBe("catppuccin-mocha")
    for (const [flavor, official] of flavorEntries) {
      for (const scheme of ["light", "dark", "system"] as const) {
        expect(resolveThemeMode(`catppuccin-${flavor}`, scheme, "dark")).toBe(official.dark ? "dark" : "light")
        expect(resolveThemeMode(`catppuccin-${flavor}`, scheme, "light")).toBe(official.dark ? "dark" : "light")
      }
    }
    expect(resolveThemeMode("oc-2", "system", "dark")).toBe("dark")
    expect(resolveThemeMode("oc-2", "light", "dark")).toBe("light")
    expect(parseColorScheme("invalid")).toBeUndefined()
  })
})
