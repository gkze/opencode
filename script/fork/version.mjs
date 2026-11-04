import assert from "node:assert/strict"

export function releaseVersion({ base, nightly, tag = "", run, attempt, date }) {
  assert.match(base, /^\d+\.\d+\.\d+$/)
  assert.match(run, /^[1-9]\d*$/)
  assert.match(attempt, /^[1-9]\d*$/)
  const day = new Date(date).toISOString().slice(0, 10)
  const sequence = `${run}${attempt === "1" ? "" : `.${attempt}`}`
  const version = nightly
    ? `${base}-gkze.nightly.${day.replaceAll("-", "")}.${sequence}`
    : tag
      ? tag.replace(/^fork-v/, "")
      : `${base}-gkze.${run}`
  assert.match(version, /^\d+\.\d+\.\d+-gkze\.(?:[1-9]\d*|nightly\.\d{8}\.[1-9]\d*(?:\.[1-9]\d*)?)$/)
  if (tag) assert.equal(tag, `fork-v${version}`, "Use fork-vX.Y.Z-gkze.N tags")
  if (!nightly) assert.equal(version.split("-gkze.")[0], base, "Tag must match the source version")
  return {
    version,
    tag: `fork-v${version}`,
    release: nightly || Boolean(tag),
    title: nightly
      ? `OpenCode Dev ${base} · Nightly ${day} · Build ${sequence}`
      : `OpenCode Dev ${base} · Build ${version.split("-gkze.")[1]}`,
  }
}
