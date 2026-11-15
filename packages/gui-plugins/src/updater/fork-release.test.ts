import { expect, test } from "bun:test"
import { checksumFor, compareVersions, forkReleaseCandidates, forkReleaseTags } from "./fork-release"

// The shape of https://github.com/gkze/opencode/releases.atom: feed-level links, then one entry per published release.
const entry = (tag: string, notes = "") => `  <entry>
    <id>tag:github.com,2008:Repository/1168053940/${tag}</id>
    <link rel="alternate" type="text/html" href="https://github.com/gkze/opencode/releases/tag/${tag}"/>
    <title>${tag}</title>
    <content type="html">${notes}</content>
  </entry>`

const feed = (...entries: string[]) => `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="en-US">
  <link type="text/html" rel="alternate" href="https://github.com/gkze/opencode/releases"/>
  <link type="application/atom+xml" rel="self" href="https://github.com/gkze/opencode/releases.atom"/>
${entries.join("\n")}
</feed>`

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

test("reads release tags from the feed's entry links only", () => {
  const tags = forkReleaseTags(
    feed(
      entry("fork-v2.3.0-gkze.nightly.20261114.57"),
      // Release notes are HTML-escaped in the feed, so a release link inside them is not an entry.
      entry(
        "fork-v2.3.0-gkze.nightly.20261113.56",
        "&lt;a href=&quot;https://github.com/gkze/opencode/releases/tag/fork-v9.9.9&quot;&gt;",
      ),
      entry("fork-backup-0313e02e56d48440491e58d2d7f0d8bf71b555a8"),
      entry("fork-v2.2.5%2Bbuild.1"),
    ),
  )

  expect(tags).toEqual([
    "fork-v2.3.0-gkze.nightly.20261114.57",
    "fork-v2.3.0-gkze.nightly.20261113.56",
    "fork-backup-0313e02e56d48440491e58d2d7f0d8bf71b555a8",
    "fork-v2.2.5+build.1",
  ])
})

test("lists newer fork releases newest first with this architecture's download URLs", () => {
  const candidates = forkReleaseCandidates(
    [
      "fork-v2.2.5-gkze.nightly.20261105.45",
      "fork-v2.2.5-gkze.nightly.20261106.46",
      "fork-v2.2.5-gkze.nightly.20261106.47",
      "fork-v2.2.5-gkze.nightly.20261104.42",
    ],
    { currentVersion: current, arch: "arm64" },
  )

  expect(candidates).toEqual([
    {
      version: "2.2.5-gkze.nightly.20261106.47",
      name: "opencode-desktop-mac-arm64.zip",
      archive:
        "https://github.com/gkze/opencode/releases/download/fork-v2.2.5-gkze.nightly.20261106.47/opencode-desktop-mac-arm64.zip",
      checksums: "https://github.com/gkze/opencode/releases/download/fork-v2.2.5-gkze.nightly.20261106.47/SHA256SUMS",
    },
    {
      version: "2.2.5-gkze.nightly.20261106.46",
      name: "opencode-desktop-mac-arm64.zip",
      archive:
        "https://github.com/gkze/opencode/releases/download/fork-v2.2.5-gkze.nightly.20261106.46/opencode-desktop-mac-arm64.zip",
      checksums: "https://github.com/gkze/opencode/releases/download/fork-v2.2.5-gkze.nightly.20261106.46/SHA256SUMS",
    },
  ])
})

test("ignores upstream, backup and malformed tags, the running build and older builds", () => {
  const candidates = forkReleaseCandidates(
    [
      "v2.3.0",
      "fork-backup-0313e02e56d48440491e58d2d7f0d8bf71b555a8",
      "fork-vnext",
      "fork-v2.2.5-gkze.nightly.20261104.42",
      `fork-v${current}`,
    ],
    { currentVersion: current, arch: "arm64" },
  )

  expect(candidates).toEqual([])
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
