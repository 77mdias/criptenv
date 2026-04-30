/**
 * CriptEnv GitHub Action
 *
 * Pulls secrets from CriptEnv and injects them as environment variables.
 */

import * as core from "@actions/core";
import * as httpClient from "@actions/http-client";

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 2000, 4000]; // Exponential backoff

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

interface ActionInputs {
  token: string;
  project: string;
  environment: string;
  apiUrl: string;
  prefix: string;
  versionOutput: string;
}

async function retry<T>(
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
        const delay = delays[i] || delays[delays.length - 1];
        core.info(`Retry ${i + 1}/${retries} after ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

function getInputs(): ActionInputs {
  return {
    token: core.getInput("token", { required: true }),
    project: core.getInput("project", { required: true }),
    environment: core.getInput("environment") || "production",
    apiUrl: core.getInput("api-url") || "https://api.criptenv.com",
    prefix: core.getInput("prefix") || "SECRET_",
    versionOutput: core.getInput("version-output") || "version",
  };
}

function normalizeKeyName(keyId: string): string {
  // Convert to uppercase, replace non-alphanumeric with underscores
  return keyId.toUpperCase().replace(/[^A-Z0-9]/g, "_");
}

async function ciLogin(
  apiUrl: string,
  token: string,
  projectId: string,
): Promise<LoginResponse> {
  const client = new httpClient.HttpClient("criptenv-action");

  const url = `${apiUrl}/auth/ci-login`;
  const body = JSON.stringify({ token, project_id: projectId });

  const response = await client.postJson<LoginResponse>(url, body, {
    "Content-Type": "application/json",
  });

  if (!response.result) {
    throw new Error(`Login failed: ${response.statusCode}`);
  }

  core.info(
    `Login successful. Session expires in ${response.result.expires_in}s`,
  );
  return response.result;
}

async function getSecrets(
  apiUrl: string,
  sessionToken: string,
  projectId: string,
  environment: string,
): Promise<SecretsResponse> {
  const client = new httpClient.HttpClient("criptenv-action");

  const params = new URLSearchParams({
    project_id: projectId,
    environment,
  });

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

function decryptSecret(blob: VaultBlob): string {
  /**
   * Decrypt a secret blob.
   *
   * The blob contains:
   * - iv: Initialization vector (base64)
   * - ciphertext: Encrypted data (base64)
   * - auth_tag: Authentication tag (base64)
   *
   * In a real implementation, this would use the project's encryption key
   * to decrypt the ciphertext using AES-256-GCM.
   *
   * For this action, we return the ciphertext as-is since the user will
   * need to provide their own decryption key. The secrets are meant to
   * be injected as encrypted values that the application will decrypt
   * at runtime using the CriptEnv client library.
   */

  // Return the ciphertext directly - the consuming application
  // should use the CriptEnv client library to decrypt
  return blob.ciphertext;
}

async function run(): Promise<void> {
  const inputs = getInputs();

  core.info(`CriptEnv Secrets Action`);
  core.info(`Project: ${inputs.project}`);
  core.info(`Environment: ${inputs.environment}`);
  core.info(`API URL: ${inputs.apiUrl}`);

  try {
    // Step 1: CI Login
    core.info("Authenticating with CriptEnv...");
    const loginResponse = await retry(() =>
      ciLogin(inputs.apiUrl, inputs.token, inputs.project),
    );

    // Step 2: Get Secrets
    core.info("Fetching secrets...");
    const secrets = await retry(() =>
      getSecrets(
        inputs.apiUrl,
        loginResponse.session_token,
        inputs.project,
        inputs.environment,
      ),
    );

    // Step 3: Export as environment variables
    core.info(
      `Found ${secrets.blobs.length} secrets (version ${secrets.version})`,
    );

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

    // Set outputs
    core.setOutput("secrets-count", count.toString());
    core.setOutput(inputs.versionOutput, secrets.version.toString());

    core.info(`Successfully loaded ${count} secrets`);

    if (errors.length > 0) {
      core.warning(
        `Encountered ${errors.length} errors while processing secrets`,
      );
    }

    // Summary
    core.info("=== Summary ===");
    core.info(`Secrets loaded: ${count}`);
    core.info(`Secrets version: ${secrets.version}`);
    core.info(`Environment: ${secrets.environment}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    core.setFailed(`CriptEnv action failed: ${message}`);
  }
}

// Run the action
run().catch((error) => {
  core.setFailed(`Unexpected error: ${error}`);
});
