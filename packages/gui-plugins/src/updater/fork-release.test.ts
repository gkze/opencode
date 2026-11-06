import { expect, test } from "bun:test"
import { checksumFor, compareVersions, latestForkRelease } from "./fork-release"

const asset = (name: string) => ({ name, browser_download_url: `https://example.test/${name}` })

const release = (tag: string, input: { draft?: boolean; assets?: string[] } = {}) => ({
  tag_name: tag,
  draft: input.draft ?? false,
  assets: (input.assets ?? ["opencode-desktop-mac-arm64.zip", "opencode-desktop-mac-x64.zip", "SHA256SUMS"]).map(asset),
})

const current = "2.2.5-gkze.nightly.20261105.45"

test("orders fork nightlies by date, then build", () => {
  expect(compareVersions("2.2.5-gkze.nightly.20261106.47", current)).toBeGreaterThan(0)
  expect(compareVersions("2.2.5-gkze.nightly.20261105.46", current)).toBeGreaterThan(0)
  expect(compareVersions("2.2.5-gkze.nightly.20261105.9", current)).toBeLessThan(0)
  expect(compareVersions(current, current)).toBe(0)
  // A rerun attempt adds an identifier, which ranks above the first attempt.
  expect(compareVersions(`${current}.2`, current)).toBeGreaterThan(0)
  expect(compareVersions("2.3.0-gkze.nightly.20261101.1", current)).toBeGreaterThan(0)
})

test("follows Semantic Versioning precedence for releases and prerelease identifiers", () => {
  expect(compareVersions("2.2.5", "2.2.5-gkze.12")).toBeGreaterThan(0)
  // Numeric identifiers rank below alphanumeric ones, so a nightly ranks above a numbered fork build.
  expect(compareVersions("2.2.5-gkze.nightly.20261101.1", "2.2.5-gkze.12")).toBeGreaterThan(0)
  expect(compareVersions("2.2.5-gkze.12", "2.2.5-gkze.9")).toBeGreaterThan(0)
  expect(compareVersions("2.2.10", "2.2.9+build.5")).toBeGreaterThan(0)
})

test("picks the newest fork release that ships this architecture's archive", () => {
  const latest = latestForkRelease(
    [
      release("fork-v2.2.5-gkze.nightly.20261105.45"),
      release("fork-v2.2.5-gkze.nightly.20261106.47"),
      release("fork-v2.2.5-gkze.nightly.20261106.46"),
      release("fork-v2.2.5-gkze.nightly.20261104.42"),
    ],
    { currentVersion: current, arch: "arm64" },
  )

  expect(latest).toEqual({
    version: "2.2.5-gkze.nightly.20261106.47",
    name: "opencode-desktop-mac-arm64.zip",
    archive: "https://example.test/opencode-desktop-mac-arm64.zip",
    checksums: "https://example.test/SHA256SUMS",
  })
})

test("ignores drafts, upstream tags, releases without checksums or archives, and older builds", () => {
  const latest = latestForkRelease(
    [
      release("fork-v2.2.5-gkze.nightly.20261108.50", { draft: true }),
      release("v2.3.0"),
      release("fork-v2.2.5-gkze.nightly.20261107.49", { assets: ["opencode-desktop-mac-arm64.zip"] }),
      release("fork-v2.2.5-gkze.nightly.20261107.48", { assets: ["opencode-desktop-mac-x64.zip", "SHA256SUMS"] }),
      release("fork-v2.2.5-gkze.nightly.20261104.42"),
      release(`fork-v${current}`),
    ],
    { currentVersion: current, arch: "arm64" },
  )

  expect(latest).toBeUndefined()
})

test("reads an archive's digest from SHA256SUMS in text or binary mode", () => {
  const sums = [
    "AAAA  opencode-desktop-mac-x64.zip",
    "bbbb *opencode-desktop-mac-arm64.zip",
    "cccc  opencode-desktop-mac-arm64.zip.blockmap",
    "",
  ].join("\n")

  expect(checksumFor(sums, "opencode-desktop-mac-arm64.zip")).toBe("bbbb")
  expect(checksumFor(sums, "opencode-desktop-mac-x64.zip")).toBe("aaaa")
  expect(checksumFor(sums, "opencode-desktop-mac-universal.zip")).toBeUndefined()
})
