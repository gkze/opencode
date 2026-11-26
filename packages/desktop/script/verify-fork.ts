import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { openSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { Fork } from "../fork"

// Checks the packaged fork app before fork-release.yml uploads it. Unlike the workflow and action that call it,
// this file is not a publication control: when upstream changes how the app is built, packaged or started, adapt
// the checks here and keep what each one establishes.

if (import.meta.main) {
  assert.ok(process.env.ARCH === "arm64" || process.env.ARCH === "x64", "ARCH must be arm64 or x64")
  assert.ok(process.env.OPENCODE_VERSION, "OPENCODE_VERSION is required")
  await verify({
    dist: "dist",
    arch: process.env.ARCH,
    native: process.env.NATIVE === "true",
    version: process.env.OPENCODE_VERSION,
  })
}

export async function verify(input: { dist: string; arch: "arm64" | "x64"; native: boolean; version: string }) {
  const found = Array.from(new Bun.Glob(`*/${Fork.name}.app`).scanSync({ cwd: input.dist, onlyFiles: false }))[0]
  assert.ok(found, `No ${Fork.name}.app under ${input.dist}`)
  const app = path.resolve(input.dist, found)
  const executable = path.join(app, "Contents/MacOS", Fork.name)
  const resources = path.join(app, "Contents/Resources")

  run("codesign", "--verify", "--deep", "--strict", app)
  assert.equal(
    run("/usr/libexec/PlistBuddy", "-c", "Print CFBundleIdentifier", path.join(app, "Contents/Info.plist")),
    Fork.id,
  )
  assert.equal(run("lipo", "-archs", executable), input.arch === "x64" ? "x86_64" : "arm64")
  assert.equal((await Bun.file(path.join(resources, "opencode-cli.version")).text()).trim(), input.version)

  // Packaging succeeds without the target's node-pty prebuild, and the app then cannot open a terminal.
  for (const file of ["pty.node", "spawn-helper"])
    assert.equal(
      run(
        "lipo",
        "-archs",
        path.join(
          resources,
          `app.asar.unpacked/node_modules/@lydell/node-pty-darwin-${input.arch}/prebuilds/darwin-${input.arch}`,
          file,
        ),
      ),
      run("lipo", "-archs", executable),
    )

  // A cross-packaged app cannot run on this machine, so it is only checked structurally.
  if (!input.native) return

  await launch(app, path.join(process.env.RUNNER_TEMP ?? os.tmpdir(), "fork-desktop-launch"))
  assert.equal(run(path.join(resources, "opencode-cli"), "--version"), `opencode v${input.version}`)
}

// Upstream turns Electron's runAsNode fuse off, so the app can no longer be asked for its runtime as plain Node:
// it ignores ELECTRON_RUN_AS_NODE, starts for real and never exits. So start it for real, on the throwaway profile
// `root`. A runtime that cannot start (a broken signature, a library the ad-hoc signature may not load) exits at
// once, so an app still running after `wait` milliseconds has started. Its process group is then killed outright
// rather than asked to quit, which could wait on a prompt. What leaves the group (the crash handler, the background
// CLI service) outlives this and ends with the runner.
export async function launch(app: string, root: string, wait = 20_000) {
  const output = openSync(`${root}.log`, "w")

  const child = spawn(path.join(app, "Contents/MacOS", path.basename(app, ".app")), [], {
    detached: true,
    stdio: ["ignore", output, output],
    env: { ...process.env, OPENCODE_DESKTOP_TEST_ROOT: root },
  })

  const exited = await Promise.race([
    new Promise<string>((resolve) => child.once("exit", (code, signal) => resolve(String(signal ?? code)))),
    Bun.sleep(wait).then(() => undefined),
  ])

  // The group is already gone when the app exited by itself and left nothing running.
  Bun.spawnSync(["kill", "-KILL", "--", `-${child.pid}`], { stderr: "ignore" })
  assert.equal(
    exited,
    undefined,
    `The packaged app exited within ${wait / 1000} seconds of starting (${exited}):\n${await Bun.file(`${root}.log`).text()}`,
  )
}

function run(...command: string[]) {
  const result = Bun.spawnSync(command, { stderr: "inherit" })
  assert.equal(result.exitCode, 0, `${command[0]} failed`)

  return result.stdout.toString().trim()
}
