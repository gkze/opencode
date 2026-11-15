/** The GitHub repository that publishes fork desktop releases. */
export const FORK_REPOSITORY = "gkze/opencode"

/**
 * The repository's release feed. Unlike `api.github.com`, whose unauthenticated limit of 60 requests an hour is shared
 * by everything behind the same address and left checks failing with HTTP 403, the feed and release downloads are
 * ordinary github.com pages. It lists published releases only, prereleases included, newest first.
 */
export const FORK_RELEASE_FEED = `https://github.com/${FORK_REPOSITORY}/releases.atom`

export type ForkRelease = {
  readonly version: string
  /** The archive's asset name, as `SHA256SUMS` lists it. */
  readonly name: string
  readonly archive: string
  readonly checksums: string
}

const versionPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/
const tagLink = new RegExp(`href="https://github\\.com/${FORK_REPOSITORY}/releases/tag/([^"?#]+)"`, "g")

/** The release tags the feed links to. */
export function forkReleaseTags(feed: string) {
  return Array.from(feed.matchAll(tagLink), (match) => decodeURIComponent(match[1]))
}

/**
 * Fork releases newer than `currentVersion`, newest first, with the download URLs of `arch`'s desktop archive and the
 * release's `SHA256SUMS`. The feed does not list assets, so a candidate may lack the archive; its `SHA256SUMS` says
 * whether it ships one. Nightly releases are GitHub prereleases, so prereleases count.
 */
export function forkReleaseCandidates(
  tags: readonly string[],
  input: { readonly currentVersion: string; readonly arch: string },
): ForkRelease[] {
  const name = `opencode-desktop-mac-${input.arch}.zip`

  return tags
    .flatMap((tag) => {
      const version = tag.replace(/^fork-v/, "")

      if (!tag.startsWith("fork-v") || !versionPattern.test(version)) return []
      const base = `https://github.com/${FORK_REPOSITORY}/releases/download/${encodeURIComponent(tag)}`

      return [{ version, name, archive: `${base}/${name}`, checksums: `${base}/SHA256SUMS` }]
    })
    .filter((release) => compareVersions(release.version, input.currentVersion) > 0)
    .toSorted((left, right) => compareVersions(right.version, left.version))
}

/** The SHA-256 digest `SHA256SUMS` lists for `name`. */
export function checksumFor(sums: string, name: string) {
  return sums
    .split("\n")
    .map((line) => line.trim().split(/\s+\*?/))
    .find((fields) => fields.length === 2 && fields[1] === name)?.[0]
    ?.toLowerCase()
}

/** Semantic Versioning 2.0 precedence; build metadata is ignored. */
export function compareVersions(left: string, right: string) {
  const a = parseVersion(left)
  const b = parseVersion(right)
  const core = a.core.map((part, index) => part - b.core[index]).find((difference) => difference !== 0)

  if (core !== undefined) return core

  // A release ranks above any of its prereleases.
  if (!a.pre.length || !b.pre.length) return b.pre.length - a.pre.length

  const length = Math.max(a.pre.length, b.pre.length)
  const index = Array.from({ length }, (_, i) => i).find((i) => a.pre[i] !== b.pre[i])

  if (index === undefined) return 0

  return compareIdentifiers(a.pre[index], b.pre[index])
}

function parseVersion(version: string) {
  const [core, pre] = version.split("+")[0].split(/-(.*)/s)

  return { core: core.split(".").map(Number), pre: pre ? pre.split(".") : [] }
}

// A missing identifier ranks lower, numeric identifiers compare numerically and rank below alphanumeric ones.
function compareIdentifiers(left: string | undefined, right: string | undefined) {
  if (left === undefined) return -1

  if (right === undefined) return 1
  const leftNumeric = /^\d+$/.test(left)
  const rightNumeric = /^\d+$/.test(right)

  if (leftNumeric && rightNumeric) return Number(left) - Number(right)

  if (leftNumeric !== rightNumeric) return leftNumeric ? -1 : 1

  return left < right ? -1 : 1
}
