# Fork releases

`fork-release.yml` uses standard GitHub-hosted runners in this public repository:
Ubuntu 24.04 for all CLI targets and packaging, macOS 15 ARM64 and Intel for desktop.
It reuses the production CLI builder, embedded web UI, desktop preparation, and npm
postinstall code. Fork publication is separate from upstream's npm/Cloudflare pipeline.

## Build and publish

Manual runs on branches build and validate downloadable Actions artifacts without
publishing, once the workflow is present on the default branch.
Push a tag `fork-vX.Y.Z-gkze.N` on the exact tested fork commit to publish a prerelease;
for example `fork-v2.0.27-gkze.3`, titled `OpenCode Dev 2.0.27 · Build 3`. Tags and npm versions must be new. Do not move a
published tag. The workflow publishes all native npm packages before the launcher,
verifies an npm installation on Linux, then publishes the GitHub release.

The built-in `GITHUB_TOKEN` uses `contents: write` and `packages: write` only
in the jobs that need them. Tagged releases need no PAT, upstream credentials,
Apple credentials, or paid runner. GitHub Packages access/visibility must be checked after the first
publication; an existing package must grant this repository Actions access.

Each release contains CLI archives, macOS DMG/ZIP packages, and SHA256SUMS. npm
packages are `@gkze/opencode` and `@gkze/opencode-<platform>-<arch>[-baseline][-musl]`
at `https://npm.pkg.github.com`, under the `fork` dist-tag. Each tarball is checked
against GitHub's 256 MiB limit.

## Install

GitHub's npm registry requires authentication even for public packages. Configure
`@gkze:registry=https://npm.pkg.github.com` in your npm configuration, authenticate
with `npm login --scope=@gkze --registry=https://npm.pkg.github.com --auth-type=legacy`
using a classic token with `read:packages`, then run:

```sh
bun add --global --trust @gkze/opencode@fork
```

Use protected credential storage; do not commit tokens in `.npmrc`. GitHub Release
archives are available without npm authentication. Extract the matching platform
archive and install its `opencode` executable on PATH. The npm command is also
`opencode`, so it replaces that command if an upstream global installation exists.

## Desktop signing and update behavior

Desktop artifacts use an ad-hoc signature, not Developer ID or Apple notarization.
The fork entitlement allows native library loading without a Developer ID Team ID.
macOS may require explicit approval in Privacy & Security for downloaded builds.
The app is named OpenCode Dev with identity `io.github.gkze.opencode`; its desktop
preferences are separate, and it does not register as the upstream URL handler.

The bundled CLI is built from the same commit and version. Both CLI and desktop
use the existing `dev` runtime channel, retaining its existing server/session storage
semantics; desktop identity isolation does not isolate the shared background server.
Upstream CLI update lookup/install and desktop updates are disabled. Update through
GitHub releases or npm. Never enable upstream updates on these packages.

Trusted macOS distribution later requires a paid Apple Developer Program membership,
a Developer ID Application certificate/private key, and notarization credentials.
Those would be repository secrets; GitHub's token cannot replace Apple credentials.

## Verification and recovery

Run `bun test test/fork-package.test.ts` from `packages/cli`, the affected package
typechecks, and `bun run check` from the repository root. CI builds all binaries,
checks native Linux CLI startup, verifies both macOS app signatures, Electron runtime
startup, and bundled CLI versions, and verifies an npm install before announcing the release.

npm publication and GitHub Releases are separate services, not one transaction.
If publication fails midway, rerun only the failed jobs to reuse the same artifacts.
The publisher skips existing versions only when their registry integrity matches
the local tarball exactly; mismatches fail. Do not rebuild and replace already-published
binaries under the same version. Build-only runs
are the first validation boundary; installed desktop UI and Gatekeeper behavior
must still be tested on a downloaded package.

## Nightly maintenance

The maintained branch is `gkze/patches`. Upstream V2 development now lives on
`anomalyco/opencode:dev`; the old `v2` branch is no longer the refresh target.
`fork-nightly.md` is the GitHub Agentic Workflow source; compile it with
`gh aw compile fork-nightly` (currently gh-aw v0.89.21) and commit the generated
lockfile and action lock. Its cron runs daily at 10:37 UTC; edit the schedule and
recompile to change frequency. It also supports manual dispatch.

Configure the repository Actions secret `COPILOT_GITHUB_TOKEN` with a token
entitled to Copilot inference. Inference is billed separately from public runners.
Also configure `FORK_PUSH_TOKEN` with a fine-grained token limited to this repository,
with Contents and Workflows read/write permissions. Upstream updates can include
workflow files, which the built-in token cannot push. Only the trusted candidate
and promotion steps receive this token; Copilot does not. Release tag creation and
npm publication still use the built-in token.
The agent has read-only repository credentials and exports a Git bundle and a
per-commit keep/adapt/drop report. A separate workflow consumes artifacts only from
successful scheduled/manual runs on this fork's maintained branch. It verifies
captured ancestry, complete patch provenance, a linear candidate stack, and no agent-authored changes to
publication controls before pushing a temporary `nightly-<run-id>` candidate branch.

The existing release workflow checks the candidate, builds all CLI targets and both
macOS applications, publishes and installs npm with read-only verification credentials, then atomically saves the old tip under `fork-backup-<sha>` and
replaces `gkze/patches` with an exact lease. Concurrent changes stop promotion.
The snapshot of upstream at run start is authoritative; newly arriving upstream
commits are picked up on the next run. Unresolvable changes fail rather than silently
removing customization. Upstream-only workflow/control changes carry through unchanged; conflicting fork
control changes require a normal maintenance edit. The agent cannot author new
publication controls.

Nightlies use SemVer prereleases `X.Y.Z-gkze.nightly.YYYYMMDD.N` and npm's
`nightly` dist-tag (`bun add --global --trust @gkze/opencode@nightly`). Regular fork
releases retain `X.Y.Z-gkze.N` and the `fork` dist-tag. Build metadata alone is not
used as a release identity because SemVer ignores it for version precedence.
The nightly date is UTC and N is the publishing workflow run number. Rebuilt attempts
append `.ATTEMPT` to avoid replacing published versions. Titles use
`OpenCode Dev X.Y.Z · Nightly YYYY-MM-DD · Build N`. Run IDs and source commits
belong in release notes. Nightly and manual versions are separate channels, not a
single version ordering; select updates through the corresponding dist-tag.
The older run-ID nightly format is retained only in historical tags/packages.
The GitHub release includes the reconciliation report as an asset.
The consumer npm dist-tag advances only after registry verification, successful
promotion, and GitHub release publication. Incomplete versions use the `candidate`
tag until then. Privileged publisher code uses only Node standard-library modules
and runs outside the candidate working directory.
Archive tags and temporary candidate branches are retained for recovery; no automatic
deletion policy is configured.

A failed review, check, or build does not promote the branch. Publication can fail
before or after promotion because Git, npm, and GitHub Releases are separate services; retry failed jobs using
the same artifacts. A later fork update blocks an older run from promoting again.
A local checkout is not reset by this remote automation: fetch and reconcile local
work before publishing further changes after a nightly force-push.
