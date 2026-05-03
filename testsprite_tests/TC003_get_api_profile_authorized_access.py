import requests

BASE_URL = "http://localhost:8000/api"
TIMEOUT = 30

def test_get_api_profile_authorized_access():
    signup_url = f"{BASE_URL}/auth/signup"
    login_url = f"{BASE_URL}/auth/login"
    profile_url = f"{BASE_URL}/profile"
    email = "testuser_tc003@example.com"
    password = "StrongPassword!123"
    name = "Test User"

    # Step 1: Signup new user
    signup_payload = {"email": email, "password": password, "name": name}
    signup_response = requests.post(signup_url, json=signup_payload, timeout=TIMEOUT)
    assert signup_response.status_code == 201, f"Signup failed: {signup_response.text}"
    user_id = signup_response.json().get("user_id")
    assert user_id, "Signup response missing user_id"

    try:
        # Step 2: Login to get session token
        login_payload = {"email": email, "password": password}
        login_response = requests.post(login_url, json=login_payload, timeout=TIMEOUT)
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        session_token = login_response.json().get("session_token")
        assert session_token, "Login response missing session_token"

        # Step 3: Fetch user profile with Authorization header
        headers = {"Authorization": f"Bearer {session_token}"}
        profile_response = requests.get(profile_url, headers=headers, timeout=TIMEOUT)
        assert profile_response.status_code == 200, f"Profile fetch failed: {profile_response.text}"
        profile_data = profile_response.json()
        # Validate profile data content minimally (e.g., contains email)
        assert isinstance(profile_data, dict), "Profile response not a JSON object"
        assert profile_data.get("email") == email, "Profile email mismatch"
        # Check no plaintext secrets or sensitive info appear in profile response keys
        forbidden_keys = ["password", "secret", "token"]
        lower_keys = [k.lower() for k in profile_data.keys()]
        for key in forbidden_keys:
            assert not any(key in k for k in lower_keys), f"Profile response contains forbidden key: {key}"
    finally:
        # Cleanup: There is no explicit user deletion endpoint in the provided schemas,
        # so no delete performed. If available, implement user cleanup here.
        pass

test_get_api_profile_authorized_access()
