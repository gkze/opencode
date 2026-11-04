import { $ } from "bun"
import { chmod, cp, mkdir } from "node:fs/promises"
import path from "node:path"

// Keep the production installer and native build layout; only publication identity changes.
export async function packageRelease(root: string, output: string) {
  const registry = "https://npm.pkg.github.com"
  const repository = { type: "git", url: "git+https://github.com/gkze/opencode.git" }
  const packages = (await Array.fromAsync(new Bun.Glob("cli-*/package.json").scan({ cwd: root }))).sort()
  if (!packages.length) throw new Error("No CLI artifacts found")
  const manifests = await Promise.all(packages.map((file) => Bun.file(path.join(root, file)).json()))
  const versions = new Set(manifests.map((manifest) => manifest.version))
  if (versions.size !== 1) throw new Error("CLI artifact versions do not match")
  const version = manifests[0].version
  const dependencies: Record<string, string> = {}
  await mkdir(path.join(output, "assets"), { recursive: true })
  await mkdir(path.join(output, "npm"), { recursive: true })

  for (const [index, file] of packages.entries()) {
    const target = path.dirname(file).slice("cli-".length)
    const name = `@gkze/opencode-${target}`
    const directory = path.join(output, "packages", `opencode-${target}`)
    await cp(path.join(root, path.dirname(file)), directory, { recursive: true })
    await Bun.write(
      path.join(directory, "package.json"),
      JSON.stringify(
        {
          ...manifests[index],
          name,
          repository,
          publishConfig: { registry },
          files: ["bin"],
        },
        null,
        2,
      ),
    )
    const binary = target.startsWith("windows-") ? "opencode.exe" : "opencode"
    await chmod(path.join(directory, "bin", binary), 0o755)
    const archive = path.join(output, "assets", `opencode-${target}.${target.startsWith("linux-") ? "tar.gz" : "zip"}`)
    if (target.startsWith("linux-")) await $`tar -czf ${archive} -C ${path.join(directory, "bin")} ${binary}`
    if (!target.startsWith("linux-")) await $`zip -j -q ${archive} ${path.join(directory, "bin", binary)}`
    await pack(directory)
    dependencies[name] = version
  }

  const directory = path.join(output, "packages", "opencode")
  await mkdir(path.join(directory, "bin"), { recursive: true })
  await cp(
    new URL("../../packages/cli/script/postinstall.mjs", import.meta.url),
    path.join(directory, "postinstall.mjs"),
  )
  await Bun.write(
    path.join(directory, "bin", "opencode.exe"),
    '#!/bin/sh\necho "Run npm rebuild @gkze/opencode to install the binary" >&2\nexit 1\n',
  )
  await chmod(path.join(directory, "bin", "opencode.exe"), 0o755)
  await Bun.write(
    path.join(directory, "package.json"),
    JSON.stringify(
      {
        name: "@gkze/opencode",
        version,
        license: "MIT",
        repository,
        publishConfig: { registry },
        bin: { opencode: "bin/opencode.exe" },
        scripts: { postinstall: "node postinstall.mjs" },
        files: ["bin", "postinstall.mjs"],
        optionalDependencies: dependencies,
      },
      null,
      2,
    ),
  )
  await pack(directory)

  async function pack(directory: string) {
    const result = await $`npm pack --json --pack-destination ${path.join(output, "npm")}`.cwd(directory).json()
    if (result[0].size >= 256 * 1024 * 1024) throw new Error(`GitHub Packages limit exceeded: ${result[0].filename}`)
  }
}

if (import.meta.main) {
  const root = process.argv[2]
  const output = process.argv[3]
  if (!root || !output) throw new Error("Usage: package.ts <cli-dist> <output>")
  await packageRelease(path.resolve(root), path.resolve(output))
}
