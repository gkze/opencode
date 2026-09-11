import { CATPPUCCIN_FLAVORS } from "./catppuccin-palette"
import { mapV2Semantics } from "./v2/mapping"
import type { ColorValue, HexColor, ThemeVariant, V2ColorValue } from "./types"

type Swatches = Record<keyof (typeof CATPPUCCIN_FLAVORS)["latte"]["swatches"], HexColor>

// Alpha changes opacity only. Never synthesize another RGB color or snap an
// OpenCode-generated ramp to its nearest palette entry.
const alpha = (color: HexColor, percent: number): HexColor =>
  `${color}${Math.round((percent / 100) * 255)
    .toString(16)
    .padStart(2, "0")}`

export function catppuccinDesktopVariant(flavor: keyof typeof CATPPUCCIN_FLAVORS, isDark: boolean): ThemeVariant {
  const colors = CATPPUCCIN_FLAVORS[flavor].swatches
  return {
    palette: {
      neutral: colors.base,
      ink: colors.text,
      primary: colors.blue,
      accent: colors.pink,
      success: colors.green,
      warning: colors.yellow,
      error: colors.red,
      info: colors.teal,
      interactive: colors.blue,
      diffAdd: colors.green,
      diffDelete: colors.red,
    },
    overrides: legacy(colors, flavor === "latte"),
    v2Overrides: v2(colors, flavor === "latte", isDark),
  }
}

function v2(colors: Swatches, isLatte: boolean, isDark: boolean): Record<string, V2ColorValue> {
  const accents = {
    red: colors.red,
    orange: colors.peach,
    yellow: colors.yellow,
    green: colors.green,
    cyan: colors.sky,
    blue: colors.blue,
    purple: colors.mauve,
    pink: colors.pink,
  }
  const neutrals = isLatte
    ? ([
        "base",
        "mantle",
        "crust",
        "surface0",
        "surface1",
        "surface2",
        "overlay0",
        "overlay1",
        "overlay2",
        "subtext0",
        "subtext1",
        "text",
      ] as const)
    : ([
        "text",
        "subtext1",
        "subtext0",
        "overlay2",
        "overlay1",
        "overlay0",
        "surface2",
        "surface1",
        "surface0",
        "base",
        "mantle",
        "crust",
      ] as const)
  const semantics = mapV2Semantics(isDark)

  return {
    // V2 primitives are an interop surface: direct component references retain
    // their tint/foreground roles without inventing a 12-color Catppuccin ramp.
    "v2-grey-50": colors[neutrals[0]],
    ...Object.fromEntries(neutrals.map((swatch, index) => [`v2-grey-${(index + 1) * 100}`, colors[swatch]])),
    ...Object.fromEntries(
      Object.entries(accents).flatMap(([name, color]) =>
        Object.entries({
          100: 10,
          200: 15,
          300: 100,
          400: 100,
          500: 100,
          600: 100,
          700: 100,
          800: 100,
          900: 50,
          1000: 30,
          1100: 20,
          1200: 10,
        }).map(([step, opacity]) => [`v2-${name}-${step}`, opacity === 100 ? color : alpha(color, opacity)]),
      ),
    ),
    ...Object.fromEntries(
      [100, 90, 80, 70, 60, 50, 40, 30, 24, 20, 16, 14, 12, 10, 8, 6, 4, 2, 0].flatMap((opacity) => [
        [`v2-alpha-dark-${opacity}`, alpha(isLatte ? colors.text : colors.crust, opacity)],
        [`v2-alpha-light-${opacity}`, alpha(isLatte ? colors.base : colors.text, opacity)],
      ]),
    ),

    "v2-background-bg-base": colors.base,
    "v2-background-bg-deep": colors.mantle,
    "v2-background-bg-layer-01": colors.surface0,
    "v2-background-bg-layer-02": colors.surface1,
    "v2-background-bg-layer-03": colors.surface2,
    "v2-background-bg-layer-04": colors.overlay0,
    "v2-background-bg-inverse": colors.text,
    "v2-background-bg-contrast": colors.text,
    "v2-background-bg-icon-button-contrast": isLatte ? colors.text : colors.subtext0,
    "v2-background-bg-button-neutral": colors.surface0,
    "v2-background-bg-message-local": colors.surface0,
    "v2-background-bg-accent": colors.blue,
    "v2-background-bg-code-path": alpha(colors.text, 8),
    "v2-background-bg-code-inline": alpha(colors.text, 8),

    "v2-text-text-base": colors.text,
    "v2-text-text-message-local": colors.text,
    "v2-text-text-muted": colors.subtext1,
    // Latte Subtext0 is 4.369:1 on Base. Small labels use the next canonical
    // foreground, Subtext1, instead of adjusting RGB to cross 4.5:1.
    "v2-text-text-faint": isLatte ? colors.subtext1 : colors.subtext0,
    "v2-text-text-inverse": colors.base,
    "v2-text-text-contrast": colors.base,
    "v2-text-text-accent": colors.blue,
    "v2-text-text-accent-hover": isLatte ? colors.mauve : colors.lavender,
    "v2-text-text-code-accent": colors.blue,
    "v2-text-text-code-path": colors.text,

    // Context metadata needs distinct roles: legacy text-base is also used by
    // body copy, so dimming it globally would flatten the transcript instead.
    "v2-context-label": isLatte ? colors.subtext1 : colors.overlay2,
    "v2-context-metadata": colors.subtext1,
    "v2-context-message-user": isLatte ? colors.text : colors.sapphire,
    "v2-context-message-assistant": colors.mauve,
    "v2-context-message-system": isLatte ? colors.text : colors.yellow,
    "v2-context-numeric": isLatte ? colors.text : colors.peach,
    "v2-icon-icon-base": colors.text,
    "v2-icon-icon-muted": colors.subtext0,
    "v2-icon-icon-faint": colors.overlay0,
    "v2-icon-icon-inverse": colors.base,
    "v2-icon-icon-contrast": colors.base,
    "v2-icon-icon-accent": colors.blue,
    "v2-icon-icon-accent-hover": isLatte ? colors.mauve : colors.lavender,

    "v2-border-border-muted": colors.surface0,
    "v2-border-border-weak": colors.surface0,
    "v2-border-border-base": colors.surface1,
    "v2-border-border-strong": colors.surface2,
    "v2-border-border-inverse": colors.text,
    "v2-border-border-focus": colors.lavender,
    "v2-overlay-simple-overlay-hover": alpha(colors.text, 6),
    "v2-overlay-simple-overlay-pressed": alpha(colors.text, 10),
    "v2-overlay-simple-overlay-contrast-hover": alpha(colors.base, 12),
    "v2-overlay-simple-overlay-contrast-pressed": alpha(colors.base, 24),
    "v2-overlay-simple-overlay-scrim": alpha(isLatte ? colors.text : colors.crust, isDark ? 60 : 40),
    "v2-overlay-gradient-depth-overlay-depth-top": colors.base,
    "v2-overlay-gradient-depth-overlay-depth-bot": alpha(colors.base, 0),
    "v2-overlay-simple-tab-active-scrim": alpha(colors.base, 0),
    "v2-overlay-simple-tab-hover-scrim": alpha(colors.base, 0),
    "v2-overlay-simple-tab-scrim": alpha(colors.base, 0),

    ...Object.fromEntries(
      Object.entries({ success: colors.green, warning: colors.yellow, danger: colors.red, info: colors.blue }).flatMap(
        ([state, color]) => [
          [`v2-state-bg-${state}`, alpha(color, 10)],
          // The tint and border identify the state; Text keeps its label
          // readable without manufacturing a darker or lighter accent.
          [`v2-state-fg-${state}`, colors.text],
          [`v2-state-border-${state}`, alpha(color, 30)],
        ],
      ),
    ),
    ...Object.fromEntries(
      Object.entries({ plan: colors.pink, build: colors.blue, explore: colors.yellow }).flatMap(([agent, color]) => [
        [`v2-agent-${agent}-solid`, color],
        [`v2-agent-${agent}-border`, alpha(color, 20)],
        [`v2-agent-${agent}-background`, alpha(color, 10)],
      ]),
    ),
    "v2-agent-review-solid": colors.green,
    "v2-agent-writer-solid": colors.mauve,
    "v2-avatar-fg": colors.text,
    ...Object.fromEntries(
      Object.entries({ ...accents, gray: colors.overlay2 }).flatMap(([name, color]) => [
        [`v2-avatar-bg-${name}`, alpha(color, 15)],
        [`v2-avatar-border-${name}`, color],
      ]),
    ),

    // Geometry belongs to V2. Its color references are all covered above; this
    // explicit list makes new upstream elevation roles a coverage failure.
    ...Object.fromEntries(
      ["raised", "floating", "overlay", "button-neutral", "button-contrast", "elements", "switch-off", "switch-on"].map(
        (role) => [`v2-elevation-${role}`, semantics[`v2-elevation-${role}`]],
      ),
    ),
    "v2-illustration-illustration-layer-01": colors.surface0,
    "v2-illustration-illustration-layer-02": colors.surface1,
    "v2-illustration-illustration-layer-03": colors.surface2,
  }
}

function legacy(colors: Swatches, isLatte: boolean): Record<string, ColorValue> {
  const statuses = { success: colors.green, warning: colors.yellow, critical: colors.red, info: colors.teal }
  const onAccent = isLatte ? colors.base : colors.crust
  return {
    "background-base": colors.base,
    "background-weak": colors.mantle,
    "background-strong": colors.base,
    "background-stronger": colors.base,
    base: colors.base,
    base2: colors.mantle,
    base3: colors.crust,
    "surface-base": alpha(colors.text, 0),
    "surface-base-hover": alpha(colors.text, 6),
    "surface-base-active": alpha(colors.text, 10),
    "surface-base-interactive-active": alpha(colors.overlay2, 25),
    "surface-inset-base": colors.mantle,
    "surface-inset-base-hover": colors.base,
    "surface-inset-strong": colors.crust,
    "surface-inset-strong-hover": colors.mantle,
    "surface-raised-base": colors.surface0,
    "surface-raised-base-hover": colors.surface1,
    "surface-raised-base-active": colors.surface2,
    "surface-raised-strong": colors.surface1,
    "surface-raised-strong-hover": colors.surface2,
    "surface-raised-stronger": colors.surface2,
    "surface-raised-stronger-hover": colors.overlay0,
    "surface-raised-stronger-non-alpha": colors.surface2,
    "surface-float-base": colors.surface0,
    "surface-float-base-hover": colors.surface1,
    "surface-weak": colors.surface0,
    "surface-weaker": colors.surface1,
    "surface-strong": colors.surface2,
    "surface-brand-base": colors.blue,
    "surface-brand-hover": isLatte ? colors.mauve : colors.lavender,
    "surface-interactive-base": alpha(colors.blue, 10),
    "surface-interactive-hover": alpha(colors.blue, 15),
    "surface-interactive-weak": alpha(colors.blue, 5),
    "surface-interactive-weak-hover": alpha(colors.blue, 10),
    "surface-diff-unchanged-base": colors.base,
    "surface-diff-skip-base": colors.mantle,
    ...Object.fromEntries(
      Object.entries({ add: colors.green, delete: colors.red, hidden: colors.blue }).flatMap(([kind, color]) =>
        Object.entries({ base: 15, weak: 10, weaker: 5, strong: 22, stronger: 30 }).map(([strength, opacity]) => [
          `surface-diff-${kind}-${strength}`,
          alpha(color, opacity),
        ]),
      ),
    ),
    "input-base": colors.base,
    "input-hover": colors.surface0,
    "input-active": colors.base,
    "input-selected": alpha(colors.overlay2, 25),
    "input-focus": colors.base,
    "input-disabled": colors.mantle,
    "text-base": colors.text,
    "text-weak": colors.subtext1,
    "text-weaker": isLatte ? colors.subtext1 : colors.subtext0,
    "text-strong": colors.text,
    "text-stronger": colors.text,
    "text-invert-base": colors.base,
    "text-invert-weak": colors.mantle,
    "text-invert-weaker": colors.crust,
    "text-invert-strong": colors.base,
    "text-interactive-base": colors.blue,
    ...Object.fromEntries(["base", "weak", "weaker", "strong"].map((role) => [`text-on-brand-${role}`, onAccent])),
    "text-on-interactive-base": colors.text,
    "text-on-interactive-weak": colors.subtext1,
    "text-diff-add-base": colors.green,
    "text-diff-add-strong": colors.green,
    "text-diff-delete-base": colors.red,
    "text-diff-delete-strong": colors.red,
    "button-primary-base": colors.text,
    "button-secondary-base": colors.surface0,
    "button-secondary-hover": colors.surface1,
    "button-ghost-hover": alpha(colors.text, 6),
    "button-ghost-hover2": alpha(colors.text, 10),
    ...Object.fromEntries(
      Object.entries({ "": "surface1", "weak-": "surface0", "strong-": "surface2" } as const).flatMap(
        ([strength, swatch]) => [
          [`border-${strength}base`, colors[swatch]],
          [`border-${strength}hover`, colors.surface2],
          [`border-${strength}active`, colors.overlay0],
          [`border-${strength}selected`, colors.blue],
          [`border-${strength}disabled`, colors.surface0],
          [`border-${strength}focus`, colors.lavender],
        ],
      ),
    ),
    "border-weaker-base": colors.surface0,
    ...Object.fromEntries(
      ["base", "hover", "active", "selected", "focus"].map((role) => [`border-interactive-${role}`, colors.blue]),
    ),
    "border-interactive-disabled": colors.surface1,
    "border-color": colors.surface1,
    ...Object.fromEntries(
      Object.entries({ "": colors.subtext1, "weak-": colors.subtext0, "strong-": colors.text }).flatMap(
        ([strength, color]) => [
          [`icon-${strength}base`, color],
          [`icon-${strength}hover`, colors.text],
          [`icon-${strength}active`, colors.text],
          [`icon-${strength}selected`, colors.text],
          [`icon-${strength}disabled`, colors.overlay0],
          [`icon-${strength}focus`, colors.text],
        ],
      ),
    ),
    "icon-invert-base": colors.base,
    "icon-brand-base": colors.blue,
    "icon-interactive-base": colors.blue,
    "icon-on-brand-base": onAccent,
    "icon-on-brand-hover": onAccent,
    "icon-on-brand-selected": onAccent,
    "icon-on-interactive-base": colors.text,
    "icon-agent-plan-base": colors.pink,
    "icon-agent-docs-base": colors.mauve,
    "icon-agent-ask-base": colors.yellow,
    "icon-agent-build-base": colors.blue,
    "icon-diff-add-base": colors.green,
    "icon-diff-add-hover": colors.green,
    "icon-diff-add-active": colors.green,
    "icon-diff-delete-base": colors.red,
    "icon-diff-delete-hover": colors.red,
    "icon-diff-modified-base": colors.peach,
    ...Object.fromEntries(
      Object.entries(statuses).flatMap(([state, color]) => [
        [`surface-${state}-base`, alpha(color, 15)],
        [`surface-${state}-weak`, alpha(color, 10)],
        [`surface-${state}-strong`, alpha(color, 30)],
        [`text-on-${state}-base`, colors.text],
        [`text-on-${state}-weak`, colors.text],
        [`text-on-${state}-strong`, colors.text],
        [`border-${state}-base`, alpha(color, 30)],
        [`border-${state}-hover`, alpha(color, 50)],
        [`border-${state}-selected`, color],
        [`icon-${state}-base`, color],
        [`icon-${state}-hover`, color],
        [`icon-${state}-active`, color],
        [`icon-on-${state}-base`, colors.text],
        [`icon-on-${state}-hover`, colors.text],
        [`icon-on-${state}-selected`, colors.text],
      ]),
    ),
    ...Object.fromEntries(
      Object.entries({
        pink: colors.pink,
        mint: colors.teal,
        orange: colors.peach,
        purple: colors.mauve,
        cyan: colors.sky,
        lime: colors.green,
      }).flatMap(([name, color]) => [
        [`avatar-background-${name}`, alpha(color, 15)],
        [`avatar-text-${name}`, colors.text],
      ]),
    ),
    ...Object.fromEntries(
      Object.entries({
        "syntax-comment": "overlay2",
        "syntax-regexp": "pink",
        "syntax-keyword": "mauve",
        "syntax-primitive": "blue",
        "syntax-variable": "red",
        "syntax-string": "green",
        "syntax-type": "yellow",
        "syntax-constant": "peach",
        "syntax-operator": "sky",
        "syntax-property": "sky",
        "syntax-punctuation": "text",
        "syntax-object": "red",
        "syntax-success": "green",
        "syntax-warning": "yellow",
        "syntax-critical": "red",
        "syntax-info": "teal",
        "syntax-diff-add": "green",
        "syntax-diff-delete": "red",
        "syntax-diff-unknown": "peach",
        "syntax-unknown": "text",
        "markdown-heading": "mauve",
        "markdown-text": "text",
        "markdown-link": "blue",
        "markdown-link-text": "sky",
        "markdown-code": "green",
        "markdown-block-quote": "yellow",
        "markdown-emph": "yellow",
        "markdown-strong": "peach",
        "markdown-horizontal-rule": "subtext0",
        "markdown-list-item": "blue",
        "markdown-list-enumeration": "sky",
        "markdown-image": "blue",
        "markdown-image-text": "sky",
        "markdown-code-block": "text",
      } as const).map(([token, swatch]) => [token, colors[swatch]]),
    ),
  }
}
