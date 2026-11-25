;(function () {
  var key = "opencode-theme-id"
  var themeId = localStorage.getItem(key) || "oc-2"

  var rawScheme = localStorage.getItem("opencode-color-scheme")
  var scheme = rawScheme === "light" || rawScheme === "dark" || rawScheme === "system" ? rawScheme : "system"
  if (rawScheme !== null && rawScheme !== scheme) localStorage.setItem("opencode-color-scheme", scheme)
  var systemMode = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
  var appearance = scheme === "system" ? systemMode : scheme
  if (themeId === "catppuccin") {
    themeId = appearance === "light" ? "catppuccin-latte" : "catppuccin-mocha"
    localStorage.setItem(key, themeId)
    localStorage.removeItem("opencode-theme-css-light")
    localStorage.removeItem("opencode-theme-css-dark")
  }
  // BEGIN GENERATED CATPPUCCIN
  var catppuccin = {
    revision: "b5afd2a57afe1d7a178e61fcf8cac749ccb06e767564cb66cdc7e473edb295eb",
    themes: {
      "catppuccin-latte": { mode: "light", background: "#eff1f5" },
      "catppuccin-frappe": { mode: "dark", background: "#303446" },
      "catppuccin-macchiato": { mode: "dark", background: "#24273a" },
      "catppuccin-mocha": { mode: "dark", background: "#1e1e2e" },
    },
  }
  // END GENERATED CATPPUCCIN
  var forced = catppuccin.themes[themeId]
  var mode = forced ? forced.mode : appearance
  var isDark = mode === "dark"
  var background = forced ? forced.background : isDark ? "#080808" : "#fafafa"
  if (forced && localStorage.getItem("opencode-catppuccin-revision") !== catppuccin.revision) {
    localStorage.removeItem("opencode-theme-css-light")
    localStorage.removeItem("opencode-theme-css-dark")
  }

  document.documentElement.dataset.theme = themeId
  document.documentElement.dataset.colorScheme = mode
  document.documentElement.style.backgroundColor = background

  // Update theme-color meta tag to match app color scheme
  var metas = document.querySelectorAll("meta[name='theme-color']")
  if (metas.length > 0) metas[0].setAttribute("content", background)

  if (themeId === "oc-2") return

  var css = localStorage.getItem("opencode-theme-css-" + mode)
  if (css) {
    var style = document.createElement("style")
    style.id = "oc-theme-preload"
    style.textContent =
      ":root{color-scheme:" +
      mode +
      ";--text-mix-blend-mode:" +
      (isDark ? "plus-lighter" : "multiply") +
      ";" +
      css +
      "}"
    document.head.appendChild(style)
  }
})()
