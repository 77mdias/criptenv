/**
 * CriptEnv GitHub Action
 *
 * Pulls encrypted secrets from CriptEnv and exports them as environment
 * variables for the current GitHub Actions job.
 */

import * as core from "@actions/core";
import * as httpClient from "@actions/http-client";

const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 2000, 4000];

interface LoginResponse {
  session_token: string;
  expires_in: number;
  project_id: string;
  permissions: string[];
}

interface VaultBlob {
  id: string;
  key_id: string;
  iv: string;
  ciphertext: string;
  auth_tag: string;
  version: number;
  checksum: string;
}

interface SecretsResponse {
  blobs: VaultBlob[];
  version: number;
  environment: string;
}

export interface ActionInputs {
  token: string;
  project: string;
  environment: string;
  apiUrl: string;
  prefix: string;
  versionOutput: string;
}

type HttpClientFactory = () => httpClient.HttpClient;

export async function retry<T>(
  fn: () => Promise<T>,
  retries: number = MAX_RETRIES,
  delays: number[] = RETRY_DELAYS,
): Promise<T> {
  let lastError: Error | null = null;

  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (i < retries) {
        const delay = delays[i] ?? delays[delays.length - 1] ?? 0;
        core.info(`Retry ${i + 1}/${retries} after ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError ?? new Error("Operation failed");
}

export function getInputs(): ActionInputs {
  return {
    token: core.getInput("token", { required: true }),
    project: core.getInput("project", { required: true }),
    environment: core.getInput("environment") || "production",
    apiUrl: (core.getInput("api-url") || "https://api.criptenv.com/api/v1").replace(/\/$/, ""),
    prefix: core.getInput("prefix") || "SECRET_",
    versionOutput: core.getInput("version-output") || "version",
  };
}

export function normalizeKeyName(keyId: string): string {
  return keyId.toUpperCase().replace(/[^A-Z0-9]/g, "_");
}

function createHttpClient(): httpClient.HttpClient {
  return new httpClient.HttpClient("criptenv-action");
}

export async function ciLogin(
  apiUrl: string,
  token: string,
  projectId: string,
  clientFactory: HttpClientFactory = createHttpClient,
): Promise<LoginResponse> {
  const client = clientFactory();
  const url = `${apiUrl}/auth/ci-login`;
  const body = JSON.stringify({ token, project_id: projectId });

  const response = await client.postJson<LoginResponse>(url, body, {
    "Content-Type": "application/json",
  });

  if (!response.result) {
    throw new Error(`Login failed: ${response.statusCode}`);
  }

  core.info(`Login successful. Session expires in ${response.result.expires_in}s`);
  return response.result;
}

export async function getSecrets(
  apiUrl: string,
  sessionToken: string,
  projectId: string,
  environment: string,
  clientFactory: HttpClientFactory = createHttpClient,
): Promise<SecretsResponse> {
  const client = clientFactory();
  const params = new URLSearchParams({ project_id: projectId, environment });
  const url = `${apiUrl}/ci/secrets?${params.toString()}`;

  const response = await client.getJson<SecretsResponse>(url, {
    Authorization: `Bearer ${sessionToken}`,
    "Content-Type": "application/json",
  });

  if (!response.result) {
    const error =
      response.statusCode === 401
        ? "Authentication failed. Check your CI token."
        : response.statusCode === 404
          ? `Environment '${environment}' not found in project '${projectId}'`
          : `Failed to fetch secrets: ${response.statusCode}`;
    throw new Error(error);
  }

  return response.result;
}

export function decryptSecret(blob: VaultBlob): string {
  return blob.ciphertext;
}

export async function run(
  inputs: ActionInputs = getInputs(),
  clientFactory: HttpClientFactory = createHttpClient,
  retryDelays: number[] = RETRY_DELAYS,
): Promise<void> {
  core.info("CriptEnv Secrets Action");
  core.info(`Project: ${inputs.project}`);
  core.info(`Environment: ${inputs.environment}`);
  core.info(`API URL: ${inputs.apiUrl}`);

  try {
    core.info("Authenticating with CriptEnv...");
    const loginResponse = await retry(() =>
      ciLogin(inputs.apiUrl, inputs.token, inputs.project, clientFactory),
      MAX_RETRIES,
      retryDelays,
    );

    core.info("Fetching secrets...");
    const secrets = await retry(() =>
      getSecrets(
        inputs.apiUrl,
        loginResponse.session_token,
        inputs.project,
        inputs.environment,
        clientFactory,
      ),
      MAX_RETRIES,
      retryDelays,
    );

    core.info(`Found ${secrets.blobs.length} secrets (version ${secrets.version})`);

    let count = 0;
    const errors: string[] = [];

    for (const blob of secrets.blobs) {
      try {
        const secretValue = decryptSecret(blob);
        const varName = `${inputs.prefix}${normalizeKeyName(blob.key_id)}`;

        core.setSecret(secretValue);
        core.exportVariable(varName, secretValue);
        core.debug(`Exported ${varName}`);
        count++;
      } catch (error) {
        const errMsg = `Failed to process secret '${blob.key_id}': ${error}`;
        core.warning(errMsg);
        errors.push(errMsg);
      }
    }

    core.setOutput("secrets-count", count.toString());
    core.setOutput(inputs.versionOutput, secrets.version.toString());

    core.info(`Successfully loaded ${count} secrets`);

    if (errors.length > 0) {
      core.warning(`Encountered ${errors.length} errors while processing secrets`);
    }

    core.info("=== Summary ===");
    core.info(`Secrets loaded: ${count}`);
    core.info(`Secrets version: ${secrets.version}`);
    core.info(`Environment: ${secrets.environment}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    core.setFailed(`CriptEnv action failed: ${message}`);
  }
}

if (require.main === module) {
  run().catch((error) => {
    core.setFailed(`Unexpected error: ${error}`);
  });
}
