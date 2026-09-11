import { render } from "solid-js/web"
import { Icon } from "@opencode/ui/icon"
import { ThemeProvider, useTheme } from "@opencode/ui/theme"
import { Markdown } from "../src/components/markdown"

export function mountCatppuccin(id: string) {
  const host = document.createElement("div")
  host.dataset.testid = "catppuccin-fixture"
  document.body.appendChild(host)
  return render(
    () => (
      <ThemeProvider>
        <Example id={id} />
      </ThemeProvider>
    ),
    host,
  )
}

function Example(props: { id: string }) {
  const theme = useTheme()
  return (
    <>
      <button onClick={() => theme.setTheme(props.id)}>Apply Catppuccin</button>
      <div data-testid="catppuccin-surface" style={{ background: "var(--v2-background-bg-base)", padding: "24px" }}>
        <Markdown text={"Readable response text.\n\n```ts\nconst answer = 42\n```"} />
        {(["base", "muted", "faint"] as const).map((role) => (
          <Icon name="help" data-testid={`catppuccin-icon-${role}`} style={{ color: `var(--v2-icon-icon-${role})` }} />
        ))}
      </div>
    </>
  )
}
