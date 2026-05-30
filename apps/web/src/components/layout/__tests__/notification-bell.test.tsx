import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useRouter } from "next/navigation"
import { NotificationBell } from "../notification-bell"
import { useNotificationsStore } from "@/stores/notifications"
import {
  getUnreadCount,
  listNotifications,
  markAsRead,
  markAllAsRead,
} from "@/lib/api/notifications"

jest.mock("@/lib/api/notifications", () => ({
  getUnreadCount: jest.fn(),
  listNotifications: jest.fn(),
  markAsRead: jest.fn(),
  markAllAsRead: jest.fn(),
}))

const mockedUseRouter = jest.mocked(useRouter)
const mockedGetUnreadCount = jest.mocked(getUnreadCount)
const mockedListNotifications = jest.mocked(listNotifications)
const mockedMarkAsRead = jest.mocked(markAsRead)
const mockedMarkAllAsRead = jest.mocked(markAllAsRead)

const inviteNotification = {
  id: "ntf_1",
  user_id: "usr_1",
  type: "invite",
  title: "Convite para Core API",
  message: "Owner convidou você para participar do projeto 'Core API' como developer.",
  read_at: null,
  action_url: "/invites/accept?token=abc",
  meta: { project_name: "Core API" },
  created_at: "2026-05-29T12:00:00.000Z",
}

describe("NotificationBell", () => {
  beforeEach(() => {
    useNotificationsStore.setState({
      notifications: [],
      unreadCount: 0,
      isOpen: false,
      isLoading: false,
      hasLoaded: false,
    })
    mockedUseRouter.mockReturnValue({ push: jest.fn() } as unknown as ReturnType<typeof useRouter>)
    mockedGetUnreadCount.mockResolvedValue({ unread_count: 1 })
    mockedListNotifications.mockResolvedValue({
      notifications: [],
      total: 0,
      unread_count: 0,
    })
    mockedMarkAsRead.mockResolvedValue({ success: true, id: "ntf_1" })
    mockedMarkAllAsRead.mockResolvedValue({ success: true, marked_count: 1 })
  })

  it("refreshes the notification list every time the dropdown opens", async () => {
    const push = jest.fn()
    mockedUseRouter.mockReturnValue({ push } as unknown as ReturnType<typeof useRouter>)
    mockedListNotifications.mockResolvedValue({
      notifications: [inviteNotification],
      total: 1,
      unread_count: 1,
    })
    useNotificationsStore.setState({
      notifications: [],
      unreadCount: 1,
      isOpen: false,
      isLoading: false,
      hasLoaded: true,
    })

    render(<NotificationBell />)

    await userEvent.click(screen.getByRole("button", { name: /notifica/i }))

    await waitFor(() => expect(mockedListNotifications).toHaveBeenCalledTimes(1))
    await userEvent.click(await screen.findByRole("button", { name: /Convite para Core API/i }))

    expect(mockedMarkAsRead).toHaveBeenCalledWith("ntf_1")
    expect(push).toHaveBeenCalledWith("/invites/accept?token=abc")
  })

  it("renders a solid accessible empty-state panel", async () => {
    render(<NotificationBell />)

    await userEvent.click(screen.getByRole("button", { name: /notifica/i }))

    const panel = await screen.findByRole("dialog", { name: /notificações/i })
    expect(panel).toHaveClass("bg-(--surface-elevated)")
    expect(panel).toHaveClass("fixed", "inset-x-3", "sm:absolute")
    expect(screen.getByText("Nenhuma notificação ainda")).toBeInTheDocument()
  })
})
