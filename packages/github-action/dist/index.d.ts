/**
 * CriptEnv GitHub Action
 *
 * Pulls encrypted secrets from CriptEnv and exports them as environment
 * variables for the current GitHub Actions job.
 */
import * as httpClient from "@actions/http-client";
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
export declare function retry<T>(fn: () => Promise<T>, retries?: number, delays?: number[]): Promise<T>;
export declare function getInputs(): ActionInputs;
export declare function normalizeKeyName(keyId: string): string;
export declare function ciLogin(apiUrl: string, token: string, projectId: string, clientFactory?: HttpClientFactory): Promise<LoginResponse>;
export declare function getSecrets(apiUrl: string, sessionToken: string, projectId: string, environment: string, clientFactory?: HttpClientFactory): Promise<SecretsResponse>;
export declare function decryptSecret(blob: VaultBlob): string;
export declare function run(inputs?: ActionInputs, clientFactory?: HttpClientFactory, retryDelays?: number[]): Promise<void>;
export {};
