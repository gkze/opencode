import { expect, test } from "bun:test"
import { releaseVersion } from "../../../script/fork/version.mjs"

const input = { base: "2.0.27", nightly: false, run: "42", attempt: "1", date: "2026-10-12T23:30:00-07:00" }

test("manual releases use the tag version and the app's display name", () => {
  expect(releaseVersion({ ...input, tag: "fork-v2.0.27-gkze.3" })).toEqual({
    version: "2.0.27-gkze.3",
    tag: "fork-v2.0.27-gkze.3",
    release: true,
    title: "OpenCode Dev 2.0.27 · Build 3",
  })
})

test("nightlies use a UTC date and unique build identity", () => {
  expect(releaseVersion({ ...input, nightly: true })).toEqual({
    version: "2.0.27-gkze.nightly.20261013.42",
    tag: "fork-v2.0.27-gkze.nightly.20261013.42",
    release: true,
    title: "OpenCode Dev 2.0.27 · Nightly 2026-10-13 · Build 42",
  })
  expect(releaseVersion({ ...input, nightly: true, attempt: "2" }).version).toBe("2.0.27-gkze.nightly.20261013.42.2")
  expect(releaseVersion({ ...input, nightly: true, run: "43" }).version).toBe("2.0.27-gkze.nightly.20261013.43")
})

test("branch builds do not publish", () => {
  expect(releaseVersion(input).release).toBe(false)
})

test("rejects malformed tags and mismatched source versions", () => {
  for (const tag of ["v2.0.27-gkze.3", "fork-v2.0.27-gkze.0", "fork-v2.0.26-gkze.3", "fork-v2.0.27-gkze.3\n"]) {
    expect(() => releaseVersion({ ...input, tag })).toThrow()
  }
})
