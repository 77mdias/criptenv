import { screen } from "@testing-library/react"

import { renderWithIntl } from "@/test/render-with-intl"

import { TaxInfoForm } from "../tax-info-form"

const initial = { tax_id: "", legal_name: "", address: "", payer_email: "" }

describe("TaxInfoForm", () => {
  it("points to the subscription rules of the Terms before the payment", () => {
    renderWithIntl(<TaxInfoForm mode="checkout" initial={initial} busy={false} onSubmit={jest.fn()} />)

    expect(screen.getByRole("link", { name: "regras de assinatura dos Termos de Uso" })).toHaveAttribute(
      "href",
      "/termos-de-uso#5-assinaturas",
    )
  })

  it("does not repeat it when only the invoice data is edited", () => {
    renderWithIntl(<TaxInfoForm mode="edit" initial={initial} busy={false} onSubmit={jest.fn()} />)

    expect(screen.queryByRole("link", { name: /Termos de Uso/ })).not.toBeInTheDocument()
  })
})
