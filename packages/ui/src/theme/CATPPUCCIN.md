# Catppuccin desktop themes

`catppuccin-palette.ts` is generated from the pinned official
`@catppuccin/palette` development dependency. Its RGB swatches are the authority
for all four flavors. `catppuccin-desktop.ts` assigns those swatches to OpenCode
roles; `script/catppuccin.ts` generates the named desktop theme JSON and startup
CSS. The runtime does not import the palette package.

The mapping uses the [Catppuccin style guide](https://github.com/catppuccin/catppuccin/blob/main/docs/style-guide.md)
for palette roles. OpenCode-specific assignments below are our design choices,
not additional requirements of that guide:

| Role | Palette assignment |
| --- | --- |
| Main content / secondary depth | Base / Mantle |
| Raised elements | Surface0, Surface1, Surface2; Overlay0 for the fourth V2 layer |
| Body / muted / faint text | Text / Subtext1 / Subtext0 |
| Local user message bubbles | Surface0 background, Text foreground |
| Ordinary inline code, including paths | Text on an 8% Text tint |
| Context quantities: counts, tokens, percentages, cost | Peach |
| Context user / assistant / system text labels | Sapphire / Mauve / Yellow |
| Context labels / IDs | Overlay2 / Subtext1 |
| Inverse and contrast controls | Text background, Base foreground |
| Accent / focused border | Blue / Lavender |
| Success / warning / danger / information | Green / Yellow / Red / Blue tint and border, Text label |
| Selection | Overlay2 at 25% opacity |

Dark submit and contrast icon buttons use Subtext0 beneath the existing Text
highlight. The two colors must differ for V2's vertical gradient to remain
visible. Gradient geometry, shadow geometry, and disabled opacity stay upstream.

Context labels use Overlay2 only on the context pane's Base background, where
it meets 4.5:1 in every dark flavor. This does not dim other muted UI labels.

The context pane colors quantities consistently regardless of the participant
they describe. Participant accents apply only to role names in raw-message
headers, never to counts. Peach extends the syntax convention for numbers to
UI quantities; Sapphire/Mauve/Yellow distinguish participant categories by our
choice. Dates, identifiers, and other metadata retain their text roles.

Ordinary inline code and non-link paths share neutral foreground and background
colors. Monospace alone does not imply syntax or interactivity: actual links
retain their link accent and underline, and fenced code retains language-aware
syntax colors. This avoids giving paths the numeric accent or suggesting that
unlinked paths are clickable. Other themes retain their upstream code styling
through the optional inline-background token's fallbacks.

Latte uses Text for numeric context values and user/system labels:
its Peach, Sapphire, and Yellow do not meet 4.5:1 on Base. Context labels use
Subtext1; assistant roles retain Mauve. These exceptions preserve readability
without inventing darker accents or using error Red for ordinary metadata.

Latte faint labels use Subtext1 because Subtext0 on Base is only 4.369:1.
Latte accent hover uses Mauve; dark flavors use Lavender. These are explicit
choices among canonical colors, not an RGB adjustment or a distance-based color
substitution. Canonical syntax and link colors remain canonical even where a
particular foreground/background pair does not meet 4.5:1; this is not a claim
that every possible rendered color combination meets WCAG AA.

The two override maps are complete. `overrides` owns still-consumed legacy
markdown, syntax, diff and UI roles. `v2Overrides` owns all V2 semantics,
foregrounds, avatars, agents, primitives and global alpha ramps. Keeping every
assignment, even when it equals an upstream default, prevents changes in
OpenCode's generated ramps from silently changing the theme.

V2 primitives are compatibility roles, not a new interpolated Catppuccin
palette. Grey steps select the ordered canonical neutrals. Chromatic steps
100/200 and 900–1200 are explicit accent tint recipes; 300–800 select the
canonical accent. This also covers components that directly use primitive
tokens. Local message bubbles use dedicated background and text roles so their
neutral treatment does not recolor unrelated blue accents. Other themes retain
the upstream blue pairing through CSS fallbacks. No OKLCH interpolation or nearest-color
search is part of the Catppuccin mapping.

Opacity recipes keep the source RGB channels intact. Hover and pressed overlays
use Text at 6% and 10%; contrast overlays use Base at 12% and 24%. State, agent,
avatar and diff backgrounds use documented percentages in the mapping. Their
composited pixels naturally differ from an opaque swatch. Elevation geometry
comes from an explicit list of V2 roles, with every referenced alpha color
mapped to canonical palette endpoints. Layout and component behavior remain
owned by V2.

Run from the repository's pinned development environment:

```sh
nix develop -c bun run --cwd packages/ui script/catppuccin-palette.ts --check
nix develop -c bun run --cwd packages/ui script/catppuccin.ts --check
nix develop -c bun test --cwd packages/ui src/theme/catppuccin.test.ts
```

The fidelity tests compare the generated palette to the official source, check
complete resolver and CSS-consumer token coverage, inspect final resolved
values for canonical RGB provenance, and measure the final foreground/background
pairs after overrides. New upstream roles must be assigned deliberately.
