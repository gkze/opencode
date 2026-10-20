import { expect, test } from "bun:test"
import { execFileSync, spawnSync } from "node:child_process"
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs"
import os from "node:os"
import path from "node:path"

const script = path.resolve(import.meta.dir, "../../../script/fork/nightly.mjs")

function fixture() {
  const root = mkdtempSync(path.join(os.tmpdir(), "fork-nightly-"))
  const repo = path.join(root, "repo")
  const remote = path.join(root, "remote.git")
  mkdirSync(repo)
  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd: repo, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim()
  git("init", "--bare", remote)
  git("init", "-b", "dev")
  git("config", "user.email", "test@example.invalid")
  git("config", "user.name", "Test")
  git("config", "commit.gpgsign", "false")
  git("config", `url.${remote}.insteadOf`, "https://github.com/anomalyco/opencode.git")
  git("remote", "add", "origin", remote)
  writeFileSync(path.join(repo, "upstream"), "base")
  git("add", ".")
  git("commit", "-m", "base")
  git("checkout", "-b", "gkze/patches")
  writeFileSync(path.join(repo, "custom"), "feature")
  git("add", ".")
  git("commit", "-m", "custom")
  const old = git("rev-parse", "HEAD")
  git("checkout", "dev")
  writeFileSync(path.join(repo, "upstream"), "new upstream")
  git("commit", "-am", "upstream update")
  const upstream = git("rev-parse", "HEAD")
  git("push", "origin", "dev", "gkze/patches")
  git("checkout", "-b", "nightly-candidate")
  git("cherry-pick", old)
  const candidate = git("rev-parse", "HEAD")
  const data = path.join(root, "data")
  mkdirSync(data)
  writeFileSync(path.join(data, "input.json"), JSON.stringify({ old, upstream, commits: [old] }))
  const report = {
    summary: "Refresh",
    tests: ["fixture behavior checked"],
    patches: [{ old, action: "keep", commits: [candidate], reason: "custom feature absent upstream" }],
  }
  writeFileSync(path.join(data, "report.json"), JSON.stringify(report))
  git("bundle", "create", path.join(data, "candidate.bundle"), "refs/heads/nightly-candidate")
  const run = (command: string) =>
    spawnSync(process.execPath, [script, command, data], {
      cwd: repo,
      encoding: "utf8",
      env: {
        ...process.env,
        SOURCE_SHA: old,
        GITHUB_RUN_ID: "123",
        GITHUB_OUTPUT: path.join(root, "output"),
        FORK_OLD: old,
        FORK_CANDIDATE: candidate,
        FORK_UPSTREAM: upstream,
      },
    })
  return { root, repo, data, git, run, old, candidate, report }
}

test("nightly preserves history, archives old tip, promotes and retries without rewriting", () => {
  const f = fixture()
  try {
    expect(f.run("accept").status).toBe(0)
    expect(f.run("promote").status).toBe(0)
    expect(f.git("ls-remote", "origin", "refs/heads/gkze/patches")).toStartWith(f.candidate)
    expect(f.git("ls-remote", "origin", `refs/tags/fork-backup-${f.old}`)).toStartWith(f.old)
    expect(f.run("promote").status).toBe(0)
  } finally {
    rmSync(f.root, { recursive: true, force: true })
  }
})

test("nightly refuses to overwrite concurrent fork work", () => {
  const f = fixture()
  try {
    expect(f.run("accept").status).toBe(0)
    f.git("checkout", "gkze/patches")
    f.git("commit", "--allow-empty", "-m", "concurrent work")
    f.git("push", "origin", "gkze/patches")
    expect(f.run("promote").status).not.toBe(0)
    expect(f.git("ls-remote", "origin", "refs/heads/gkze/patches")).toStartWith(f.git("rev-parse", "HEAD"))
  } finally {
    rmSync(f.root, { recursive: true, force: true })
  }
})

test("nightly rejects an incomplete patch review", () => {
  const f = fixture()
  try {
    writeFileSync(path.join(f.data, "report.json"), JSON.stringify({ ...f.report, patches: [] }))
    expect(f.run("accept").status).not.toBe(0)
    expect(f.git("ls-remote", "origin", "refs/heads/gkze/patches")).toStartWith(f.old)
  } finally {
    rmSync(f.root, { recursive: true, force: true })
  }
})

test("nightly refuses changed publication controls", () => {
  const f = fixture()
  try {
    mkdirSync(path.join(f.repo, ".github/workflows"), { recursive: true })
    writeFileSync(path.join(f.repo, ".github/workflows/unlisted.yml"), "changed")
    f.git("add", ".")
    f.git("commit", "-m", "change publisher")
    rmSync(path.join(f.data, "candidate.bundle"))
    f.git("bundle", "create", path.join(f.data, "candidate.bundle"), "refs/heads/nightly-candidate")
    expect(f.run("accept").status).not.toBe(0)
  } finally {
    rmSync(f.root, { recursive: true, force: true })
  }
})

test("replay applies the captured stack and refuses a dirty checkout", () => {
  const f = fixture()
  try {
    f.git("checkout", "gkze/patches")
    f.git("branch", "-D", "nightly-candidate")
    writeFileSync(path.join(f.repo, "untracked"), "preserve this")
    expect(f.run("replay").stderr).toContain("Replay requires a clean checkout")
    expect(readFileSync(path.join(f.repo, "untracked"), "utf8")).toBe("preserve this")
    rmSync(path.join(f.repo, "untracked"))
    const result = f.run("replay")
    expect(result.stderr).not.toContain("fatal:")
    expect(result.status).toBe(0)
    expect(f.git("show", "HEAD:custom")).toBe("feature")
    expect(f.git("show", "HEAD:upstream")).toBe("new upstream")
    expect(f.git("rev-parse", "HEAD^")).toBe(f.git("rev-parse", "dev"))
    expect(JSON.parse(readFileSync(path.join(f.data, "replay.json"), "utf8"))).toEqual({
      patches: [{ old: f.old, commit: f.git("rev-parse", "HEAD") }],
      pending: [],
      conflicts: [],
    })
  } finally {
    rmSync(f.root, { recursive: true, force: true })
  }
})

test("replay preserves redundant commits without claiming semantic review", () => {
  const f = fixture()
  try {
    f.git("checkout", "dev")
    writeFileSync(path.join(f.repo, "custom"), "feature")
    f.git("add", ".")
    f.git("commit", "-m", "upstream now has feature")
    const upstream = f.git("rev-parse", "HEAD")
    writeFileSync(path.join(f.data, "input.json"), JSON.stringify({ old: f.old, upstream, commits: [f.old] }))
    rmSync(path.join(f.data, "report.json"))
    f.git("checkout", "gkze/patches")
    f.git("branch", "-D", "nightly-candidate")
    const result = f.run("replay")
    expect(result.stderr).not.toContain("fatal:")
    expect(result.status).toBe(0)
    const candidate = f.git("rev-parse", "HEAD")
    expect(f.git("rev-parse", "HEAD^")).toBe(upstream)
    expect(f.git("diff", upstream, candidate)).toBe("")
    expect(JSON.parse(readFileSync(path.join(f.data, "replay.json"), "utf8"))).toEqual({
      patches: [{ old: f.old, commit: candidate }],
      pending: [],
      conflicts: [],
    })
    expect(() => readFileSync(path.join(f.data, "report.json"))).toThrow()
  } finally {
    rmSync(f.root, { recursive: true, force: true })
  }
})

test.each(["custom", ".github/workflows/publish.yml"])(
  "replay handles conflict in %s without changing the fork tip",
  (file) => {
    const f = fixture()
    try {
      f.git("checkout", "gkze/patches")
      mkdirSync(path.dirname(path.join(f.repo, file)), { recursive: true })
      writeFileSync(path.join(f.repo, file), "fork change")
      f.git("add", ".")
      f.git("commit", "--amend", "--no-edit")
      const old = f.git("rev-parse", "HEAD")
      f.git("checkout", "dev")
      mkdirSync(path.dirname(path.join(f.repo, file)), { recursive: true })
      writeFileSync(path.join(f.repo, file), "upstream change")
      f.git("add", ".")
      f.git("commit", "-m", "upstream conflict")
      const upstream = f.git("rev-parse", "HEAD")
      writeFileSync(path.join(f.data, "input.json"), JSON.stringify({ old, upstream, commits: [old] }))
      f.git("checkout", "gkze/patches")
      f.git("branch", "-D", "nightly-candidate")
      const result = f.run("replay")
      expect(f.git("rev-parse", "gkze/patches")).toBe(old)
      expect(f.git("rev-parse", "HEAD")).toBe(upstream)
      expect(f.git("status", "--porcelain")).toBe("")
      if (file.startsWith(".github/")) {
        expect(result.stderr).toContain("Publication control conflict")
        expect(result.status).not.toBe(0)
        return
      }
      expect(result.status).toBe(0)
      expect(JSON.parse(readFileSync(path.join(f.data, "replay.json"), "utf8"))).toEqual({
        patches: [],
        pending: [old],
        conflicts: [file],
      })
    } finally {
      rmSync(f.root, { recursive: true, force: true })
    }
  },
)
