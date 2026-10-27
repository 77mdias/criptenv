import { buildApiUrl } from "@/lib/api/base-url"

/** Copy-paste usage snippets with the project id filled in (flows validated against the CLI/Action). */
export function projectSnippets(projectId: string, environment: string) {
  return {
    cli: [
      "pip install criptenv",
      "criptenv login",
      `criptenv use ${projectId}`,
      `criptenv run -e ${environment} -- npm start`,
    ].join("\n"),

    githubAction: [
      "- name: Load secrets",
      "  uses: 77mdias/criptenv/packages/github-action@github-action-v1",
      "  with:",
      "    token: ${{ secrets.CRIPTENV_TOKEN }}",
      `    project: '${projectId}'`,
      `    environment: ${environment}`,
      "    vault-password: ${{ secrets.CRIPTENV_VAULT_PASSWORD }}",
    ].join("\n"),

    gitlab: [
      "# Settings → CI/CD → Variables (masked): CRIPTENV_API_KEY, CRIPTENV_VAULT_PASSWORD",
      "variables:",
      `  CRIPTENV_PROJECT: ${projectId}`,
      "script:",
      "  - pip install criptenv",
      "  - criptenv login",
      `  - criptenv run -e ${environment} -- npm run build`,
    ].join("\n"),

    api: [
      `curl -H "Authorization: Bearer $CRIPTENV_API_KEY" \\`,
      `  ${buildApiUrl(`/api/v1/projects/${projectId}/environments`)}`,
    ].join("\n"),
  }
}
