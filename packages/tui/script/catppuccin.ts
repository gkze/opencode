#!/usr/bin/env bun

import { CATPPUCCIN_FLAVORS } from "../../ui/src/theme/catppuccin-palette"

function createCatppuccinTuiTheme(flavor: keyof typeof CATPPUCCIN_FLAVORS) {
  const ansi = CATPPUCCIN_FLAVORS[flavor].ansi
  const colors = CATPPUCCIN_FLAVORS[flavor].swatches
  const light = flavor === "latte"
  const anchor = light ? 800 : 200
  const contrast = light ? colors.base : colors.crust
  const neutral = light
    ? [
        colors.base,
        colors.mantle,
        colors.crust,
        colors.surface0,
        colors.surface2,
        colors.overlay2,
        colors.subtext0,
        colors.subtext1,
        colors.text,
      ]
    : [
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
      default: colors.text,
      subdued: colors.subtext0,
      action: {
        primary: { default: colors.text, $focused: contrast, $selected: colors.blue, $disabled: colors.overlay0 },
        secondary: { default: colors.subtext1, $hovered: colors.text, $disabled: colors.overlay0 },
        destructive: { default: contrast, $disabled: colors.overlay0 },
      },
      formfield: { default: colors.text, $disabled: colors.overlay0 },
      status: { running: colors.blue, question: colors.yellow, permission: colors.peach, unread: colors.pink },
      feedback: {
        error: { default: colors.red, subdued: colors.maroon },
        warning: { default: colors.yellow, subdued: colors.peach },
        success: { default: colors.green, subdued: colors.green },
        info: { default: colors.teal, subdued: colors.teal },
      },
    },
    background: {
      default: colors.base,
      surface: { offset: colors.mantle, overlay: colors.surface0 },
      action: {
        primary: {
          default: "transparent",
          $hovered: `${colors.text}0f`,
          $focused: colors.blue,
          $pressed: `${colors.text}1a`,
          $selected: `${colors.overlay2}40`,
          $disabled: "transparent",
        },
        secondary: {
          default: "transparent",
          $hovered: `${colors.text}0f`,
          $focused: `${colors.overlay2}40`,
          $pressed: `${colors.text}1a`,
          $selected: `${colors.overlay2}40`,
          $disabled: "transparent",
        },
        destructive: { default: colors.red, $disabled: colors.surface0 },
      },
      formfield: {
        default: colors.surface0,
        $hovered: colors.surface1,
        $focused: colors.surface1,
        $pressed: colors.surface2,
        $selected: `${colors.overlay2}40`,
        $disabled: colors.base,
      },
      feedback: {
        error: { default: `${colors.red}26` },
        warning: { default: `${colors.yellow}26` },
        success: { default: `${colors.green}26` },
        info: { default: `${colors.teal}26` },
      },
    },
    border: { default: colors.surface1 },
    scrollbar: { default: colors.surface2 },
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
    "@context:elevated": { background: { default: colors.mantle } },
    "@context:overlay": { background: { default: colors.surface0 } },
  }
  const references = new Map<string, string>(
    Object.entries(theme.hue.gray).map(([step, color]) => [color, `$hue.neutral.${step}`]),
  )
  for (const name of ["red", "orange", "yellow", "green", "cyan", "blue", "purple", "accent"] as const) {
    references.set(theme.hue[name][light ? 800 : 200]!, `$hue.${name}.${light ? 800 : 200}`)
  }
  return {
    $schema: "https://opencode.ai/theme.json",
    version: 2,
    standalone: true,
    [light ? "light" : "dark"]: {
      ...Object.fromEntries(
        Object.entries(theme).map(([key, value]) => [key, key === "hue" ? value : referenceColors(value, references)]),
      ),
    },
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
