import { formatDate, formatRelativeTime } from "@/lib/utils"

const now = new Date("2026-10-26T12:00:00Z")
const ago = (ms: number) => new Date(now.getTime() - ms)
const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

describe("formatRelativeTime", () => {
  it("speaks the active locale", () => {
    expect(formatRelativeTime(ago(2 * HOUR), "pt-BR", now)).toBe("há 2 horas")
    expect(formatRelativeTime(ago(2 * HOUR), "en", now)).toBe("2 hours ago")
    expect(formatRelativeTime(ago(2 * HOUR), "es", now)).toBe("hace 2 horas")
  })

  it("uses natural words for very recent and yesterday", () => {
    expect(formatRelativeTime(ago(10_000), "en", now)).toBe("now")
    expect(formatRelativeTime(ago(DAY), "en", now)).toBe("yesterday")
    expect(formatRelativeTime(ago(5 * MIN), "pt-BR", now)).toBe("há 5 minutos")
  })

  it("stays relative up to 30 days, then shows the date in the locale", () => {
    expect(formatRelativeTime(ago(20 * DAY), "en", now)).toBe("20 days ago")
    expect(formatRelativeTime(ago(45 * DAY), "en", now)).toBe(formatDate(ago(45 * DAY), "en"))
    expect(formatRelativeTime(ago(45 * DAY), "pt-BR", now)).toBe("11/09/2026")
  })

  it("defaults to pt-BR for existing callers", () => {
    expect(formatRelativeTime(ago(3 * DAY), undefined, now)).toBe("há 3 dias")
  })
})
