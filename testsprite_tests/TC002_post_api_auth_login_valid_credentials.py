import requests

def test_post_api_auth_login_valid_credentials():
    base_url = "http://localhost:8000/api"
    login_url = base_url + "/auth/login"
    payload = {
        "email": "testuser@example.com",
        "password": "ValidPassword123!"
    }
    headers = {
        "Content-Type": "application/json"
    }
    response = requests.post(login_url, json=payload, headers=headers, timeout=30)
    assert response.status_code == 200, f"Expected status code 200, got {response.status_code}"
    json_response = response.json()
    assert "session_token" in json_response, "Response missing 'session_token'"
    session_token = json_response["session_token"]
    assert isinstance(session_token, str) and len(session_token) > 0, "'session_token' should be non-empty string"

test_post_api_auth_login_valid_credentials()