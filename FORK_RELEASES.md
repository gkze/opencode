# Fork releases

`fork-release.yml` uses standard GitHub-hosted runners in this public repository:
Ubuntu 24.04 for all CLI targets and packaging, macOS 15 ARM64 and Intel for desktop.
It reuses the production CLI builder, embedded web UI, desktop preparation, and npm
postinstall code. Fork publication is separate from upstream's npm/Cloudflare pipeline.

## Build and publish

Pushes to `fork-releases` build and validate downloadable Actions artifacts without
publishing. The workflow can also run manually once present on the default branch.
Push a tag `fork-vX.Y.Z-gkze.N` on the exact tested fork commit to publish a prerelease;
for example `fork-v2.0.26-gkze.1`. Tags and npm versions must be new. Do not move a
published tag. The workflow publishes all native npm packages before the launcher,
verifies an npm installation on Linux, then publishes the GitHub release.

The job's built-in `GITHUB_TOKEN` uses `contents: write` and `packages: write` only
in the publication job. No PAT, upstream credentials, Apple credentials, or paid
runner is required. GitHub Packages access/visibility must be checked after the first
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
npm install --global @gkze/opencode@fork
```

Use protected credential storage; do not commit tokens in `.npmrc`. GitHub Release
archives are available without npm authentication. Extract the matching platform
archive and install its `opencode` executable on PATH. The npm command is also
`opencode`, so it replaces that command if an upstream global installation exists.

## Desktop signing and update behavior

Desktop artifacts use an ad-hoc signature, not Developer ID or Apple notarization.
The fork entitlement allows native library loading without a Developer ID Team ID.
macOS may require explicit approval in Privacy & Security for downloaded builds.
The app is named OpenCode Fork with identity `io.github.gkze.opencode`; its desktop
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
