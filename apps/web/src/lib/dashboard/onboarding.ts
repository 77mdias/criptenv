import type { OverviewResponse } from "@/lib/api"

export type OnboardingStepId = "createProject" | "addSecret" | "installCli" | "inviteTeammate"

export interface OnboardingStep {
  id: OnboardingStepId
  done: boolean
}

/** Progress comes from real data; installing the CLI can't be detected, so the user marks it. */
export function onboardingSteps(overview: OverviewResponse, cliMarkedDone: boolean): OnboardingStep[] {
  return [
    { id: "createProject", done: overview.totals.projects > 0 },
    { id: "addSecret", done: overview.totals.secrets > 0 },
    { id: "installCli", done: cliMarkedDone },
    { id: "inviteTeammate", done: overview.projects.some((p) => p.member_count > 1) },
  ]
}
