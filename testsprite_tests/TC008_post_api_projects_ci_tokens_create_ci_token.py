import requests
import uuid

BASE_URL = "http://localhost:8000/api/v1/health"
TIMEOUT = 30

def test_post_api_projects_ci_tokens_create_ci_token():
    # Step 1: Signup a new user
    signup_url = "http://localhost:8000/api/auth/signup"
    signup_payload = {
        "email": f"testuser_{uuid.uuid4()}@example.com",
        "password": "StrongPass!234"
    }
    signup_resp = requests.post(signup_url, json=signup_payload, timeout=TIMEOUT)
    assert signup_resp.status_code == 201, f"Signup failed: {signup_resp.text}"
    user_id = signup_resp.json().get("user_id")
    assert user_id, "No user_id returned on signup"

    # Step 2: Login with the new user
    login_url = "http://localhost:8000/api/auth/login"
    login_payload = {
        "email": signup_payload["email"],
        "password": signup_payload["password"]
    }
    login_resp = requests.post(login_url, json=login_payload, timeout=TIMEOUT)
    assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
    session_token = login_resp.json().get("session_token")
    assert session_token, "No session_token returned on login"
    headers = {"Authorization": f"Bearer {session_token}"}

    # Step 3: Create a new project (needed for project_id)
    create_project_url = "http://localhost:8000/api/projects"
    project_name = f"test_project_{uuid.uuid4()}"
    create_project_payload = {"name": project_name, "description": "Test project for CI token"}
    create_proj_resp = requests.post(create_project_url, json=create_project_payload, headers=headers, timeout=TIMEOUT)
    assert create_proj_resp.status_code == 201, f"Create project failed: {create_proj_resp.text}"
    project_id = create_proj_resp.json().get("project_id")
    assert project_id, "No project_id returned on project creation"

    try:
        # Step 4: Create CI token for the project
        ci_tokens_url = f"http://localhost:8000/api/projects/{project_id}/ci-tokens"
        ci_token_payload = {
            "name": "test_ci_token",
            "scopes": ["read_secrets", "pull_vault"]
        }
        create_ci_token_resp = requests.post(ci_tokens_url, json=ci_token_payload, headers=headers, timeout=TIMEOUT)
        assert create_ci_token_resp.status_code == 201, f"Create CI token failed: {create_ci_token_resp.text}"
        resp_json = create_ci_token_resp.json()

        # Validate response contains token_id and token_value(one-time)
        token_id = resp_json.get("token_id")
        token_value = resp_json.get("token_value")
        assert token_id, "token_id missing in response"
        assert token_value, "token_value missing in response"
        assert isinstance(token_value, str) and len(token_value) > 0

    finally:
        # Cleanup: delete the project to clean the created resources
        del_project_url = f"http://localhost:8000/api/projects/{project_id}"
        del_resp = requests.delete(del_project_url, headers=headers, timeout=TIMEOUT)
        assert del_resp.status_code == 204, f"Cleanup project delete failed: {del_resp.text}"

test_post_api_projects_ci_tokens_create_ci_token()
