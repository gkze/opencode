import type { DesktopTheme } from "./types"
import { CATPPUCCIN_FLAVORS } from "./catppuccin-palette"
import { catppuccinDesktopVariant } from "./catppuccin-desktop"

export { CATPPUCCIN_FLAVORS, CATPPUCCIN_PALETTE_VERSION } from "./catppuccin-palette"

export const CATPPUCCIN_FLAVOR_NAMES = Object.keys(CATPPUCCIN_FLAVORS) as CatppuccinFlavor[]
export const CATPPUCCIN_DESKTOP_LIGHT_FLAVOR = "latte" as const

export type CatppuccinFlavor = keyof typeof CATPPUCCIN_FLAVORS
export type CatppuccinSwatch = keyof (typeof CATPPUCCIN_FLAVORS)["latte"]["swatches"]

const desktopFlavor = (flavor: CatppuccinFlavor, mode: "light" | "dark") =>
  mode === "light" ? CATPPUCCIN_DESKTOP_LIGHT_FLAVOR : flavor
export const createCatppuccinDesktopTheme = (flavor: CatppuccinFlavor): DesktopTheme => ({
  $schema: "https://opencode.ai/desktop-theme.json",
  name: `Catppuccin ${CATPPUCCIN_FLAVORS[flavor].label}`,
  id: `catppuccin-${flavor}`,
  light: catppuccinDesktopVariant(desktopFlavor(flavor, "light"), false),
  dark: catppuccinDesktopVariant(desktopFlavor(flavor, "dark"), true),
})
