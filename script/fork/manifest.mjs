// actions/download-artifact can end a download early and still succeed (actions/download-artifact#454; Build 47
// lost five release assets this way). Each producing job records what it uploads as a job output, and each
// consuming job checks that exactly those files arrived intact before using them.
//
//   manifest.mjs write <root> <path...>   print SHA-256 lines for the files under each path, relative to root
//   manifest.mjs digest <root> <path...>  print the SHA-256 of that manifest, and the manifest itself to stderr
//   manifest.mjs check <root>             read manifest lines from stdin; require exactly those files under root
//   manifest.mjs check <root> <digest>    require the files under root to produce a manifest with this digest
//
// GitHub limits a job's outputs to 1 MiB in total, which the CLI's manifests exceed, so those jobs pass a digest.
import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { createReadStream, readFileSync, readdirSync, statSync } from "node:fs"
import path from "node:path"
import { pipeline } from "node:stream/promises"

const [command, root, ...paths] = process.argv.slice(2)

if (command === "write" || command === "digest") {
  assert.ok(root && paths.length, `Usage: manifest.mjs ${command} <root> <path...>`)
  // upload-artifact leaves hidden files out of the artifact by default, so they are not recorded either.
  const files = [...new Set(paths.flatMap((item) => (statSync(item).isDirectory() ? walk(item) : [item])))].filter(
    (file) => !relative(file).split("/").some((part) => part.startsWith(".")),
  )
  const text = await manifest(files)
  if (command === "write") process.stdout.write(text)
  if (command === "digest") {
    process.stderr.write(text)
    console.log(createHash("sha256").update(text).digest("hex"))
  }
} else if (command === "check" && paths.length === 1) {
  assert.ok(root && /^[0-9a-f]{64}$/.test(paths[0]), "Usage: manifest.mjs check <root> <digest>")
  const text = await manifest(walk(root))
  const count = text.split("\n").filter(Boolean).length
  if (createHash("sha256").update(text).digest("hex") !== paths[0]) {
    // Compare with the manifest the producing job printed to find the missing or damaged files.
    process.stderr.write(text)
    assert.fail(`The ${count} files under ${root} differ from the recorded manifest`)
  }
  console.log(`Verified ${count} files under ${root}`)
} else if (command === "check") {
  assert.ok(root && !paths.length, "Usage: manifest.mjs check <root> [digest]")
  const expected = readFileSync(0, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const match = /^([0-9a-f]{64}) {2}(\S.*)$/.exec(line)
      assert.ok(match, `Malformed manifest line: ${line}`)
      return { hash: match[1], name: match[2] }
    })
  assert.ok(expected.length, "Empty manifest")
  const names = expected.map((entry) => entry.name).sort()
  assert.deepEqual(walk(root).map(relative).sort(), names, `Files under ${root} differ from the manifest`)
  for (const entry of expected)
    assert.equal(await sha256(path.join(root, entry.name)), entry.hash, `Corrupt artifact file: ${entry.name}`)
  console.log(`Verified ${expected.length} files under ${root}`)
} else {
  throw new Error("Usage: manifest.mjs write|digest <root> <path...> | check <root> [digest]")
}

async function manifest(files) {
  assert.ok(files.length, "No files to record")
  const lines = await Promise.all(files.map(async (file) => `${await sha256(file)}  ${relative(file)}`))
  return lines.sort().join("\n") + "\n"
}

function walk(directory) {
  return readdirSync(directory, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(entry.parentPath, entry.name))
}

function relative(file) {
  const name = path.relative(root, file).split(path.sep).join("/")
  assert.ok(name && !name.startsWith(".."), `${file} is outside ${root}`)
  return name
}

async function sha256(file) {
  const hash = createHash("sha256")
  await pipeline(createReadStream(file), hash)
  return hash.digest("hex")
}
