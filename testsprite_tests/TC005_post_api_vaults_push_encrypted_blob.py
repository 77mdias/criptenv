import requests
import uuid

BASE_URL = "http://localhost:8000/api/v1/health"
TIMEOUT = 30

def test_post_api_vaults_push_encrypted_blob():
    # Utility functions to create user, login, create project, create environment and cleanup
    def signup(email, password):
        url = "http://localhost:8000/api/auth/signup"
        payload = {"email": email, "password": password}
        r = requests.post(url, json=payload, timeout=TIMEOUT)
        r.raise_for_status()
        return r.json()["user_id"]

    def login(email, password):
        url = "http://localhost:8000/api/auth/login"
        payload = {"email": email, "password": password}
        r = requests.post(url, json=payload, timeout=TIMEOUT)
        r.raise_for_status()
        return r.json()["session_token"]

    def create_project(token, name, description):
        url = "http://localhost:8000/api/projects"
        headers = {"Authorization": f"Bearer {token}"}
        payload = {"name": name, "description": description}
        r = requests.post(url, json=payload, headers=headers, timeout=TIMEOUT)
        r.raise_for_status()
        return r.json()["project_id"]

    def create_environment(token, project_id, name):
        url = f"http://localhost:8000/api/projects/{project_id}/environments"
        headers = {"Authorization": f"Bearer {token}"}
        payload = {"name": name}
        r = requests.post(url, json=payload, headers=headers, timeout=TIMEOUT)
        r.raise_for_status()
        return r.json()["env_id"]

    def delete_project(token, project_id):
        url = f"http://localhost:8000/api/projects/{project_id}"
        headers = {"Authorization": f"Bearer {token}"}
        # Assuming DELETE /api/projects/{project_id} is supported for cleanup
        r = requests.delete(url, headers=headers, timeout=TIMEOUT)
        if r.status_code not in (204, 404):
            r.raise_for_status()

    # Setup test user credentials and resource names
    test_email = f"testuser_{uuid.uuid4()}@example.com"
    test_password = "TestPass123!"
    project_name = f"Project_{uuid.uuid4()}"
    project_description = "Test project for vault push"
    environment_name = f"Env_{uuid.uuid4()}"

    user_id = signup(test_email, test_password)
    session_token = login(test_email, test_password)

    project_id = None
    env_id = None

    try:
        project_id = create_project(session_token, project_name, project_description)
        env_id = create_environment(session_token, project_id, environment_name)

        url = f"http://localhost:8000/api/vaults/{project_id}/{env_id}/push"
        headers = {
            "Authorization": f"Bearer {session_token}",
            "Content-Type": "application/json"
        }

        # Simulate an encrypted blob (base64 or hex string typically, here just a dummy string)
        encrypted_blob = "VGhpcyBpcyBhIGR1bW15IGVuY3J5cHRlZCBibG9iIGZvciB0ZXN0aW5nLg=="

        payload = {"encrypted_blob": encrypted_blob}

        response = requests.post(url, json=payload, headers=headers, timeout=TIMEOUT)
        assert response.status_code == 200, f"Expected status code 200, got {response.status_code}"
        # Response might be an acknowledgement message; check it doesn't contain plaintext secrets
        json_resp = response.json()
        assert "ack" in json_resp or "status" in json_resp, "Response missing acknowledgement"
        # Ensure no plaintext secret exposure (no 'secret', 'plaintext' keys)
        forbidden_keys = {"secret", "plaintext", "password"}
        assert not any(k in json_resp for k in forbidden_keys), "Plaintext secrets exposed in response"
    finally:
        if project_id:
            delete_project(session_token, project_id)

test_post_api_vaults_push_encrypted_blob()