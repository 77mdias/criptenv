import {
  SITE_ICONS_STORAGE_KEY,
  iconHostname,
  readSiteIconsSetting,
  siteIconSrc,
  writeSiteIconsSetting,
} from "../site-icons"

afterEach(() => {
  jest.restoreAllMocks()
  localStorage.clear()
})

describe("iconHostname", () => {
  it.each([
    ["https://github.com/login", "github.com"],
    ["http://GitHub.com", "github.com"],
    ["github.com/login", "github.com"],
    ["https://user:pw@GitHub.com:8443/x", "github.com"],
    ["https://münchen.de", "xn--mnchen-3ya.de"],
    ["https://github.com./", "github.com"],
  ])("accepts %s", (url, host) => {
    expect(iconHostname(url)).toBe(host)
  })

  it.each([
    undefined,
    "",
    "androidapp://com.x",
    "ftp://files.site.com",
    "https://localhost:3000",
    "https://intranet",
    "https://192.168.0.1",
    "https://[::1]/",
    "https://printer.local",
    "https://router.lan",
    "https://db.internal",
    "https://nas.home.arpa",
    "https://app.localhost",
    "http://abc.onion",
    "http://x.i2p",
    "https://not a url",
  ])("refuses %s", (url) => {
    expect(iconHostname(url)).toBeNull()
  })
})

it("builds the icon URL", () => {
  expect(siteIconSrc("github.com")).toMatch(/\/api\/v1\/icons\/github\.com\/icon\.png$/)
})

it("setting defaults to on, persists off and survives a broken localStorage", () => {
  expect(readSiteIconsSetting()).toBe(true)
  writeSiteIconsSetting(false)
  expect(localStorage.getItem(SITE_ICONS_STORAGE_KEY)).toBe("off")
  expect(readSiteIconsSetting()).toBe(false)

  jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("blocked")
  })
  jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("blocked")
  })
  expect(readSiteIconsSetting()).toBe(true)
  expect(() => writeSiteIconsSetting(true)).not.toThrow()
})
