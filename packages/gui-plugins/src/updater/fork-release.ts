import { Schema } from "effect"

/** The GitHub repository that publishes fork desktop releases. */
export const FORK_REPOSITORY = "gkze/opencode"

/** The fields of GitHub's release list this updater reads. */
export const GitHubReleases = Schema.Array(
  Schema.Struct({
    tag_name: Schema.String,
    draft: Schema.Boolean,
    assets: Schema.Array(Schema.Struct({ name: Schema.String, browser_download_url: Schema.String })),
  }),
)

export type ForkRelease = {
  readonly version: string
  /** The archive's asset name, as `SHA256SUMS` lists it. */
  readonly name: string
  readonly archive: string
  readonly checksums: string
}

const versionPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/

/**
 * The newest published fork release newer than `currentVersion` that ships a desktop archive for `arch`. Nightly
 * releases are GitHub prereleases, so prereleases count.
 */
export function latestForkRelease(
  releases: typeof GitHubReleases.Type,
  input: { readonly currentVersion: string; readonly arch: string },
): ForkRelease | undefined {
  const name = `opencode-desktop-mac-${input.arch}.zip`

  return releases
    .flatMap((release) => {
      const version = release.tag_name.replace(/^fork-v/, "")
      const archive = release.assets.find((asset) => asset.name === name)
      const checksums = release.assets.find((asset) => asset.name === "SHA256SUMS")

      if (release.draft || !release.tag_name.startsWith("fork-v") || !versionPattern.test(version)) return []

      if (!archive || !checksums) return []

      return [{ version, name, archive: archive.browser_download_url, checksums: checksums.browser_download_url }]
    })
    .filter((release) => compareVersions(release.version, input.currentVersion) > 0)
    .toSorted((left, right) => compareVersions(right.version, left.version))[0]
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
