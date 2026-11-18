import { readFileSync } from "node:fs"
import { join } from "node:path"
import { render } from "@testing-library/react"
import { HERO_PIECES, HeroShard } from "../hero-secret"

describe("HeroShard", () => {
  it("renders exactly the pieces the generated CSS places", () => {
    const { container } = render(<HeroShard />)
    const css = readFileSync(join(__dirname, "../hero-secret.generated.css"), "utf8")

    expect(container.querySelectorAll(".hero-shard-origin i")).toHaveLength(HERO_PIECES)
    expect(css.match(/\.hero-shard-origin i:nth-of-type\(\d+\)/g)).toHaveLength(HERO_PIECES)
  })
})
