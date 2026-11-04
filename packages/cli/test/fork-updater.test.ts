import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

test("fork CLI rejects explicit upstream upgrades", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "fork-updater-"))
  try {
    const child = Bun.spawn(
      [
        process.execPath,
        "--define",
        "OPENCODE_FORK=true",
        "--define",
        'OPENCODE_CHANNEL="dev"',
        "src/index.ts",
        "upgrade",
        "2.0.26",
        "--method",
        "npm",
      ],
      {
        cwd: path.join(import.meta.dir, ".."),
        env: {
          ...process.env,
          OPENCODE_TEST_HOME: root,
          XDG_CONFIG_HOME: path.join(root, "config"),
          XDG_DATA_HOME: path.join(root, "data"),
          XDG_STATE_HOME: path.join(root, "state"),
          XDG_CACHE_HOME: path.join(root, "cache"),
        },
        stdout: "pipe",
        stderr: "pipe",
      },
    )
    const output = (await new Response(child.stdout).text()) + (await new Response(child.stderr).text())
    expect(await child.exited).not.toBe(0)
    expect(output).toContain("Upstream updates are disabled for this build")
    expect(output).toContain("github.com/gkze/opencode/releases")
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}, 30_000)
