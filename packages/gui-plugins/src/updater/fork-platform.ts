import { execFile, spawn } from "node:child_process"
import { createHash } from "node:crypto"
import { once } from "node:events"
import { constants, createWriteStream } from "node:fs"
import { access, mkdir, rm } from "node:fs/promises"
import path from "node:path"
import { promisify } from "node:util"
import { app } from "electron"
import { Effect, Schema } from "effect"
import { checksumFor, FORK_REPOSITORY, GitHubReleases, latestForkRelease, type ForkRelease } from "./fork-release"
import type { Platform } from "./machine"

const execFileAsync = promisify(execFile)

const restartTimeout = 10_000

// Fork builds are ad-hoc signed, so every build has its own designated requirement and Squirrel.Mac rejects each update.
// This platform installs from the fork's GitHub releases instead: it verifies the archive against the release's
// SHA256SUMS and the unpacked app's signature and version, then a detached shell swaps the bundle once the app exits.
const swapScript = `
pid=$1 next=$2 target=$3
while kill -0 "$pid" 2>/dev/null; do sleep 0.2; done
backup="$target.previous"
rm -rf "$backup"
mv "$target" "$backup" || { open "$target"; exit 1; }
if mv "$next" "$target"; then
  rm -rf "$backup" "$(dirname "$next")"
else
  rm -rf "$target"
  mv "$backup" "$target"
fi
open "$target"
`

/** The release the last check found, and the app staged from it. */
type Pending = { release?: ForkRelease; app?: string }

export const make = Effect.fn("Updater.forkPlatform")(function* () {
  // The executable is <bundle>/Contents/MacOS/<name>.
  const bundle = path.resolve(app.getPath("exe"), "../../..")
  const staging = path.join(app.getPath("userData"), "updates")
  const headers = { "User-Agent": `opencode/dev/${app.getVersion()}/desktop` }
  const pending: Pending = {}
  const runFork = Effect.runForkWith(yield* Effect.context())
  yield* Effect.logInfo("fork updater configured", {
    repository: FORK_REPOSITORY,
    bundle,
    currentVersion: app.getVersion(),
  })

  const checkForUpdate = Effect.tryPromise({
    try: async (signal) => {
      const response = await fetch(`https://api.github.com/repos/${FORK_REPOSITORY}/releases?per_page=30`, {
        headers: { ...headers, Accept: "application/vnd.github+json" },
        signal,
      })

      if (!response.ok) throw new Error(`Fork release lookup failed with HTTP ${response.status}`)

      const release = latestForkRelease(Schema.decodeUnknownSync(GitHubReleases)(await response.json()), {
        currentVersion: app.getVersion(),
        arch: process.arch,
      })

      pending.release = release

      return release && ({ mode: "restart", version: release.version } as const)
    },
    catch: (error) => error,
  }).pipe(Effect.tapError((error) => Effect.logWarning("fork update check failed", { error: String(error) })))

  const stageUpdate = () =>
    Effect.tryPromise({
      try: async (signal) => {
        const release = pending.release

        if (!release) throw new Error("No fork update to download")
        // The swap replaces the bundle in place, so its folder must be writable by this user.
        await access(path.dirname(bundle), constants.W_OK)
        const directory = path.join(staging, release.version)
        // Electron's fs reads app.asar as a directory, so it cannot remove a staged app; rm can.
        await execFileAsync("/bin/rm", ["-rf", staging])
        await mkdir(directory, { recursive: true })

        const sums = await fetch(release.checksums, { headers, signal })

        if (!sums.ok) throw new Error(`Fork checksum download failed with HTTP ${sums.status}`)
        const expected = checksumFor(await sums.text(), release.name)

        if (!expected) throw new Error(`SHA256SUMS does not list ${release.name}`)

        const archive = path.join(directory, release.name)
        const response = await fetch(release.archive, { headers, signal })

        if (!response.ok || !response.body) throw new Error(`Fork update download failed with HTTP ${response.status}`)
        const hash = createHash("sha256")
        const file = createWriteStream(archive)

        for await (const chunk of response.body) {
          hash.update(chunk)

          if (!file.write(chunk)) await once(file, "drain")
        }

        file.end()
        await once(file, "close")

        if (hash.digest("hex") !== expected) throw new Error(`${release.name} does not match SHA256SUMS`)

        await execFileAsync("/usr/bin/ditto", ["-x", "-k", archive, directory])
        await rm(archive)
        const next = path.join(directory, path.basename(bundle))
        await execFileAsync("/usr/bin/codesign", ["--verify", "--deep", "--strict", next])
        const plist = path.join(next, "Contents", "Info.plist")
        const version = await execFileAsync("/usr/bin/plutil", ["-extract", "CFBundleShortVersionString", "raw", plist])

        if (version.stdout.trim() !== release.version)
          throw new Error(`Downloaded app is ${version.stdout.trim()}, expected ${release.version}`)

        pending.app = next
        runFork(Effect.logInfo("fork update staged", { version: release.version, path: next }))
      },
      catch: (error) => error,
    }).pipe(Effect.tapError((error) => Effect.logWarning("fork update download failed", { error: String(error) })))

  const installAndRestart = Effect.callback<void, Error>((resume) => {
    const next = pending.app

    if (!next) return resume(Effect.fail(new Error("No fork update is staged")))
    const started = () => resume(Effect.void)
    app.once("before-quit", started)
    spawn("/bin/sh", ["-c", swapScript, "opencode-update", String(process.pid), next, bundle], {
      detached: true,
      stdio: "ignore",
    }).unref()
    app.quit()

    return Effect.sync(() => app.removeListener("before-quit", started))
  }).pipe(
    Effect.timeoutOrElse({
      duration: restartTimeout,
      orElse: () =>
        Effect.logError("fork update restart did not start").pipe(
          Effect.andThen(Effect.fail(new Error("Update restart did not start"))),
        ),
    }),
  )

  return { checkForUpdate, stageUpdate, installAndRestart } satisfies Platform
})
