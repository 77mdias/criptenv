import requests
import uuid

BASE_URL = "http://localhost:8000/api"


def test_post_api_auth_signup_user_creation():
    url = f"{BASE_URL}/auth/signup"
    # Unique email to prevent conflicts
    test_email = f"testuser_{uuid.uuid4().hex}@example.com"
    payload = {
        "email": test_email,
        "password": "ValidPassword123!"
    }
    headers = {
        "Content-Type": "application/json"
    }
    timeout = 30

    response = None
    try:
        response = requests.post(url, json=payload, headers=headers, timeout=timeout)
        assert response.status_code == 201, f"Expected 201 Created, got {response.status_code}"
        data = response.json()
        assert "user_id" in data, "Response JSON missing 'user_id'"
        assert isinstance(data["user_id"], str) and data["user_id"], "'user_id' should be a non-empty string"
    finally:
        if response is not None and response.status_code == 201:
            # Attempt to delete the created user if an endpoint existed to cleanup.
            # The PRD does not mention a user deletion endpoint, so skipping deletion.
            pass


test_post_api_auth_signup_user_creation()