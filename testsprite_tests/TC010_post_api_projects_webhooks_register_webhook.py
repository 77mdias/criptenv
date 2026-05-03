import requests

BASE_URL = "http://localhost:8000/api"
TIMEOUT = 30

def test_post_api_projects_webhooks_register_webhook():
    session = requests.Session()
    try:
        # Step 1: Signup a test user
        signup_payload = {"name": "Test User TC010", "email": "testuser_tc010@example.com", "password": "StrongPass!123"}
        signup_resp = session.post(f"{BASE_URL}/auth/signup", json=signup_payload, timeout=TIMEOUT)
        assert signup_resp.status_code == 201, f"Signup failed: {signup_resp.text}"
        user_id = signup_resp.json().get("user_id")
        assert user_id, "user_id missing after signup"

        # Step 2: Login the test user to get session_token
        login_payload = {"email": signup_payload["email"], "password": signup_payload["password"]}
        login_resp = session.post(f"{BASE_URL}/auth/login", json=login_payload, timeout=TIMEOUT)
        assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
        session_token = login_resp.json().get("session_token")
        assert session_token, "session_token missing after login"
        headers = {"Authorization": f"Bearer {session_token}"}

        # Step 3: Create a project to obtain project_id
        project_payload = {"name": "Test Project TC010", "description": "Project for webhook test"}
        project_resp = session.post(f"{BASE_URL}/projects", json=project_payload, headers=headers, timeout=TIMEOUT)
        assert project_resp.status_code == 201, f"Project creation failed: {project_resp.text}"
        project_id = project_resp.json().get("project_id")
        assert project_id, "project_id missing after project creation"

        # Step 4: Register webhook with valid url and events
        webhook_payload = {
            "url": "https://example.com/webhook-receiver-tc010",
            "events": ["push", "rotate", "expiry"]
        }
        webhook_resp = session.post(f"{BASE_URL}/projects/{project_id}/webhooks", json=webhook_payload, headers=headers, timeout=TIMEOUT)
        assert webhook_resp.status_code == 201, f"Webhook registration failed: {webhook_resp.text}"
        webhook_id = webhook_resp.json().get("webhook_id")
        assert webhook_id, "webhook_id missing after webhook registration"

    finally:
        # Cleanup: Delete created webhook and project
        if 'webhook_id' in locals() and webhook_id:
            session.delete(f"{BASE_URL}/projects/{project_id}/webhooks/{webhook_id}", headers=headers, timeout=TIMEOUT)
        if 'project_id' in locals() and project_id:
            session.delete(f"{BASE_URL}/projects/{project_id}", headers=headers, timeout=TIMEOUT)
        # Logout user
        if 'session_token' in locals() and session_token:
            session.post(f"{BASE_URL}/auth/logout", headers=headers, timeout=TIMEOUT)

test_post_api_projects_webhooks_register_webhook()
