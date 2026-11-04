#!/usr/bin/env bun

import { CATPPUCCIN_FLAVORS } from "../../ui/src/theme/catppuccin-palette"

function createCatppuccinTuiTheme(flavor: keyof typeof CATPPUCCIN_FLAVORS) {
  const ansi = CATPPUCCIN_FLAVORS[flavor].ansi
  const colors = CATPPUCCIN_FLAVORS[flavor].swatches
  const light = flavor === "latte"
  const anchor = 200
  const contrast = light ? colors.base : colors.crust
  const neutral = [
    colors.text,
    colors.subtext1,
    colors.subtext0,
    colors.overlay2,
    colors.surface2,
    colors.surface0,
    colors.base,
    colors.mantle,
    colors.crust,
  ]
  const theme = {
    hue: {
      gray: Object.fromEntries(neutral.map((color, index) => [(index + 1) * 100, color])),
      red: hue(colors.red, ansi.brightRed, anchor),
      orange: hue(colors.peach),
      yellow: hue(colors.yellow, ansi.brightYellow, anchor),
      green: hue(colors.green, ansi.brightGreen, anchor),
      cyan: hue(colors.teal, ansi.brightCyan, anchor),
      blue: hue(colors.blue, ansi.brightBlue, anchor),
      purple: hue(colors.mauve),
      accent: hue(colors.pink, ansi.brightMagenta, anchor),
      interactive: "$hue.blue",
      neutral: "$hue.gray",
    },
    categorical: ["blue", "purple", "green", "orange", "red", "cyan"],
    text: {
      base: colors.text,
      muted: colors.subtext0,
      action: {
        primary: { base: colors.text, $focused: contrast, $selected: colors.blue, $disabled: colors.overlay0 },
        secondary: { base: colors.subtext1, $hovered: colors.text, $disabled: colors.overlay0 },
        destructive: { base: contrast, $disabled: colors.overlay0 },
      },
      formfield: { base: colors.text, $disabled: colors.overlay0 },
      feedback: {
        error: { base: colors.red, muted: colors.maroon },
        warning: { base: colors.yellow, muted: colors.peach },
        success: { base: colors.green, muted: colors.green },
        info: { base: colors.teal, muted: colors.teal },
      },
    },
    background: {
      base: colors.base,
      raised: { base: colors.mantle, high: colors.surface0, max: colors.surface1 },
      action: {
        primary: {
          base: "transparent",
          $hovered: `${colors.text}0f`,
          $focused: colors.blue,
          $pressed: `${colors.text}1a`,
          $selected: `${colors.overlay2}40`,
          $disabled: "transparent",
        },
        secondary: {
          base: "transparent",
          $hovered: `${colors.text}0f`,
          $focused: `${colors.overlay2}40`,
          $pressed: `${colors.text}1a`,
          $selected: `${colors.overlay2}40`,
          $disabled: "transparent",
        },
        destructive: { base: colors.red, $disabled: colors.surface0 },
      },
      formfield: {
        base: colors.surface0,
        $hovered: colors.surface1,
        $focused: colors.surface1,
        $pressed: colors.surface2,
        $selected: `${colors.overlay2}40`,
        $disabled: colors.base,
      },
      feedback: {
        error: { base: `${colors.red}26` },
        warning: { base: `${colors.yellow}26` },
        success: { base: `${colors.green}26` },
        info: { base: `${colors.teal}26` },
      },
    },
    border: { base: colors.surface1 },
    scrollbar: { base: colors.surface2 },
    diff: {
      text: { added: colors.green, removed: colors.red, context: colors.overlay2, hunkHeader: colors.peach },
      background: { added: `${colors.green}26`, removed: `${colors.red}26`, context: colors.mantle },
      highlight: { added: colors.green, removed: colors.red },
      lineNumber: { text: colors.overlay2, background: { added: `${colors.green}38`, removed: `${colors.red}38` } },
    },
    syntax: {
      comment: colors.overlay2,
      keyword: colors.mauve,
      function: colors.blue,
      variable: colors.red,
      string: colors.green,
      number: colors.peach,
      type: colors.yellow,
      operator: colors.sky,
      punctuation: colors.text,
    },
    markdown: {
      text: colors.text,
      heading: colors.mauve,
      link: colors.blue,
      linkText: colors.sky,
      code: colors.green,
      blockQuote: colors.yellow,
      emphasis: colors.yellow,
      strong: colors.peach,
      horizontalRule: colors.subtext0,
      listItem: colors.blue,
      listEnumeration: colors.sky,
      image: colors.blue,
      imageText: colors.sky,
      codeBlock: colors.text,
    },
    "@dialog": { background: { base: colors.mantle } },
  }
  const references = new Map<string, string>(
    Object.entries(theme.hue.gray).map(([step, color]) => [color, `$hue.neutral.${step}`]),
  )
  for (const name of ["red", "orange", "yellow", "green", "cyan", "blue", "purple", "accent"] as const) {
    references.set(theme.hue[name][anchor]!, `$hue.${name}.${anchor}`)
  }
  return {
    $schema: "https://opencode.ai/theme.json",
    base: Object.fromEntries(
      Object.entries(theme)
        .filter(([key]) => key !== "hue")
        .map(([key, value]) => [key, referenceColors(value, references)]),
    ),
    [light ? "light" : "dark"]: { hue: theme.hue },
  }
}

// Hue references retain v2's source/increase/decrease identity for raised surfaces.
function referenceColors(value: unknown, references: Map<string, string>): unknown {
  if (typeof value === "string") return references.get(value) ?? value
  if (Array.isArray(value)) return value.map((item) => referenceColors(item, references))
  if (typeof value !== "object" || value === null) return value
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, referenceColors(item, references)]))
}

// The finite official palette supplies normal/bright colors, not a nine-step ramp.
// Keep anchors exact and use official bright colors for v2 hue-shift feedback.
function hue(color: string, shifted = color, anchor = 500) {
  return Object.fromEntries(
    [100, 200, 300, 400, 500, 600, 700, 800, 900].map((step) => [
      step,
      step === anchor || step === 500 ? color : shifted,
    ]),
  )
}

const check = process.argv.includes("--check")
const files = (Object.keys(CATPPUCCIN_FLAVORS) as (keyof typeof CATPPUCCIN_FLAVORS)[]).map((flavor) => ({
  path: new URL(`../src/theme/assets/catppuccin-${flavor}.json`, import.meta.url),
  content: `${JSON.stringify(createCatppuccinTuiTheme(flavor), null, 2)}\n`,
}))

const changed = (
  await Promise.all(
    files.map(async (file) => {
      const current = (await Bun.file(file.path).exists()) ? await Bun.file(file.path).text() : ""
      if (current === file.content) return null
      if (check) return file.path.pathname
      await Bun.write(file.path, file.content)
      return file.path.pathname
    }),
  )
).filter((file): file is string => file !== null)

if (changed.length === 0) {
  console.log("TUI Catppuccin themes already synced")
  process.exit(0)
}

if (check) {
  console.error("TUI Catppuccin themes are out of sync:")
  for (const file of changed) console.error(`- ${file}`)
  process.exit(1)
}

console.log("Updated TUI Catppuccin themes:")
for (const file of changed) console.log(`- ${file}`)
