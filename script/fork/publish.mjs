import assert from "node:assert/strict"
import { execFileSync, spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import { readFileSync, readdirSync } from "node:fs"
import path from "node:path"

const directory = process.argv[2]
assert.ok(directory, "Usage: publish.mjs <npm-tarballs>")
const registry = "https://npm.pkg.github.com"
const files = readdirSync(directory)
  .filter((file) => file.endsWith(".tgz"))
  .sort()
const launcher = files.filter((file) => /^gkze-opencode-\d/.test(file))
assert.equal(launcher.length, 1, "Expected one launcher package")

// Publish exact versions first. Only the final release job advances the consumer dist-tag.
for (const file of [...files.filter((file) => !launcher.includes(file)), ...launcher]) {
  const tarball = path.join(directory, file)
  const manifest = JSON.parse(execFileSync("tar", ["-xOf", tarball, "package/package.json"], { encoding: "utf8" }))
  assert.match(manifest.name, /^@gkze\/opencode(?:-(?:darwin|linux|windows)-(?:arm64|x64)(?:-baseline)?(?:-musl)?)?$/)
  assert.equal(manifest.version, process.env.VERSION, "Unexpected package version")
  const target = `${manifest.name}@${manifest.version}`
  const existing = spawnSync("npm", ["view", target, "dist.integrity", "--json", "--registry", registry], {
    encoding: "utf8",
  })
  if (existing.status === 0) {
    const integrity = `sha512-${createHash("sha512").update(readFileSync(tarball)).digest("base64")}`
    assert.equal(JSON.parse(existing.stdout), integrity, `Published tarball differs: ${target}`)
    console.log(`Already published identical artifact: ${target}`)
    continue
  }
  assert.equal(JSON.parse(existing.stdout).error?.code, "E404", `Cannot inspect package: ${target}`)
  execFileSync(
    "npm",
    ["publish", tarball, "--registry", registry, "--tag", "candidate", "--access", "public", "--ignore-scripts"],
    { stdio: "inherit" },
  )
}
