import { $ } from "bun"
import { createHash } from "node:crypto"
import path from "node:path"

const directory = process.argv[2]
if (!directory) throw new Error("Usage: publish.ts <npm-tarballs>")
const registry = "https://npm.pkg.github.com"
const files = (await Array.fromAsync(new Bun.Glob("*.tgz").scan({ cwd: directory, absolute: true }))).sort()
if (!files.length) throw new Error("No npm tarballs found")
// Native optional dependencies must exist before anyone can install the launcher.
const launcher = files.filter((file) => /^gkze-opencode-\d/.test(path.basename(file)))
if (launcher.length !== 1) throw new Error("Expected one launcher package")

for (const file of [...files.filter((file) => !launcher.includes(file)), ...launcher]) {
  const manifest = await $`tar -xOf ${file} package/package.json`.json()
  const target = `${manifest.name}@${manifest.version}`
  const existing = await $`npm view ${target} dist.integrity --json --registry ${registry}`.nothrow().quiet()
  if (existing.exitCode === 0) {
    const integrity = `sha512-${createHash("sha512")
      .update(await Bun.file(file).arrayBuffer())
      .digest("base64")}`
    if (JSON.parse(existing.text()) !== integrity) throw new Error(`Published tarball differs: ${target}`)
    console.log(`Already published identical artifact: ${target}`)
    continue
  }
  const error = JSON.parse(existing.text())
  if (error.error?.code !== "E404") throw new Error(`Cannot inspect package before publishing: ${target}`)
  await $`npm publish ${file} --registry ${registry} --tag fork --access public`
}
