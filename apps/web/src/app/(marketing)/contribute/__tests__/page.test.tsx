import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import ContributePage from "../page"
import { contributionsApi } from "@/lib/api/contributions"

jest.mock("@/lib/api/contributions", () => ({
  contributionsApi: {
    createPixContribution: jest.fn(),
    getContributionStatus: jest.fn(),
    syncContributionStatus: jest.fn(),
  },
}))

const mockedContributionsApi = jest.mocked(contributionsApi)

const pendingContribution = {
  contribution_id: "2a4a908b-0ef6-4bc1-9a0f-15a7e1fb83a2",
  status: "PENDING",
  amount: 25,
  pix_copy_paste: "00020101021226840014br.gov.bcb.pix...",
  pix_qr_code_base64: "iVBORw0KGgo=",
  expires_at: new Date(Date.now() + 60_000).toISOString(),
}

function pendingStatus(expiresAt: string) {
  return {
    contribution_id: pendingContribution.contribution_id,
    status: "PENDING",
    amount: 25,
    provider_payment_id: "123",
    paid_at: null,
    refunded_at: null,
    cancelled_at: null,
    expires_at: expiresAt,
  }
}

function paidStatus(expiresAt: string) {
  return {
    ...pendingStatus(expiresAt),
    status: "PAID",
    paid_at: new Date().toISOString(),
  }
}

describe("ContributePage", () => {
  beforeEach(() => {
    jest.useRealTimers()
    sessionStorage.clear()
    mockedContributionsApi.createPixContribution.mockReset()
    mockedContributionsApi.getContributionStatus.mockReset()
    mockedContributionsApi.syncContributionStatus.mockReset()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it("validates required contribution amount", async () => {
    render(<ContributePage />)

    await userEvent.click(screen.getByRole("button", { name: "Gerar Pix" }))

    expect(await screen.findByText("Informe um valor válido")).toBeInTheDocument()
    expect(mockedContributionsApi.createPixContribution).not.toHaveBeenCalled()
  })

  it("submits amount as a number and shows Pix QR details", async () => {
    mockedContributionsApi.createPixContribution.mockResolvedValue(pendingContribution)
    mockedContributionsApi.getContributionStatus.mockResolvedValue(
      pendingStatus(pendingContribution.expires_at)
    )

    render(<ContributePage />)

    await userEvent.type(screen.getByLabelText("Valor"), "25")
    await userEvent.type(screen.getByLabelText("Nome"), "  ")
    await userEvent.click(screen.getByRole("button", { name: "Gerar Pix" }))

    await waitFor(() =>
      expect(mockedContributionsApi.createPixContribution).toHaveBeenCalledWith({
        amount: 25,
      })
    )
    expect(await screen.findByAltText("QR Code Pix")).toBeInTheDocument()
    expect(screen.getByText(/000201010212/)).toBeInTheDocument()
  })

  it("transitions from pending to paid when polling sees a paid status", async () => {
    jest.useFakeTimers()
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })

    mockedContributionsApi.createPixContribution.mockResolvedValue(pendingContribution)
    mockedContributionsApi.getContributionStatus.mockResolvedValue(
      paidStatus(pendingContribution.expires_at)
    )

    render(<ContributePage />)

    await user.type(screen.getByLabelText("Valor"), "25")
    await user.click(screen.getByRole("button", { name: "Gerar Pix" }))
    await screen.findByText("Janela Pix de 2 minutos")

    await act(async () => {
      await jest.advanceTimersByTimeAsync(5000)
    })

    expect(await screen.findByText("Pagamento confirmado!")).toBeInTheDocument()
  })

  it("limits a long provider Pix expiration to a visible 2-minute window", async () => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date("2026-05-23T12:00:00.000Z"))
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    const providerExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

    mockedContributionsApi.createPixContribution.mockResolvedValue({
      ...pendingContribution,
      expires_at: providerExpiresAt,
    })
    mockedContributionsApi.getContributionStatus.mockResolvedValue(
      pendingStatus(providerExpiresAt)
    )

    render(<ContributePage />)

    await user.type(screen.getByLabelText("Valor"), "25")
    await user.click(screen.getByRole("button", { name: "Gerar Pix" }))

    expect(await screen.findByAltText("QR Code Pix")).toBeInTheDocument()
    expect(screen.getByText("Janela Pix de 2 minutos")).toBeInTheDocument()
    expect(screen.getAllByText("02:00").length).toBeGreaterThan(0)
  })

  it("hides the Pix QR details after the 2-minute visible window expires", async () => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date("2026-05-23T12:00:00.000Z"))
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    const providerExpiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString()

    mockedContributionsApi.createPixContribution.mockResolvedValue({
      ...pendingContribution,
      expires_at: providerExpiresAt,
    })
    mockedContributionsApi.getContributionStatus.mockResolvedValue(
      pendingStatus(providerExpiresAt)
    )
    mockedContributionsApi.syncContributionStatus.mockResolvedValue(
      pendingStatus(providerExpiresAt)
    )

    render(<ContributePage />)

    await user.type(screen.getByLabelText("Valor"), "25")
    await user.click(screen.getByRole("button", { name: "Gerar Pix" }))
    await screen.findByAltText("QR Code Pix")

    await act(async () => {
      await jest.advanceTimersByTimeAsync(120_000)
      await Promise.resolve()
    })

    expect(await screen.findByText("QR Code expirado")).toBeInTheDocument()
    expect(screen.queryByAltText("QR Code Pix")).not.toBeInTheDocument()
    expect(screen.queryByText(/000201010212/)).not.toBeInTheDocument()
  })

  it("keeps a paid backend status ahead of the local 2-minute expiration", async () => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date("2026-05-23T12:00:00.000Z"))
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    const createdAtMs = Date.now()
    const providerExpiresAt = new Date(createdAtMs + 24 * 60 * 60 * 1000).toISOString()

    mockedContributionsApi.createPixContribution.mockResolvedValue({
      ...pendingContribution,
      expires_at: providerExpiresAt,
    })
    mockedContributionsApi.getContributionStatus.mockResolvedValue(
      pendingStatus(providerExpiresAt)
    )
    mockedContributionsApi.syncContributionStatus.mockImplementation(async () =>
      Date.now() >= createdAtMs + 120_000
        ? paidStatus(providerExpiresAt)
        : pendingStatus(providerExpiresAt)
    )

    render(<ContributePage />)

    await user.type(screen.getByLabelText("Valor"), "25")
    await user.click(screen.getByRole("button", { name: "Gerar Pix" }))
    await screen.findByText("Janela Pix de 2 minutos")

    await act(async () => {
      await jest.advanceTimersByTimeAsync(120_000)
      await Promise.resolve()
    })

    expect(await screen.findByText("Pagamento confirmado!")).toBeInTheDocument()
    expect(screen.queryByText("QR Code expirado")).not.toBeInTheDocument()
  })

  it("shows an expired state when the created Pix is already expired", async () => {
    mockedContributionsApi.createPixContribution.mockResolvedValue({
      ...pendingContribution,
      expires_at: new Date(Date.now() - 1_000).toISOString(),
    })

    render(<ContributePage />)

    await userEvent.type(screen.getByLabelText("Valor"), "25")
    await userEvent.click(screen.getByRole("button", { name: "Gerar Pix" }))

    expect(await screen.findByText("QR Code expirado")).toBeInTheDocument()
  })

  it("shows an error banner when Pix creation fails", async () => {
    mockedContributionsApi.createPixContribution.mockRejectedValue(new Error("Mercado Pago indisponível"))

    render(<ContributePage />)

    await userEvent.type(screen.getByLabelText("Valor"), "25")
    await userEvent.click(screen.getByRole("button", { name: "Gerar Pix" }))

    expect(await screen.findByText("Mercado Pago indisponível")).toBeInTheDocument()
  })
})
