import { expect, test } from "bun:test"

// A subprocess keeps build-time environment and config module caches isolated.
test("fork packaging keeps ad-hoc signing and disables upstream distribution", async () => {
  const child = Bun.spawn(
    [
      process.execPath,
      "-e",
      'const config = (await import("./electron-builder.fork.ts")).default; console.log(JSON.stringify(config))',
    ],
    {
      cwd: import.meta.dir,
      env: { ...process.env, OPENCODE_CHANNEL: "dev", OPENCODE_FORK: "1" },
      stdout: "pipe",
      stderr: "pipe",
    },
  )
  const config = JSON.parse(await new Response(child.stdout).text())
  expect(await child.exited).toBe(0)
  expect(config.appId).toBe("io.github.gkze.opencode")
  expect(config.productName).toBe("OpenCode Fork")
  expect(config.mac.identity).toBe("-")
  expect(config.mac.notarize).toBe(false)
  expect(config.publish).toBeNull()
  expect(config.protocols).toEqual([])
  expect(config.extraResources[0].filter).toContain("opencode-cli")
})

test("fork packaging rejects a channel that enables upstream desktop updates", async () => {
  const child = Bun.spawn([process.execPath, "-e", 'await import("./electron-builder.fork.ts")'], {
    cwd: import.meta.dir,
    env: { ...process.env, OPENCODE_CHANNEL: "prod", OPENCODE_FORK: "1" },
    stdout: "pipe",
    stderr: "pipe",
  })
  expect(await child.exited).not.toBe(0)
  expect(await new Response(child.stderr).text()).toContain("require OPENCODE_CHANNEL=dev")
})
