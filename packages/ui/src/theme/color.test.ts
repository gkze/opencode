import { describe, expect, test } from "bun:test"
import { contrastRatio } from "./color"

describe("sRGB contrast", () => {
  test.each([
    ["#ffffff", "#000000", 21],
    ["#ff0000", "#000000", 5.252],
    ["#00ff00", "#000000", 15.304],
    ["#0000ff", "#000000", 2.444],
    ["#5c5f77", "#f2f4f8", 5.678774186622912],
  ] as const)("matches the reference ratio for %s on %s", (foreground, background, ratio) => {
    expect(contrastRatio(foreground, background)).toBeCloseTo(ratio, 10)
    expect(contrastRatio(background, foreground)).toBeCloseTo(ratio, 10)
    expect(contrastRatio(foreground, foreground)).toBe(1)
  })
})
