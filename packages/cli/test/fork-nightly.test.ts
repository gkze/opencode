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

test("prepare keeps the derived lockfile commit out of the replay workload", () => {
  const f = fixture()
  try {
    f.git("checkout", "gkze/patches")
    f.git("commit", "--allow-empty", "-m", "chore(deps): regenerate fork lockfile")
    f.git("push", "origin", "gkze/patches")
    expect(f.run("prepare").status).toBe(0)
    const input = JSON.parse(readFileSync(path.join(f.data, "input.json"), "utf8"))
    // package.json is the authority; a lockfile commit is regenerated by `relock`, so replaying
    // it would turn every upstream dependency bump into a conflict the agent must refuse.
    expect(input.commits).toEqual([f.old])
    expect(input.derived).toHaveLength(1)
    expect(input.old).toBe(f.git("rev-parse", "HEAD"))
  } finally {
    rmSync(f.root, { recursive: true, force: true })
  }
})

test("read-only review catches supplemental commits before export and shares acceptance rules", () => {
  const f = fixture()
  try {
    writeFileSync(path.join(f.repo, "supplemental-test-fix"), "new package path")
    f.git("add", ".")
    f.git("commit", "-m", "fix a test after replay")
    const supplemental = f.git("rev-parse", "HEAD")
    expect(f.run("verify").status).not.toBe(0)
    f.report.patches[0]!.commits.push(supplemental)
    writeFileSync(path.join(f.data, "report.json"), JSON.stringify(f.report))
    expect(f.run("verify").status).toBe(0)
    expect(f.git("ls-remote", "origin", "refs/heads/nightly-123")).toBe("")
    expect(f.git("ls-remote", "origin", "refs/heads/gkze/patches")).toStartWith(f.old)
    rmSync(path.join(f.data, "candidate.bundle"))
    f.git("bundle", "create", path.join(f.data, "candidate.bundle"), "refs/heads/nightly-candidate")
    expect(f.run("accept").status).toBe(0)
  } finally {
    rmSync(f.root, { recursive: true, force: true })
  }
})

test.each(["listed", "unlisted", "other-file", "outside-history"])(
  "accept validates %s generated-lockfile provenance",
  (scenario) => {
    const f = fixture()
    try {
      writeFileSync(path.join(f.repo, scenario === "other-file" ? "custom" : "bun.lock"), "derived")
      f.git("add", ".")
      f.git("commit", "-m", "chore(deps): regenerate fork lockfile")
      const derived = f.git("rev-parse", "HEAD")
      rmSync(path.join(f.data, "candidate.bundle"))
      f.git("bundle", "create", path.join(f.data, "candidate.bundle"), "refs/heads/nightly-candidate")
      const report = structuredClone(f.report)
      if (scenario !== "unlisted") report.patches[0]!.commits.push(scenario === "outside-history" ? f.old : derived)
      writeFileSync(path.join(f.data, "report.json"), JSON.stringify(report))
      const result = f.run("accept")
      expect(result.status === 0).toBe(scenario === "listed" || scenario === "unlisted")
      if (scenario === "outside-history") expect(result.stderr).toContain("outside candidate history")
      if (scenario === "other-file") expect(result.stderr).toContain("Derived commit may only update bun.lock")
    } finally {
      rmSync(f.root, { recursive: true, force: true })
    }
  },
)

// Serves a publication history the way the GitHub API does, and runs `feedback` against it. Without a `log`, job
// logs have expired.
async function feedback(runs: object[], jobs: object[] = [], log?: string) {
  const root = mkdtempSync(path.join(os.tmpdir(), "fork-feedback-"))
  const server = Bun.serve({
    port: 0,
    fetch(request) {
      if (request.headers.get("authorization") !== "Bearer test") return new Response("", { status: 401 })
      const route = new URL(request.url).pathname.replace("/repos/gkze/opencode/actions/", "")
      if (route === "workflows/fork-nightly-publish.yml/runs") return Response.json({ workflow_runs: runs })
      if (/^runs\/\d+\/jobs$/.test(route)) return Response.json({ jobs })
      if (/^jobs\/\d+\/logs$/.test(route)) return new Response(log, { status: log === undefined ? 410 : 200 })
      return new Response("", { status: 404 })
    },
  })
  const child = Bun.spawn([process.execPath, script, "feedback", root], {
    env: {
      ...process.env,
      GITHUB_API_URL: `http://localhost:${server.port}`,
      GITHUB_REPOSITORY: "gkze/opencode",
      GH_TOKEN: "test",
    },
    stderr: "inherit",
  })
  const status = await child.exited
  await server.stop(true)
  return { root, status, publish: () => JSON.parse(readFileSync(path.join(root, "publish.json"), "utf8")) }
}

test("feedback records a failed publication with the end of each failed job's log", async () => {
  const f = await feedback(
    [
      // The refresh after this publication failed, so its own publication never built anything.
      { id: 3, conclusion: "skipped", html_url: "https://example.invalid/3" },
      { id: 2, conclusion: "cancelled", html_url: "https://example.invalid/2" },
      { id: 1, conclusion: "success", html_url: "https://example.invalid/1" },
    ],
    [
      { id: 20, name: "release / cli", conclusion: "success", html_url: "https://example.invalid/2/job/20", steps: [] },
      {
        id: 21,
        name: "release / desktop",
        conclusion: "cancelled",
        html_url: "https://example.invalid/2/job/21",
        steps: [
          { name: "Set up job", conclusion: "success" },
          { name: "Run ./.github/actions/fork-desktop", conclusion: "cancelled" },
          { name: "Complete job", conclusion: "skipped" },
        ],
      },
    ],
    `${Array.from({ length: 250 }, (_, index) => `\x1b[36mline ${index + 1}\x1b[0m`).join("\n")}\n`,
  )
  try {
    expect(f.status).toBe(0)
    expect(f.publish()).toEqual({
      run: 2,
      url: "https://example.invalid/2",
      conclusion: "cancelled",
      jobs: [
        {
          name: "release / desktop",
          conclusion: "cancelled",
          url: "https://example.invalid/2/job/21",
          steps: ["Run ./.github/actions/fork-desktop"],
          log: "publish-21.log",
        },
      ],
    })
    const log = readFileSync(path.join(f.root, "publish-21.log"), "utf8").split("\n")
    expect([log.length, log[0], log[199], log[200]]).toEqual([201, "line 51", "line 250", ""])
  } finally {
    rmSync(f.root, { recursive: true, force: true })
  }
})

test.each([
  [
    [{ id: 1, conclusion: "success", html_url: "https://example.invalid/1" }],
    { run: 1, url: "https://example.invalid/1", conclusion: "success", jobs: [] },
  ],
  [[], { conclusion: "none", jobs: [] }],
])("feedback records a publication that needs no review: %j", async (runs, expected) => {
  const f = await feedback(runs)
  try {
    expect(f.status).toBe(0)
    expect(f.publish()).toEqual(expected)
  } finally {
    rmSync(f.root, { recursive: true, force: true })
  }
})

test("feedback still records a failed publication whose log has expired", async () => {
  const f = await feedback(
    [{ id: 2, conclusion: "failure", html_url: "https://example.invalid/2" }],
    [
      {
        id: 21,
        name: "release / publish",
        conclusion: "failure",
        html_url: "https://example.invalid/2/job/21",
        steps: [],
      },
    ],
  )
  try {
    expect(f.status).toBe(0)
    expect(f.publish().jobs).toEqual([
      {
        name: "release / publish",
        conclusion: "failure",
        url: "https://example.invalid/2/job/21",
        steps: [],
        log: "publish-21.log",
      },
    ])
    expect(readFileSync(path.join(f.root, "publish-21.log"), "utf8")).toBe("Log unavailable: HTTP 410\n")
  } finally {
    rmSync(f.root, { recursive: true, force: true })
  }
})

test("a review after a failed publication must say what it did about it", () => {
  const f = fixture()
  try {
    writeFileSync(path.join(f.data, "publish.json"), JSON.stringify({ run: 2, conclusion: "cancelled", jobs: [] }))
    expect(f.run("verify").stderr).toContain("The report must address the failed publication")
    writeFileSync(
      path.join(f.data, "report.json"),
      JSON.stringify({ ...f.report, publish: "The desktop check waited on an app that never exits; adapted it." }),
    )
    expect(f.run("verify").status).toBe(0)
    writeFileSync(path.join(f.data, "report.json"), JSON.stringify(f.report))
    writeFileSync(path.join(f.data, "publish.json"), JSON.stringify({ run: 3, conclusion: "success", jobs: [] }))
    expect(f.run("verify").status).toBe(0)
  } finally {
    rmSync(f.root, { recursive: true, force: true })
  }
})
