"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"

export default function ProjectDetailPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace(window.location.pathname + "/secrets")
  }, [router])
  return null
}
