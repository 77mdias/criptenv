"use client"

import * as ToastPrimitive from "@radix-ui/react-toast"
import { Check } from "lucide-react"
import { useToastStore } from "@/stores/toast"

function Toaster() {
  const { message, id, dismiss } = useToastStore()

  return (
    <ToastPrimitive.Provider duration={3000} swipeDirection="down">
      <ToastPrimitive.Root
        key={id}
        open={message !== null}
        onOpenChange={(open) => !open && dismiss()}
        className="flex items-center gap-2 rounded-lg border border-(--border) bg-(--background) px-4 py-3 text-sm text-(--text-primary) shadow-lg data-[state=open]:animate-[fadeInUp_0.2s_ease-out] data-[state=closed]:animate-[fadeInUp_0.2s_ease-in_reverse] motion-reduce:animate-none"
      >
        <Check aria-hidden className="h-4 w-4 shrink-0 text-green-600" />
        <ToastPrimitive.Description>{message}</ToastPrimitive.Description>
      </ToastPrimitive.Root>
      {/* Above dialogs (z-[81]) so copies made inside a modal still show feedback. */}
      <ToastPrimitive.Viewport className="fixed bottom-6 left-1/2 z-[90] flex -translate-x-1/2 flex-col outline-none" />
    </ToastPrimitive.Provider>
  )
}

export { Toaster }
