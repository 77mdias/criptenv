import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { PricingCardCarousel, type PricingPlan } from "../pricing-card-carousel"

jest.mock("gsap", () => {
  const timeline = jest.fn(({ onComplete } = {}) => {
    let completed = false

    return {
      to: jest.fn(function to() {
        if (!completed) {
          completed = true
          onComplete?.()
        }
        return this
      }),
    }
  })

  return {
    __esModule: true,
    default: {
      killTweensOf: jest.fn(),
      set: jest.fn(),
      timeline,
    },
  }
})

const cards: PricingPlan[] = [
  {
    name: "Contribute",
    description: "Support independent open-source work",
    price: "R$ 5+",
    features: ["Pix support"],
    cta: "Contribute now",
    featured: true,
    href: "/contribute",
  },
  {
    name: "Open Source",
    description: "Use the current CLI and web dashboard",
    price: "Free",
    features: ["Zero-knowledge"],
    cta: "Start free",
    href: "/signup",
  },
  {
    name: "Maybe Later",
    description: "Hosted plans may arrive after the core is stable",
    price: "Future",
    features: ["No pricing promise today"],
    cta: "Read the docs",
    href: "/docs",
  },
]

function expectFrontCard(name: string) {
  expect(screen.getByLabelText(`Pricing plan: ${name}`)).toHaveAttribute(
    "aria-hidden",
    "false",
  )
}

describe("PricingCardCarousel", () => {
  afterEach(() => {
    jest.useRealTimers()
  })

  it("rotates from the currently visible card during autoplay", () => {
    jest.useFakeTimers()

    render(<PricingCardCarousel cards={cards} autoPlayInterval={4000} />)

    expectFrontCard("Contribute")

    act(() => {
      jest.advanceTimersByTime(4000)
    })
    expectFrontCard("Open Source")

    act(() => {
      jest.advanceTimersByTime(4000)
    })
    expectFrontCard("Maybe Later")
  })

  it("keeps dot navigation and the contribution link aligned", async () => {
    const user = userEvent.setup()

    render(<PricingCardCarousel cards={cards} autoPlayInterval={0} />)

    await user.click(screen.getByLabelText("Go to Maybe Later"))
    expectFrontCard("Maybe Later")

    await user.click(screen.getByLabelText("Previous plan"))
    expectFrontCard("Open Source")

    await user.click(screen.getByLabelText("Go to Contribute"))
    expectFrontCard("Contribute")
    expect(screen.getByRole("link", { name: "Contribute now" })).toHaveAttribute(
      "href",
      "/contribute",
    )
  })
})
