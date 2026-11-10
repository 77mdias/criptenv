import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useRouter, useSearchParams } from "next/navigation"

import { billingApi, meApi } from "@/lib/api"
import type { BillingState, Subscription } from "@/lib/api"
import { ApiError } from "@/lib/api/client"
import type { Plan } from "@/lib/api/me"
import { leaveTo } from "@/lib/navigate"
import { renderWithIntl } from "@/test/render-with-intl"

import BillingPage from "../page"

jest.mock("@/lib/api", () => ({
  billingApi: { get: jest.fn(), checkout: jest.fn(), cancel: jest.fn(), sync: jest.fn(), updateTaxInfo: jest.fn() },
  meApi: { plan: jest.fn() },
}))
jest.mock("@/lib/navigate", () => ({ leaveTo: jest.fn() }))
jest.mock("@/stores/auth", () => ({
  useAuthStore: (pick: (state: { user: { email: string } }) => unknown) => pick({ user: { email: "ana@example.com" } }),
}))

const PRICES = { pro: { month: "29.00", year: "290.00" }, max: { month: "69.00", year: "690.00" } }

function plan(id: string, canUpgrade = true): Plan {
  return {
    id,
    features: [],
    usage: { projects: 2 },
    limits: {
      projects: id === "free" ? 3 : null,
      environments_per_project: 3,
      members_per_project: 3,
      integrations_per_project: 1,
      audit_retention_days: 7,
      personal_vault_items: 120,
      personal_vault_folders: 10,
    },
    can_upgrade: canUpgrade,
    grace_until: null,
  }
}

function subscription(over: Partial<Subscription> = {}): Subscription {
  return {
    id: "sub-1",
    plan: "pro",
    interval: "month",
    status: "active",
    amount: "29.00",
    cancel_at_period_end: false,
    current_period_start: "2027-04-01T12:00:00Z",
    current_period_end: "2027-05-01T12:00:00Z",
    grace_until: null,
    init_point: "https://mp.test/checkout/pa-1",
    tax_id: "52998224725",
    legal_name: "Ana Souza",
    address: "Rua A, 1",
    payer_email: "ana@mp.example",
    ...over,
  }
}

function state(over: Partial<BillingState> = {}): BillingState {
  return {
    prices: PRICES,
    subscription: null,
    scheduled: null,
    pending: null,
    refund_eligible: false,
    change_available_from: null,
    ...over,
  }
}

const mocked = {
  plan: jest.mocked(meApi.plan),
  get: jest.mocked(billingApi.get),
  sync: jest.mocked(billingApi.sync),
  checkout: jest.mocked(billingApi.checkout),
  cancel: jest.mocked(billingApi.cancel),
}

async function open(planId = "free", billing = state(), query = "") {
  jest.mocked(useSearchParams).mockReturnValue(new URLSearchParams(query) as never)
  mocked.plan.mockResolvedValue(plan(planId))
  mocked.get.mockResolvedValue(billing)
  mocked.sync.mockResolvedValue(billing)
  renderWithIntl(<BillingPage />)
  await screen.findByRole("heading", { name: "Assinatura" })
  await screen.findByRole("heading", { name: "Plano atual" })
}

describe("BillingPage", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("redirects to /account when billing is off", async () => {
    jest.mocked(useSearchParams).mockReturnValue(new URLSearchParams() as never)
    mocked.plan.mockResolvedValue(plan("free", false))
    renderWithIntl(<BillingPage />)

    await waitFor(() => expect(useRouter().replace).toHaveBeenCalledWith("/account"))
    expect(mocked.get).not.toHaveBeenCalled()
  })

  it("syncs on return from Mercado Pago and shows the active plan", async () => {
    await open("pro", state({ subscription: subscription() }), "preapproval_id=pa-1")

    expect(mocked.sync).toHaveBeenCalledTimes(1)
    expect(mocked.get).not.toHaveBeenCalled()
    expect(screen.getByText(/Próxima cobrança em 01\/05\/2027: R\$\s29,00\./)).toBeInTheDocument()
  })

  it("shows prices from the API and the usage of the plan", async () => {
    await open()

    expect(mocked.get).toHaveBeenCalledTimes(1)
    expect(screen.getByText("Você não tem uma assinatura.")).toBeInTheDocument()
    expect(screen.getByText("2 de 3 projetos")).toBeInTheDocument()
    expect(screen.getByText(/R\$\s29,00 por mês/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole("radio", { name: /anual/ }))
    expect(screen.getByText(/R\$\s690,00 por ano/)).toBeInTheDocument()
  })

  it("sends the checkout with tax data and goes to init_point", async () => {
    mocked.checkout.mockResolvedValue({ init_point: "https://mp.test/checkout/pa-9" })
    await open("free", state(), "plan=pro")

    await userEvent.type(screen.getByLabelText("CPF ou CNPJ (só números)"), "52998224725")
    await userEvent.type(screen.getByLabelText("Nome ou razão social"), "Ana Souza")
    await userEvent.type(screen.getByLabelText("Endereço completo"), "Rua A, 1")
    expect(screen.getByLabelText("E-mail da sua conta no Mercado Pago")).toHaveValue("ana@example.com")
    await userEvent.click(screen.getByRole("button", { name: "Ir para o pagamento" }))

    await waitFor(() => expect(leaveTo).toHaveBeenCalledWith("https://mp.test/checkout/pa-9"))
    expect(mocked.checkout).toHaveBeenCalledWith({
      plan: "pro",
      interval: "month",
      tax_id: "52998224725",
      legal_name: "Ana Souza",
      address: "Rua A, 1",
      payer_email: "ana@example.com",
    })
  })

  it("tells an upgrade apart from a scheduled change", async () => {
    await open("pro", state({ subscription: subscription() }))

    const maxCard = screen.getByRole("group", { name: "Max" })
    expect(within(maxCard).getByText(/Vale na hora/)).toBeInTheDocument()
    expect(within(screen.getByRole("group", { name: "Pro" })).getByText("Seu plano atual")).toBeInTheDocument()

    await userEvent.click(screen.getByRole("radio", { name: /anual/ }))
    expect(within(screen.getByRole("group", { name: "Pro" })).getByText(/passa a valer em 01\/05\/2027/)).toBeInTheDocument()
  })

  it("shows the pending payment with continue and already-paid", async () => {
    await open("free", state({ pending: subscription({ status: "pending" }) }))

    expect(screen.getByText("Pagamento pendente do plano Pro (mensal).")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Continuar pagamento" })).toHaveAttribute(
      "href", "https://mp.test/checkout/pa-1",
    )
    mocked.sync.mockResolvedValue(state({ subscription: subscription() }))
    await userEvent.click(screen.getByRole("button", { name: "Já paguei" }))

    expect(await screen.findByText(/Próxima cobrança em/)).toBeInTheDocument()
  })

  it("warns during the grace period", async () => {
    await open("pro", state({
      subscription: subscription({ status: "past_due", grace_until: "2027-05-08T12:00:00Z" }),
    }))

    expect(screen.getByRole("alert")).toHaveTextContent("O plano vale até 08/05/2027")
  })

  it("cancel dialog promises a refund only when eligible", async () => {
    mocked.cancel.mockResolvedValue({ refunded: true, ends_at: null })
    await open("pro", state({ subscription: subscription(), refund_eligible: true }))

    await userEvent.click(screen.getByRole("button", { name: "Cancelar assinatura" }))
    const dialog = await screen.findByRole("dialog")
    expect(dialog).toHaveTextContent("O valor pago é devolvido e a conta volta ao Free agora.")
    mocked.get.mockResolvedValue(state())
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancelar assinatura" }))

    expect(await screen.findByText("Assinatura cancelada. O valor pago foi devolvido.")).toBeInTheDocument()
    expect(mocked.cancel).toHaveBeenCalledTimes(1)
  })

  it("cancel dialog says until when the plan holds when there is no refund", async () => {
    await open("pro", state({ subscription: subscription(), refund_eligible: false }))

    await userEvent.click(screen.getByRole("button", { name: "Cancelar assinatura" }))

    expect(await screen.findByRole("dialog")).toHaveTextContent("o plano vale até 01/05/2027")
  })

  it("cancelling a scheduled change says the plan in force stays", async () => {
    await open("max", state({
      subscription: subscription({ plan: "max", cancel_at_period_end: true }),
      scheduled: subscription({ id: "sub-2", status: "scheduled", current_period_start: "2027-05-01T12:00:00Z" }),
      refund_eligible: true,
    }))

    await userEvent.click(screen.getByRole("button", { name: "Cancelar assinatura" }))

    const dialog = await screen.findByRole("dialog")
    expect(dialog).toHaveTextContent("O valor pago pela troca é devolvido.")
    expect(dialog).not.toHaveTextContent("volta ao Free agora")
  })

  it("offers a later change only in the last month of the paid period", async () => {
    await open("pro", state({
      subscription: subscription({ interval: "year", amount: "290.00", current_period_end: "2028-04-01T12:00:00Z" }),
      change_available_from: "2028-03-01T12:00:00Z",
    }))

    const pro = screen.getByRole("group", { name: "Pro" })
    expect(within(pro).getByText(/Disponível a partir de 01\/03\/2028/)).toBeInTheDocument()
    expect(within(pro).queryByRole("button")).not.toBeInTheDocument()
    // An upgrade never waits.
    expect(within(screen.getByRole("group", { name: "Max" })).getByRole("button", { name: "Escolher Max" })).toBeEnabled()
  })

  it("hides the cancel button once the subscription is already canceled", async () => {
    await open("pro", state({ subscription: subscription({ cancel_at_period_end: true }) }))

    expect(screen.getByText("Vale até 01/05/2027. Não haverá novas cobranças.")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Cancelar assinatura" })).not.toBeInTheDocument()
  })

  it("shows a provider error without breaking the page", async () => {
    mocked.checkout.mockRejectedValue(new ApiError("bad gateway", 502, null))
    await open("free", state(), "plan=max")

    await userEvent.type(screen.getByLabelText("CPF ou CNPJ (só números)"), "52998224725")
    await userEvent.type(screen.getByLabelText("Nome ou razão social"), "Ana Souza")
    await userEvent.type(screen.getByLabelText("Endereço completo"), "Rua A, 1")
    await userEvent.click(screen.getByRole("button", { name: "Ir para o pagamento" }))

    expect(await screen.findByRole("alert")).toHaveTextContent("O Mercado Pago não respondeu.")
    expect(leaveTo).not.toHaveBeenCalled()
    expect(screen.getByRole("heading", { name: "Escolher plano" })).toBeInTheDocument()
  })

  it("shows a load error", async () => {
    jest.mocked(useSearchParams).mockReturnValue(new URLSearchParams() as never)
    mocked.plan.mockResolvedValue(plan("free"))
    mocked.get.mockRejectedValue(new Error("offline"))
    renderWithIntl(<BillingPage />)

    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível carregar a assinatura.")
  })
})
