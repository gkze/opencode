import { beforeEach, describe, expect, test } from "bun:test"
import { CATPPUCCIN_PRELOAD } from "@opencode/ui/theme/catppuccin-preload"

const src = await Bun.file(new URL("../public/oc-theme-preload.js", import.meta.url)).text()

const run = () => Function(src)()

const setSystemDark = (matches: boolean) =>
  Object.defineProperty(window, "matchMedia", {
    value: () => ({ matches }),
    configurable: true,
  })

beforeEach(() => {
  document.head.innerHTML = ""
  document.documentElement.removeAttribute("data-theme")
  document.documentElement.removeAttribute("data-color-scheme")
  document.documentElement.style.removeProperty("background-color")
  localStorage.clear()
  setSystemDark(false)
})

describe("theme preload", () => {
  test.each([
    { stored: undefined, systemDark: false, scheme: "light", background: "#fafafa" },
    { stored: "dark", systemDark: false, scheme: "dark", background: "#080808" },
    { stored: "light", systemDark: true, scheme: "light", background: "#fafafa" },
    { stored: "system", systemDark: true, scheme: "dark", background: "#080808" },
  ])(
    "paints the default theme in $scheme for stored scheme $stored (system dark: $systemDark)",
    ({ stored, systemDark, scheme, background }) => {
      setSystemDark(systemDark)

      if (stored) localStorage.setItem("opencode-color-scheme", stored)
      run()

      expect(document.documentElement.dataset.theme).toBe("oc-2")
      expect(document.documentElement.dataset.colorScheme).toBe(scheme)
      expect(document.documentElement.style.backgroundColor).toBe(background)
    },
  )

  test.each([
    { scheme: undefined, key: "opencode-theme-css-light", css: "--background-base:#fff;", expected: "light" },
    { scheme: "dark", key: "opencode-theme-css-dark", css: "--background-base:#010203;", expected: "dark" },
  ])("restores the cached $expected css of a custom theme", ({ scheme, key, css, expected }) => {
    localStorage.setItem("opencode-theme-id", "nightowl")

    if (scheme) localStorage.setItem("opencode-color-scheme", scheme)
    localStorage.setItem(key, css)
    run()

    expect(document.documentElement.dataset.theme).toBe("nightowl")
    expect(document.documentElement.dataset.colorScheme).toBe(expected)
    expect(document.getElementById("oc-theme-preload")?.textContent).toContain(css)
  })
})

describe("Catppuccin preload", () => {
  test.each([
    ["catppuccin-latte", "light", true],
    ["catppuccin-frappe", "dark", false],
    ["catppuccin-macchiato", "dark", false],
    ["catppuccin-mocha", "dark", false],
  ] as const)("restores %s independently of the system", (id, mode, systemDark) => {
    setSystemDark(systemDark)
    localStorage.setItem("opencode-theme-id", id)
    localStorage.setItem("opencode-catppuccin-revision", CATPPUCCIN_PRELOAD.revision)
    localStorage.setItem("opencode-theme-css-" + mode, "--v2-text-text-accent:#123456;")
    run()
    expect(document.documentElement.dataset.colorScheme).toBe(mode)
    expect(document.documentElement.style.backgroundColor).toBe(CATPPUCCIN_PRELOAD.themes[id].background)
    expect(document.getElementById("oc-theme-preload")?.textContent).toContain("--v2-text-text-accent:#123456;")
  })

  test("discards the old generated surfaces before first paint", () => {
    localStorage.setItem("opencode-theme-id", "catppuccin-frappe")
    localStorage.setItem("opencode-theme-css-dark", "--v2-background-bg-base:#212435;")
    localStorage.setItem("opencode-catppuccin-revision", "old-theme")
    run()
    expect(document.getElementById("oc-theme-preload")).toBeNull()
    expect(localStorage.getItem("opencode-theme-css-dark")).toBeNull()
    expect(document.documentElement.style.backgroundColor).toBe("#303446")
  })

  test.each([
    [false, "catppuccin-latte"],
    [true, "catppuccin-mocha"],
  ] as const)("migrates the legacy selection and invalidates stale CSS (dark: %s)", (systemDark, id) => {
    setSystemDark(systemDark)
    localStorage.setItem("opencode-theme-id", "catppuccin")
    localStorage.setItem("opencode-theme-css-light", "--background-base:#ffffff;")
    localStorage.setItem("opencode-theme-css-dark", "--background-base:#000000;")
    run()
    expect(localStorage.getItem("opencode-theme-id")).toBe(id)
    expect(document.documentElement.dataset.theme).toBe(id)
    expect(document.getElementById("oc-theme-preload")).toBeNull()
  })

  test("normalizes malformed stored appearance", () => {
    setSystemDark(true)
    localStorage.setItem("opencode-color-scheme", "invalid")
    run()
    expect(localStorage.getItem("opencode-color-scheme")).toBe("system")
    expect(document.documentElement.dataset.colorScheme).toBe("dark")
  })
})
