import { expect, test } from "bun:test"
import { $ } from "bun"
import { mkdtemp, mkdir, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { packageRelease } from "../../../script/fork/package"

test("fork npm artifacts install the bundled binary using the production installer", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "fork-package-"))
  const target = `${process.platform}-${process.arch}`
  const version = "2.0.26-gkze.1"
  try {
    const directory = path.join(root, "dist", `cli-${target}`)
    await mkdir(path.join(directory, "bin"), { recursive: true })
    await Bun.write(path.join(directory, "bin", "opencode"), `#!/bin/sh\necho ${version}\n`)
    await Bun.write(
      path.join(directory, "package.json"),
      JSON.stringify({
        name: `@opencode/cli-${target}`,
        version,
        os: [process.platform],
        cpu: [process.arch],
      }),
    )
    await packageRelease(path.join(root, "dist"), path.join(root, "release"))
    const npm = path.join(root, "release", "npm")
    const install = path.join(root, "install")
    await $`npm install --offline --no-audit --no-fund --prefix ${install} ${path.join(npm, `gkze-opencode-${target}-${version}.tgz`)} ${path.join(npm, `gkze-opencode-${version}.tgz`)}`.quiet()
    expect((await $`${path.join(install, "node_modules", ".bin", "opencode")} --version`.text()).trim()).toBe(version)
    const manifest = await Bun.file(path.join(install, "node_modules", "@gkze", "opencode", "package.json")).json()
    expect(manifest.optionalDependencies).toEqual({ [`@gkze/opencode-${target}`]: version })
    expect(manifest.publishConfig.registry).toBe("https://npm.pkg.github.com")
    expect(manifest.repository.url).toBe("git+https://github.com/gkze/opencode.git")
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test("empty CLI distributions cannot be packaged", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "fork-package-"))
  try {
    await expect(packageRelease(root, path.join(root, "release"))).rejects.toThrow("No CLI artifacts")
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
