import { act, fireEvent, screen, waitFor } from "@testing-library/react"

import { parseSseChunk } from "@/lib/api/support"
import { renderWithIntl } from "@/test/render-with-intl"

import { OPEN_SUPPORT_EVENT, RichText, SupportChat } from "../support-chat"
import { SupportLink } from "../support-link"

function sseBody(events: object[]) {
  const chunks = events.map((event) => new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`))
  return {
    getReader: () => ({
      read: async () => (chunks.length ? { done: false, value: chunks.shift() } : { done: true, value: undefined }),
    }),
  }
}

function mockFetch({ enabled = true, chat }: { enabled?: boolean; chat?: () => object } = {}) {
  global.fetch = jest.fn(async (url: string) => {
    if (String(url).endsWith("/api/v1/support/status")) {
      return { ok: true, json: async () => ({ enabled }) }
    }
    return chat ? chat() : { ok: true, status: 200, body: sseBody([{ type: "done" }]) }
  }) as unknown as typeof fetch
}

async function openChat() {
  fireEvent.click(await screen.findByRole("button", { name: "Abrir o suporte" }))
  return screen.getByRole("dialog", { name: "Suporte CriptEnv" })
}

async function ask(question: string) {
  fireEvent.change(screen.getByLabelText("Escreva sua dúvida"), { target: { value: question } })
  fireEvent.click(screen.getByRole("button", { name: "Enviar" }))
}

describe("SupportChat", () => {
  it("shows the bot button only when the support is enabled", async () => {
    mockFetch({ enabled: false })
    renderWithIntl(<SupportChat />)
    await waitFor(() => expect(global.fetch).toHaveBeenCalled())
    expect(screen.queryByRole("button", { name: "Abrir o suporte" })).not.toBeInTheDocument()
  })

  it("hides the button and remembers it", async () => {
    mockFetch()
    renderWithIntl(<SupportChat />)
    await openChat()
    fireEvent.click(screen.getByRole("button", { name: "Esconder o botão do suporte" }))

    expect(screen.queryByRole("button", { name: "Abrir o suporte" })).not.toBeInTheDocument()
    expect(localStorage.getItem("criptenv-support-hidden")).toBe("1")
  })

  it("the footer link opens the chat even when hidden, and shows the button again", async () => {
    localStorage.setItem("criptenv-support-hidden", "1")
    mockFetch()
    renderWithIntl(
      <>
        <SupportChat />
        <SupportLink />
      </>,
    )
    await waitFor(() => expect(global.fetch).toHaveBeenCalled())
    expect(screen.queryByRole("button", { name: "Abrir o suporte" })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Suporte" }))
    expect(await screen.findByRole("dialog", { name: "Suporte CriptEnv" })).toBeInTheDocument()
    expect(localStorage.getItem("criptenv-support-hidden")).toBeNull()
  })

  it("streams the answer into the conversation and keeps it in sessionStorage only", async () => {
    mockFetch({
      chat: () => ({
        ok: true,
        status: 200,
        body: sseBody([{ type: "text", text: "Use `criptenv run`" }, { type: "text", text: " e veja /docs/cli/commands" }, { type: "done" }]),
      }),
    })
    renderWithIntl(<SupportChat />)
    await openChat()
    await ask("Como uso no Docker?")

    expect(await screen.findByText("criptenv run")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "/docs/cli/commands" })).toHaveAttribute("href", "/docs/cli/commands")
    const saved = JSON.parse(sessionStorage.getItem("criptenv-support-chat") ?? "[]")
    expect(saved).toEqual([
      { role: "user", content: "Como uso no Docker?" },
      { role: "assistant", content: "Use `criptenv run` e veja /docs/cli/commands" },
    ])
    expect(localStorage.getItem("criptenv-support-chat")).toBeNull()

    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[1][1].body)
    expect(body).toEqual({ messages: [{ role: "user", content: "Como uso no Docker?" }], locale: "pt-BR" })
  })

  it.each([
    ["RATE_LIMIT_EXCEEDED", "Você mandou muitas mensagens na última hora."],
    ["SUPPORT_DAILY_LIMIT", "O suporte atingiu o limite de mensagens de hoje."],
  ])("shows the %s message", async (code, text) => {
    mockFetch({ chat: () => ({ ok: false, status: 429, json: async () => ({ error: { code } }) }) })
    renderWithIntl(<SupportChat />)
    await openChat()
    await ask("oi")

    expect(await screen.findByText(new RegExp(text))).toBeInTheDocument()
  })

  it("shows the unavailable message on an error event and never sends that notice back", async () => {
    let calls = 0
    mockFetch({
      chat: () => {
        calls += 1
        return { ok: true, status: 200, body: sseBody(calls === 1 ? [{ type: "error", code: "unavailable" }] : [{ type: "done" }]) }
      },
    })
    renderWithIntl(<SupportChat />)
    await openChat()
    await ask("primeira")
    expect(await screen.findByText(/O suporte não respondeu agora/)).toBeInTheDocument()

    await ask("segunda")
    await waitFor(() => expect(calls).toBe(2))
    const body = JSON.parse((global.fetch as jest.Mock).mock.calls.at(-1)[1].body)
    expect(body.messages.map((m: { content: string }) => m.content)).toEqual(["primeira", "segunda"])
  })

  it("says it found no answer when the bot ends without text", async () => {
    mockFetch({ chat: () => ({ ok: true, status: 200, body: sseBody([{ type: "error", code: "no_answer" }]) }) })
    renderWithIntl(<SupportChat />)
    await openChat()
    await ask("pergunta difícil")
    expect(await screen.findByText(/Não encontrei essa resposta/)).toBeInTheDocument()
  })

  it("closes on Escape and returns focus to the button", async () => {
    mockFetch()
    renderWithIntl(<SupportChat />)
    const dialog = await openChat()
    fireEvent.keyDown(dialog, { key: "Escape" })

    const button = await screen.findByRole("button", { name: "Abrir o suporte" })
    await act(async () => new Promise((resolve) => setTimeout(resolve, 0)))
    expect(button).toHaveFocus()
  })
})

describe("SupportChat history", () => {
  it("sends only the last 10 real messages, so a long chat never locks up", async () => {
    const long = Array.from({ length: 30 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", content: `m${i}` }))
    sessionStorage.setItem("criptenv-support-chat", JSON.stringify([...long, { role: "assistant", content: "" }]))
    mockFetch()
    renderWithIntl(<SupportChat />)
    await openChat()
    await ask("nova")

    await waitFor(() => expect((global.fetch as jest.Mock).mock.calls.length).toBe(2))
    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[1][1].body)
    expect(body.messages).toHaveLength(10)
    expect(body.messages.every((m: { content: string }) => m.content)).toBe(true)
    expect(body.messages.at(-1)).toEqual({ role: "user", content: "nova" })
  })
})

describe("RichText", () => {
  it("renders code blocks, inline code and markdown links", () => {
    renderWithIntl(<RichText text={"Veja [a instalação](/docs/getting-started/installation):\n```bash\npip install criptenv\n```"} />)
    expect(screen.getByRole("link", { name: "a instalação" })).toHaveAttribute("href", "/docs/getting-started/installation")
    expect(screen.getByText("pip install criptenv").tagName).toBe("PRE")
  })

  it("renders **bold** without the asterisks", () => {
    renderWithIntl(<RichText text="O **Plano Pro** custa R$ 29." />)
    expect(screen.getByText("Plano Pro").tagName).toBe("STRONG")
    expect(screen.queryByText(/\*\*/)).not.toBeInTheDocument()
  })

  it("never turns a protocol-relative URL into an internal link", () => {
    renderWithIntl(<RichText text="[docs oficiais](//evil.example/docs)" />)
    expect(screen.queryByRole("link")).not.toBeInTheDocument()
  })
})

describe("parseSseChunk", () => {
  it("keeps an unfinished event for the next chunk", () => {
    expect(parseSseChunk('data: {"type":"text","text":"a"}\n\ndata: {"ty')).toEqual({
      events: [{ type: "text", text: "a" }],
      rest: 'data: {"ty',
    })
  })
})

it("dispatches the open event from the footer link", () => {
  const listener = jest.fn()
  window.addEventListener(OPEN_SUPPORT_EVENT, listener)
  renderWithIntl(<SupportLink />)
  fireEvent.click(screen.getByRole("button", { name: "Suporte" }))
  expect(listener).toHaveBeenCalled()
  window.removeEventListener(OPEN_SUPPORT_EVENT, listener)
})
