import requests
import uuid

BASE_URL = "http://localhost:8000/api"
TIMEOUT = 30


def test_post_api_projects_invites_create_invite():
    # Helper to create user and login, returning session token
    def signup_and_login(email, password):
        signup_resp = requests.post(
            f"{BASE_URL}/auth/signup",
            json={"email": email, "password": password},
            timeout=TIMEOUT,
        )
        assert signup_resp.status_code == 201
        user_id = signup_resp.json().get("user_id")
        assert user_id and isinstance(user_id, str)
        login_resp = requests.post(
            f"{BASE_URL}/auth/login",
            json={"email": email, "password": password},
            timeout=TIMEOUT,
        )
        assert login_resp.status_code == 200
        session_token = login_resp.json().get("session_token")
        assert session_token and isinstance(session_token, str)
        return session_token

    # Helper to create a project, returns project_id
    def create_project(auth_token, project_name):
        resp = requests.post(
            f"{BASE_URL}/projects",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"name": project_name, "description": "Test project for invites"},
            timeout=TIMEOUT,
        )
        assert resp.status_code == 201
        project_id = resp.json().get("project_id")
        assert project_id and isinstance(project_id, str)
        return project_id

    # Create owner user and login
    owner_email = f"owner_{uuid.uuid4().hex}@example.com"
    owner_password = "TestPass123!"
    owner_token = signup_and_login(owner_email, owner_password)

    # Create a project to invite collaborators to
    project_name = f"Project_{uuid.uuid4().hex[:8]}"
    project_id = create_project(owner_token, project_name)

    # Invitee email and role
    invitee_email = f"invitee_{uuid.uuid4().hex}@example.com"
    invite_role = "member"

    headers = {"Authorization": f"Bearer {owner_token}"}
    invite_payload = {"email": invitee_email, "role": invite_role}

    try:
        # Send invite POST request
        invite_resp = requests.post(
            f"{BASE_URL}/projects/{project_id}/invites",
            headers=headers,
            json=invite_payload,
            timeout=TIMEOUT,
        )

        assert invite_resp.status_code == 201
        data = invite_resp.json()
        invite_id = data.get("invite_id")
        invite_token = data.get("invite_token")

        assert invite_id and isinstance(invite_id, str)
        assert invite_token and isinstance(invite_token, str)

        # Check zero-knowledge: no plaintext secrets or sensitive info exposed
        for val in data.values():
            if isinstance(val, str):
                assert "secret" not in val.lower()
                assert "password" not in val.lower()
                # token is allowed if it's the invite_token itself
                assert "token" not in val.lower() or val == invite_token

    finally:
        # Cleanup: delete the project to avoid side effects
        if 'project_id' in locals():
            requests.delete(
                f"{BASE_URL}/projects/{project_id}",
                headers={"Authorization": f"Bearer {owner_token}"},
                timeout=TIMEOUT,
            )


test_post_api_projects_invites_create_invite()
