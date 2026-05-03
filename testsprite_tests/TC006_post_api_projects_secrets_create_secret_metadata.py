import requests
import uuid

BASE_URL = "http://localhost:8000/api/v1/health"

# Helper functions for authentication and resource setup

def signup_user(email, password):
    url = f"http://localhost:8000/api/auth/signup"
    payload = {"email": email, "password": password}
    headers = {"Content-Type": "application/json"}
    response = requests.post(url, json=payload, headers=headers, timeout=30)
    response.raise_for_status()
    return response.json()["user_id"]

def login_user(email, password):
    url = f"http://localhost:8000/api/auth/login"
    payload = {"email": email, "password": password}
    headers = {"Content-Type": "application/json"}
    response = requests.post(url, json=payload, headers=headers, timeout=30)
    response.raise_for_status()
    return response.json()["session_token"]

def create_project(session_token, name, description):
    url = f"http://localhost:8000/api/projects"
    headers = {"Authorization": f"Bearer {session_token}", "Content-Type": "application/json"}
    payload = {"name": name, "description": description}
    response = requests.post(url, json=payload, headers=headers, timeout=30)
    response.raise_for_status()
    return response.json()["project_id"]

def delete_project(session_token, project_id):
    url = f"http://localhost:8000/api/projects/{project_id}"
    headers = {"Authorization": f"Bearer {session_token}"}
    # Assuming DELETE /api/projects/{project_id} exists to clean up projects, else skip this
    requests.delete(url, headers=headers, timeout=30)

def create_environment(session_token, project_id, env_name):
    url = f"http://localhost:8000/api/projects/{project_id}/environments"
    headers = {"Authorization": f"Bearer {session_token}", "Content-Type": "application/json"}
    payload = {"name": env_name}
    response = requests.post(url, json=payload, headers=headers, timeout=30)
    response.raise_for_status()
    return response.json()["env_id"]

def delete_environment(session_token, project_id, env_id):
    url = f"http://localhost:8000/api/projects/{project_id}/environments/{env_id}"
    headers = {"Authorization": f"Bearer {session_token}"}
    # Assuming DELETE /api/projects/{project_id}/environments/{env_id} exists, else skip cleanup
    requests.delete(url, headers=headers, timeout=30)

def delete_secret(session_token, project_id, secret_id):
    url = f"http://localhost:8000/api/projects/{project_id}/secrets/{secret_id}"
    headers = {"Authorization": f"Bearer {session_token}"}
    requests.delete(url, headers=headers, timeout=30)

def test_post_api_projects_secrets_create_secret_metadata():
    # Setup user credentials
    test_email = f"testuser_{uuid.uuid4()}@example.com"
    test_password = "StrongPass!123"

    # Signup and login to obtain session_token
    user_id = signup_user(test_email, test_password)
    session_token = login_user(test_email, test_password)

    headers = {"Authorization": f"Bearer {session_token}"}

    # Create a new project for this test
    project_name = f"Test Project {uuid.uuid4()}"
    project_description = "Project created for TC006 secret metadata creation test."
    project_id = create_project(session_token, project_name, project_description)

    # Create an environment in the project (required for secret creation)
    env_name = f"TestEnv-{uuid.uuid4()}"
    env_id = create_environment(session_token, project_id, env_name)

    secret_id = None
    try:
        # Prepare encrypted secret metadata payload per API schema:
        # Must include env_id, key, encrypted_value, and optional metadata.
        # encrypted_value must be opaque (no plaintext).
        secret_payload = {
            "env_id": env_id,
            "key": "API_SECRET_KEY",
            "encrypted_value": "ZmFrZUVuY3J5cHRlZFZhbHVlMTIzNDU2",  # base64 string to simulate encrypted data
            "metadata": {
                "description": "Test secret metadata for TC006",
                "tags": ["automated-test", "secret"]
            }
        }
        url = f"http://localhost:8000/api/projects/{project_id}/secrets"
        headers_secret = {"Authorization": f"Bearer {session_token}", "Content-Type": "application/json"}
        response = requests.post(url, json=secret_payload, headers=headers_secret, timeout=30)

        # Validate response status code 201 Created
        assert response.status_code == 201, f"Expected status 201, got {response.status_code}"

        json_response = response.json()
        assert "secret_id" in json_response, "Response JSON missing secret_id"
        secret_id = json_response["secret_id"]
        assert isinstance(secret_id, str) and secret_id.strip() != "", "Invalid secret_id value"
    finally:
        # Cleanup: delete created secret, environment, and project to keep test idempotent
        if secret_id:
            try:
                delete_secret(session_token, project_id, secret_id)
            except Exception:
                pass
        if env_id:
            try:
                delete_environment(session_token, project_id, env_id)
            except Exception:
                pass
        if project_id:
            try:
                delete_project(session_token, project_id)
            except Exception:
                pass


test_post_api_projects_secrets_create_secret_metadata()
