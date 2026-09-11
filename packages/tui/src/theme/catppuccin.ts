import latte from "./assets/catppuccin-latte.json" with { type: "json" }
import frappe from "./assets/catppuccin-frappe.json" with { type: "json" }
import macchiato from "./assets/catppuccin-macchiato.json" with { type: "json" }
import mocha from "./assets/catppuccin-mocha.json" with { type: "json" }

export const CATPPUCCIN_THEMES = {
  "catppuccin-latte": latte,
  "catppuccin-frappe": frappe,
  "catppuccin-macchiato": macchiato,
  "catppuccin-mocha": mocha,
  // Existing configs retain their light/dark selection without retaining the obsolete palette.
  catppuccin: { version: 2, standalone: true, light: latte.light, dark: mocha.dark },
}
