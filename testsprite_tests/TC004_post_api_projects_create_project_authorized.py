import requests
import uuid

BASE_URL = "http://localhost:8000/api"

def test_post_api_projects_create_project_authorized():
    # First, create a test user and login to get a session_token for Authorization
    signup_url = f"{BASE_URL}/auth/signup"
    login_url = f"{BASE_URL}/auth/login"
    projects_url = f"{BASE_URL}/projects"

    test_email = f"testuser_{uuid.uuid4()}@example.com"
    test_password = "TestPassword123!"
    test_name = f"Test User {uuid.uuid4()}"

    # Signup payload including 'name' as required field
    signup_payload = {
        "email": test_email,
        "password": test_password,
        "name": test_name
    }

    # Signup user
    resp_signup = requests.post(signup_url, json=signup_payload, timeout=30)
    assert resp_signup.status_code == 201, f"Signup failed: {resp_signup.text}"
    user_id = resp_signup.json().get("user_id")
    assert user_id, "Signup response missing user_id"

    # Login payload
    login_payload = {
        "email": test_email,
        "password": test_password
    }

    # Login user to get session_token
    resp_login = requests.post(login_url, json=login_payload, timeout=30)
    assert resp_login.status_code == 200, f"Login failed: {resp_login.text}"
    session_token = resp_login.json().get("session_token")
    assert session_token, "Login response missing session_token"

    headers = {
        "Authorization": f"Bearer {session_token}",
        "Content-Type": "application/json"
    }

    # Project creation payload
    project_name = f"Test Project {uuid.uuid4()}"
    project_payload = {
        "name": project_name,
        "description": "Project created by test_post_api_projects_create_project_authorized"
    }

    created_project_id = None
    try:
        # Create project
        resp_create = requests.post(projects_url, json=project_payload, headers=headers, timeout=30)
        assert resp_create.status_code == 201, f"Project creation failed: {resp_create.text}"

        json_response = resp_create.json()
        created_project_id = json_response.get("project_id")
        assert created_project_id, "Response missing project_id"
    finally:
        # Cleanup: delete the created project if exists
        if created_project_id:
            delete_url = f"{projects_url}/{created_project_id}"
            del_resp = requests.delete(delete_url, headers=headers, timeout=30)
            # Accept 204 No Content as successful deletion
            assert del_resp.status_code in (204, 404), f"Project cleanup failed: {del_resp.text}"

        # Logout user to clean session
        logout_url = f"{BASE_URL}/auth/logout"
        requests.post(logout_url, headers=headers, timeout=30)

test_post_api_projects_create_project_authorized()
