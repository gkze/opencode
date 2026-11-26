import { expect, test } from "bun:test"
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { launch } from "./verify-fork"

// A stand-in bundle whose executables are shell scripts, so the launch check runs wherever a shell does.
function fixture(main: string) {
  const root = mkdtempSync(path.join(os.tmpdir(), "fork-launch-"))
  const app = path.join(root, "Stand In.app")
  mkdirSync(path.join(app, "Contents/MacOS"), { recursive: true })

  for (const [name, body] of Object.entries({ "Stand In": main, helper: "sleep 300" })) {
    writeFileSync(path.join(app, "Contents/MacOS", name), `#!/bin/sh\n${body}\n`)
    chmodSync(path.join(app, "Contents/MacOS", name), 0o755)
  }

  return { root, app }
}

test("an app that keeps running passes, and it and its helper are killed", async () => {
  const f = fixture('"$(dirname "$0")/helper" &\nsleep 300')

  try {
    await launch(f.app, path.join(f.root, "profile"), 500)
    await Bun.sleep(250)
    expect(Bun.spawnSync(["pgrep", "-f", f.root]).stdout.toString()).toBe("")
  } finally {
    rmSync(f.root, { recursive: true, force: true })
  }
})

test("an app that exits at once fails with what it printed", async () => {
  const f = fixture('echo "dyld: Library not loaded" >&2\nexit 3')

  try {
    await expect(launch(f.app, path.join(f.root, "profile"), 5_000)).rejects.toThrow(
      /exited within 5 seconds of starting \(3\):\ndyld: Library not loaded/,
    )
  } finally {
    rmSync(f.root, { recursive: true, force: true })
  }
})
