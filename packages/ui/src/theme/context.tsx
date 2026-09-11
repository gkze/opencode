// @refresh reload

import { createEffect, onMount } from "solid-js"
import { createStore } from "solid-js/store"
import { makeEventListener } from "@solid-primitives/event-listener"
import { createSimpleContext } from "../context/helper"
import oc2ThemeJson from "./themes/oc-2.json"
import {
  compareThemeIds,
  parseColorScheme,
  resolveLegacyThemeId,
  resolveThemeMode,
  themeAppearanceMode,
  type ThemeColorScheme,
} from "./appearance"
import { themeCacheCss, themeVariantCss } from "./theme-css"
import { CATPPUCCIN_PRELOAD } from "./catppuccin-preload"
import type { DesktopTheme } from "./types"

export type ColorScheme = ThemeColorScheme

const STORAGE_KEYS = {
  THEME_ID: "opencode-theme-id",
  COLOR_SCHEME: "opencode-color-scheme",
  THEME_CSS_LIGHT: "opencode-theme-css-light",
  THEME_CSS_DARK: "opencode-theme-css-dark",
  CATPPUCCIN_REVISION: "opencode-catppuccin-revision",
} as const

const THEME_STYLE_ID = "oc-theme"
let files: Record<string, () => Promise<{ default: DesktopTheme }>> | undefined
let ids: string[] | undefined
let known: Set<string> | undefined

function getFiles() {
  if (files) return files
  files = import.meta.glob<{ default: DesktopTheme }>("./themes/*.json")
  return files
}

function themeIDs() {
  if (ids) return ids
  ids = Object.keys(getFiles())
    .map((path) => path.slice("./themes/".length, -".json".length))
    .sort(compareThemeIds)
  return ids
}

function knownThemes() {
  if (known) return known
  known = new Set(themeIDs())
  return known
}

const names: Record<string, string> = {
  "oc-2": "OC-2",
  amoled: "AMOLED",
  aura: "Aura",
  ayu: "Ayu",
  carbonfox: "Carbonfox",
  "catppuccin-latte": "Catppuccin Latte",
  "catppuccin-mocha": "Catppuccin Mocha",
  "catppuccin-frappe": "Catppuccin Frappé",
  "catppuccin-macchiato": "Catppuccin Macchiato",
  cobalt2: "Cobalt2",
  cursor: "Cursor",
  dracula: "Dracula",
  everforest: "Everforest",
  flexoki: "Flexoki",
  github: "GitHub",
  gruvbox: "Gruvbox",
  kanagawa: "Kanagawa",
  "lucent-orng": "Lucent Orng",
  material: "Material",
  matrix: "Matrix",
  mercury: "Mercury",
  monokai: "Monokai",
  nightowl: "Night Owl",
  nord: "Nord",
  "one-dark": "One Dark",
  onedarkpro: "One Dark Pro",
  opencode: "OpenCode",
  orng: "Orng",
  "osaka-jade": "Osaka Jade",
  palenight: "Palenight",
  rosepine: "Rose Pine",
  shadesofpurple: "Shades of Purple",
  solarized: "Solarized",
  synthwave84: "Synthwave '84",
  tokyonight: "Tokyonight",
  vercel: "Vercel",
  vesper: "Vesper",
  zenburn: "Zenburn",
}
const oc2Theme = oc2ThemeJson as DesktopTheme

function resolveStoredTheme(
  id: string | null | undefined,
  mode: "light" | "dark",
  registered?: Record<string, DesktopTheme>,
) {
  const next = resolveLegacyThemeId(id ?? "", mode)
  if (next === "oc-2" || (next && (knownThemes().has(next) || registered?.[next]))) return next
  return "oc-2"
}

function read(key: string) {
  if (typeof localStorage !== "object") return null
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string) {
  if (typeof localStorage !== "object") return
  try {
    localStorage.setItem(key, value)
  } catch {}
}

function drop(key: string) {
  if (typeof localStorage !== "object") return
  try {
    localStorage.removeItem(key)
  } catch {}
}

function clear() {
  drop(STORAGE_KEYS.THEME_CSS_LIGHT)
  drop(STORAGE_KEYS.THEME_CSS_DARK)
}

function ensureThemeStyleElement(): HTMLStyleElement {
  const existing = document.getElementById(THEME_STYLE_ID) as HTMLStyleElement | null
  if (existing) return existing
  const element = document.createElement("style")
  element.id = THEME_STYLE_ID
  document.head.appendChild(element)
  return element
}

function getSystemMode(): "light" | "dark" {
  if (typeof window !== "object") return "light"
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

function applyThemeCss(theme: DesktopTheme, themeId: string, mode: "light" | "dark") {
  const isDark = mode === "dark"
  const variant = isDark ? theme.dark : theme.light
  const css = themeVariantCss(variant, isDark)

  if (themeId !== "oc-2") {
    const modes = themeAppearanceMode(themeId) ? ["light", "dark"] : [mode]
    modes.forEach((value) => write(value === "dark" ? STORAGE_KEYS.THEME_CSS_DARK : STORAGE_KEYS.THEME_CSS_LIGHT, css))
    if (themeAppearanceMode(themeId)) write(STORAGE_KEYS.CATPPUCCIN_REVISION, CATPPUCCIN_PRELOAD.revision)
  }

  const fullCss = `:root {
  color-scheme: ${mode};
  --text-mix-blend-mode: ${isDark ? "plus-lighter" : "multiply"};
  ${css}
}`

  document.getElementById("oc-theme-preload")?.remove()
  ensureThemeStyleElement().textContent = fullCss
  document.documentElement.dataset.theme = themeId
  document.documentElement.dataset.colorScheme = mode
  const background = themeAppearanceMode(themeId)
    ? getComputedStyle(document.documentElement).getPropertyValue("--v2-background-bg-base").trim()
    : isDark ? "#080808" : "#fafafa"
  document.documentElement.style.backgroundColor = background

  // Update theme-color meta tag to match light/dark mode
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute("content", background)
}

function cacheThemeVariants(theme: DesktopTheme, themeId: string) {
  if (themeId === "oc-2") return
  const css = themeCacheCss(theme, themeId)
  write(STORAGE_KEYS.THEME_CSS_LIGHT, css.light)
  write(STORAGE_KEYS.THEME_CSS_DARK, css.dark)
  if (themeAppearanceMode(themeId)) write(STORAGE_KEYS.CATPPUCCIN_REVISION, CATPPUCCIN_PRELOAD.revision)
}

export const { use: useTheme, provider: ThemeProvider } = createSimpleContext({
  name: "Theme",
  init: (props: {
    defaultTheme?: string
    onThemeApplied?: (theme: DesktopTheme, mode: "light" | "dark", scheme: ColorScheme) => void
  }) => {
    const resolveMode = (id: string, scheme: ColorScheme) => resolveThemeMode(id, scheme, getSystemMode())
    const colorScheme = parseColorScheme(read(STORAGE_KEYS.COLOR_SCHEME)) ?? "system"
    const appearance = colorScheme === "system" ? getSystemMode() : colorScheme
    const rawTheme = read(STORAGE_KEYS.THEME_ID) ?? props.defaultTheme
    const themeId = resolveStoredTheme(rawTheme, appearance)
    if (rawTheme && rawTheme !== themeId) {
      write(STORAGE_KEYS.THEME_ID, themeId)
      clear()
    }
    const mode = resolveMode(themeId, colorScheme)
    const [store, setStore] = createStore({
      themes: {
        "oc-2": oc2Theme,
      } as Record<string, DesktopTheme>,
      themeId,
      colorScheme,
      mode,
      previewThemeId: null as string | null,
      previewScheme: null as ColorScheme | null,
    })

    const loads = new Map<string, Promise<DesktopTheme | undefined>>()

    const load = (id: string) => {
      const next = id
      if (!next) return Promise.resolve(undefined)
      const hit = store.themes[next]
      if (hit) return Promise.resolve(hit)
      const pending = loads.get(next)
      if (pending) return pending
      const file = getFiles()[`./themes/${next}.json`]
      if (!file) return Promise.resolve(undefined)
      const task = file()
        .then((mod) => {
          const theme = mod.default
          setStore("themes", next, theme)
          return theme
        })
        .finally(() => {
          loads.delete(next)
        })
      loads.set(next, task)
      return task
    }

    const applyTheme = (theme: DesktopTheme, themeId: string, mode: "light" | "dark", scheme: ColorScheme) => {
      applyThemeCss(theme, themeId, mode)
      props.onThemeApplied?.(theme, mode, scheme)
    }

    const ids = () => {
      const extra = Object.keys(store.themes)
        .filter((id) => !knownThemes().has(id))
        .sort()
      const all = themeIDs()
      if (extra.length === 0) return all
      return [...all, ...extra]
    }

    const loadThemes = () => Promise.all(themeIDs().map(load)).then(() => store.themes)

    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEYS.THEME_ID && e.newValue) {
        const appearance = store.colorScheme === "system" ? getSystemMode() : store.colorScheme
        const next = resolveStoredTheme(e.newValue, appearance, store.themes)
        if (next !== e.newValue) {
          write(STORAGE_KEYS.THEME_ID, next)
          clear()
        }
        setStore("themeId", next)
        setStore("mode", resolveMode(next, store.colorScheme))
        if (next === "oc-2") {
          clear()
          return
        }
        void load(next).then((theme) => {
          if (!theme || store.themeId !== next) return
          cacheThemeVariants(theme, next)
        })
      }
      if (e.key === STORAGE_KEYS.COLOR_SCHEME && e.newValue) {
        const scheme = parseColorScheme(e.newValue) ?? "system"
        if (scheme !== e.newValue) write(STORAGE_KEYS.COLOR_SCHEME, scheme)
        setStore("colorScheme", scheme)
        setStore("mode", resolveMode(store.themeId, scheme))
      }
    }

    onMount(() => {
      makeEventListener(window, "storage", onStorage)

      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
      const onMedia = () => {
        if (store.colorScheme !== "system") return
        setStore("mode", resolveMode(store.themeId, "system"))
      }
      makeEventListener(mediaQuery, "change", onMedia)

      const rawTheme = read(STORAGE_KEYS.THEME_ID) ?? props.defaultTheme
      const rawScheme = read(STORAGE_KEYS.COLOR_SCHEME)
      const savedScheme = parseColorScheme(rawScheme) ?? "system"
      const appearance = savedScheme === "system" ? getSystemMode() : savedScheme
      const savedTheme = resolveStoredTheme(rawTheme, appearance, store.themes)
      if (rawScheme !== null && rawScheme !== savedScheme) write(STORAGE_KEYS.COLOR_SCHEME, savedScheme)
      if (rawTheme && rawTheme !== savedTheme) {
        write(STORAGE_KEYS.THEME_ID, savedTheme)
        clear()
      }
      if (savedTheme !== store.themeId) setStore("themeId", savedTheme)
      if (savedScheme !== store.colorScheme) setStore("colorScheme", savedScheme)
      setStore("mode", resolveMode(savedTheme, savedScheme))
      void load(savedTheme).then((theme) => {
        if (!theme || store.themeId !== savedTheme) return
        cacheThemeVariants(theme, savedTheme)
      })
    })

    createEffect(() => {
      const theme = store.themes[store.themeId]
      if (!theme) return
      applyTheme(theme, store.themeId, store.mode, store.colorScheme)
    })

    const setTheme = (id: string) => {
      const appearance = store.colorScheme === "system" ? getSystemMode() : store.colorScheme
      const next = resolveLegacyThemeId(id, appearance)
      if (!next) {
        console.warn(`Theme "${id}" not found`)
        return
      }
      if (next !== "oc-2" && !knownThemes().has(next) && !store.themes[next]) {
        console.warn(`Theme "${id}" not found`)
        return
      }
      setStore("themeId", next)
      setStore("mode", resolveMode(next, store.colorScheme))
      if (next === "oc-2") {
        write(STORAGE_KEYS.THEME_ID, next)
        clear()
        return
      }
      void load(next).then((theme) => {
        if (!theme || store.themeId !== next) return
        cacheThemeVariants(theme, next)
        write(STORAGE_KEYS.THEME_ID, next)
      })
    }

    const setColorScheme = (scheme: ColorScheme) => {
      setStore("colorScheme", scheme)
      write(STORAGE_KEYS.COLOR_SCHEME, scheme)
      setStore("mode", resolveMode(store.themeId, scheme))
    }

    return {
      themeId: () => store.themeId,
      colorScheme: () => store.colorScheme,
      mode: () => store.mode,
      ids,
      name: (id: string) => store.themes[id]?.name ?? names[id] ?? id,
      loadThemes,
      themes: () => store.themes,
      setTheme,
      setColorScheme,
      registerTheme: (theme: DesktopTheme) => setStore("themes", theme.id, theme),
      previewTheme: (id: string) => {
        const next = id
        if (!next) return
        if (next !== "oc-2" && !knownThemes().has(next) && !store.themes[next]) return
        setStore("previewThemeId", next)
        void load(next).then((theme) => {
          if (!theme || store.previewThemeId !== next) return
          const scheme = store.previewScheme ?? store.colorScheme
          applyTheme(theme, next, resolveMode(next, scheme), scheme)
        })
      },
      previewColorScheme: (scheme: ColorScheme) => {
        setStore("previewScheme", scheme)
        const id = store.previewThemeId ?? store.themeId
        void load(id).then((theme) => {
          if (!theme) return
          if ((store.previewThemeId ?? store.themeId) !== id) return
          if (store.previewScheme !== scheme) return
          applyTheme(theme, id, resolveMode(id, scheme), scheme)
        })
      },
      commitPreview: () => {
        if (store.previewThemeId) {
          setTheme(store.previewThemeId)
        }
        if (store.previewScheme) {
          setColorScheme(store.previewScheme)
        }
        setStore("previewThemeId", null)
        setStore("previewScheme", null)
      },
      cancelPreview: () => {
        setStore("previewThemeId", null)
        setStore("previewScheme", null)
        void load(store.themeId).then((theme) => {
          if (!theme) return
          applyTheme(theme, store.themeId, store.mode, store.colorScheme)
        })
      },
    }
  },
})
