import requests

BASE_URL = "http://localhost:8000/api"
TIMEOUT = 30

def test_get_api_projects_audit_logs_authorized():
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})

    # Step 1: Sign up a temporary user
    signup_data = {
        "email": "testuser_tc009@example.com",
        "password": "StrongPassword123!"
    }
    signup_resp = session.post(f"{BASE_URL}/auth/signup", json=signup_data, timeout=TIMEOUT)
    assert signup_resp.status_code == 201, f"Signup failed with status {signup_resp.status_code}"
    signup_json = signup_resp.json()
    user_id = signup_json.get("user_id")
    assert user_id is not None, f"Signup response missing user_id, got: {signup_json}"

    try:
        # Step 2: Log in to get session_token
        login_data = {
            "email": signup_data["email"],
            "password": signup_data["password"]
        }
        login_resp = session.post(f"{BASE_URL}/auth/login", json=login_data, timeout=TIMEOUT)
        assert login_resp.status_code == 200, f"Login failed with status {login_resp.status_code}"
        login_json = login_resp.json()
        session_token = login_json.get("session_token")
        assert session_token is not None, f"Login response missing session_token, got: {login_json}"

        auth_headers = {"Authorization": f"Bearer {session_token}", "Content-Type": "application/json"}

        # Step 3: Create a new project to get project_id
        project_data = {
            "name": "Test Project TC009",
            "description": "Project for testing audit logs retrieval"
        }
        project_resp = session.post(f"{BASE_URL}/projects", json=project_data, headers=auth_headers, timeout=TIMEOUT)
        assert project_resp.status_code == 201, f"Project creation failed with status {project_resp.status_code}"
        project_json = project_resp.json()
        project_id = project_json.get("project_id")
        assert project_id is not None, f"Project creation response missing project_id, got: {project_json}"

        # Step 4: GET audit logs for the project with Authorization
        audit_logs_resp = session.get(f"{BASE_URL}/projects/{project_id}/audit-logs", headers=auth_headers, timeout=TIMEOUT)
        assert audit_logs_resp.status_code == 200, f"Audit logs retrieval failed with status {audit_logs_resp.status_code}"
        audit_events = audit_logs_resp.json()
        assert isinstance(audit_events, list), f"Audit logs response is not a list, got: {audit_events}"

    finally:
        # Cleanup: Delete the created project and logout
        try:
            if 'project_id' in locals() and 'auth_headers' in locals():
                del_resp = session.delete(f"{BASE_URL}/projects/{project_id}", headers=auth_headers, timeout=TIMEOUT)
                assert del_resp.status_code in (200, 204), f"Project deletion failed with status {del_resp.status_code}"
        except Exception:
            pass
        try:
            if 'session_token' in locals() and 'auth_headers' in locals():
                logout_resp = session.post(f"{BASE_URL}/auth/logout", headers=auth_headers, timeout=TIMEOUT)
                assert logout_resp.status_code == 204, f"Logout failed with status {logout_resp.status_code}"
        except Exception:
            pass

test_get_api_projects_audit_logs_authorized()
