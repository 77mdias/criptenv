"""Email service using Resend for transactional emails."""

from datetime import datetime, timezone
from typing import Optional

import resend

from app.config import settings


class EmailService:
    """Transactional email service powered by Resend.

    Provides professionally designed HTML emails with dark-theme branding
    aligned with CriptEnv's identity. All emails include plain-text fallbacks.
    """

    def __init__(self):
        self.enabled = bool(settings.RESEND_API_KEY)
        if self.enabled:
            resend.api_key = settings.RESEND_API_KEY

    # ─── Base Template ────────────────────────────────────────────────────────

    @staticmethod
    def _base_template(title: str, content_html: str, preheader: str = "") -> str:
        """Wrap content in a professional dark-themed email layout."""
        return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{title}</title>
  <style>
    @media only screen and (max-width: 600px) {{
      .container {{ width: 100% !important; padding: 16px !important; }}
      .btn {{ width: 100% !important; display: block !important; text-align: center !important; }}
    }}
  </style>
</head>
<body style="margin:0;padding:0;background-color:#0b0f19;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <span style="display:none;font-size:1px;color:#0b0f19;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">{preheader}</span>

  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#0b0f19;">
    <tr>
      <td align="center" style="padding: 40px 16px 24px;">
        <table role="presentation" class="container" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;width:100%;background-color:#111827;border-radius:12px;overflow:hidden;border:1px solid #1f2937;">
          <!-- Header -->
          <tr>
            <td style="padding:32px 32px 24px;text-align:center;border-bottom:1px solid #1f2937;">
              <div style="font-size:24px;font-weight:700;color:#e5e7eb;letter-spacing:-0.5px;">
                🔐 CriptEnv
              </div>
              <div style="font-size:12px;color:#6b7280;margin-top:4px;letter-spacing:0.5px;text-transform:uppercase;">
                Zero-Knowledge Secret Management
              </div>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding:32px;">
              {content_html}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 32px 32px;border-top:1px solid #1f2937;text-align:center;">
              <p style="margin:0 0 8px;font-size:13px;color:#6b7280;">
                CriptEnv — Secure by design. Your secrets never leave your device unencrypted.
              </p>
              <p style="margin:0;font-size:12px;color:#4b5563;">
                Need help? Reply to this email or visit our <a href="{settings.FRONTEND_URL}/support" style="color:#818cf8;text-decoration:none;">Support Center</a>.
              </p>
              <p style="margin:16px 0 0;font-size:11px;color:#374151;">
                © {datetime.now(timezone.utc).year} CriptEnv. All rights reserved.<br>
                This is an automated message. Please do not reply directly if you require assistance.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""

    @staticmethod
    def _cta_button(url: str, label: str) -> str:
        """Generate a styled call-to-action button."""
        return f"""
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:28px 0;">
          <tr>
            <td style="border-radius:8px;background:linear-gradient(135deg,#4f46e5,#6366f1);" align="center">
              <a href="{url}" class="btn" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;letter-spacing:0.3px;">
                {label}
              </a>
            </td>
          </tr>
        </table>
        """

    @staticmethod
    def _security_box(content: str) -> str:
        """Generate a security notice box."""
        return f"""
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0;background-color:#1e1b4b;border-left:4px solid #6366f1;border-radius:6px;">
          <tr>
            <td style="padding:16px 20px;">
              <p style="margin:0;font-size:13px;color:#c7d2fe;line-height:1.6;">🔒 <strong>Security Notice:</strong> {content}</p>
            </td>
          </tr>
        </table>
        """

    @staticmethod
    def _url_box(url: str) -> str:
        """Generate a styled URL display box for plain-text fallback."""
        return f"""
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:16px 0;background-color:#1f2937;border-radius:6px;">
          <tr>
            <td style="padding:14px 18px;word-break:break-all;">
              <code style="font-size:13px;color:#a5b4fc;">{url}</code>
            </td>
          </tr>
        </table>
        """

    def _send(self, to: str, subject: str, html: str, text: Optional[str] = None) -> Optional[dict]:
        """Send an email via Resend."""
        if not self.enabled:
            return {"id": "dev-mock-email-id", "mock": True}

        params: resend.Emails.SendParams = {
            "from": settings.EMAIL_FROM,
            "to": [to],
            "subject": subject,
            "html": html,
        }
        if text:
            params["text"] = text

        return resend.Emails.send(params)

    # ─── Email: Password Reset ────────────────────────────────────────────────

    def send_password_reset(self, to: str, reset_url: str, expires_minutes: int = 60) -> Optional[dict]:
        """Send a professionally styled password reset email."""
        expires_text = f"{expires_minutes} minutes" if expires_minutes < 120 else f"{expires_minutes // 60} hours"

        content = f"""
        <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#f3f4f6;">Reset Your Password</h1>
        <p style="margin:0 0 16px;font-size:15px;color:#d1d5db;line-height:1.6;">
          We received a request to reset the password for your CriptEnv account (<strong style="color:#e5e7eb;">{to}</strong>).
          If you made this request, click the button below to choose a new password.
        </p>
        {self._cta_button(reset_url, "Reset Password")}
        <p style="margin:0 0 8px;font-size:13px;color:#9ca3af;">
          Or copy and paste this link into your browser:
        </p>
        {self._url_box(reset_url)}
        <p style="margin:16px 0 0;font-size:13px;color:#9ca3af;">
          This link expires in <strong style="color:#d1d5db;">{expires_text}</strong> and can only be used once.
        </p>
        {self._security_box("If you did not request a password reset, you can safely ignore this email. Your account remains secure and no changes have been made. If you are concerned, we recommend enabling Two-Factor Authentication in your account settings.")}
        """

        html = self._base_template(
            title="Reset Your CriptEnv Password",
            content_html=content,
            preheader="Reset your CriptEnv password securely."
        )

        text = f"""Reset Your Password — CriptEnv

We received a request to reset the password for your CriptEnv account ({to}).

If you made this request, use the link below to choose a new password:
{reset_url}

This link expires in {expires_text} and can only be used once.

SECURITY NOTICE: If you did not request a password reset, you can safely ignore this email. Your account remains secure and no changes have been made. If you are concerned, we recommend enabling Two-Factor Authentication in your account settings.

—
CriptEnv — Zero-Knowledge Secret Management
Need help? Visit {settings.FRONTEND_URL}/support
"""
        return self._send(to, "Reset your CriptEnv password", html, text)

    # ─── Email: 2FA Enabled ───────────────────────────────────────────────────

    def send_2fa_enabled(self, to: str) -> Optional[dict]:
        """Notify user that Two-Factor Authentication was enabled."""
        content = """
        <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#f3f4f6;">Two-Factor Authentication Enabled</h1>
        <p style="margin:0 0 16px;font-size:15px;color:#d1d5db;line-height:1.6;">
          Two-Factor Authentication (2FA) has been successfully enabled on your CriptEnv account.
          From now on, you will be required to enter a verification code from your authenticator app
          every time you sign in on a new device or browser.
        </p>
        <p style="margin:0 0 16px;font-size:15px;color:#d1d5db;line-height:1.6;">
          This adds an essential layer of protection to your secrets, ensuring that even if your
          password is compromised, your account remains inaccessible without the second factor.
        </p>
        """ + self._security_box(
            "If you did not enable 2FA yourself, your account may be compromised. "
            "Please <a href=\"" + settings.FRONTEND_URL + "/account/security\" style=\"color:#a5b4fc;text-decoration:underline;\">review your security settings</a> immediately "
            "and contact our support team if you need assistance securing your account."
        )

        html = self._base_template(
            title="2FA Enabled — CriptEnv",
            content_html=content,
            preheader="Two-Factor Authentication has been enabled on your account."
        )

        text = f"""Two-Factor Authentication Enabled — CriptEnv

Two-Factor Authentication (2FA) has been successfully enabled on your CriptEnv account.
From now on, you will be required to enter a verification code from your authenticator app every time you sign in on a new device or browser.

This adds an essential layer of protection to your secrets, ensuring that even if your password is compromised, your account remains inaccessible without the second factor.

SECURITY NOTICE: If you did not enable 2FA yourself, your account may be compromised. Please review your security settings immediately at {settings.FRONTEND_URL}/account/security and contact our support team if you need assistance securing your account.

—
CriptEnv — Zero-Knowledge Secret Management
Need help? Visit {settings.FRONTEND_URL}/support
"""
        return self._send(to, "2FA enabled on your CriptEnv account", html, text)

    # ─── Email: Account Deleted ───────────────────────────────────────────────

    def send_account_deleted(self, to: str) -> Optional[dict]:
        """Notify user that their account has been permanently deleted."""
        content = """
        <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#f3f4f6;">Account Deleted</h1>
        <p style="margin:0 0 16px;font-size:15px;color:#d1d5db;line-height:1.6;">
          Your CriptEnv account has been permanently deleted. We're sorry to see you go.
        </p>
        <p style="margin:0 0 16px;font-size:15px;color:#d1d5db;line-height:1.6;">
          All data associated with your account — including projects, environments, encrypted vault blobs,
          API keys, and audit logs — has been permanently removed from our systems in accordance with
          our data retention policy. This action is irreversible.
        </p>
        <p style="margin:0 0 16px;font-size:15px;color:#d1d5db;line-height:1.6;">
          If you did not initiate this deletion, please contact our security team immediately.
        </p>
        """ + self._security_box(
            "If you believe this deletion was unauthorized, reach out to us at support@criptenv.dev "
            "with your account email and any relevant details. We take account security very seriously."
        )

        html = self._base_template(
            title="Account Deleted — CriptEnv",
            content_html=content,
            preheader="Your CriptEnv account has been permanently deleted."
        )

        text = f"""Account Deleted — CriptEnv

Your CriptEnv account has been permanently deleted. We're sorry to see you go.

All data associated with your account — including projects, environments, encrypted vault blobs, API keys, and audit logs — has been permanently removed from our systems in accordance with our data retention policy. This action is irreversible.

If you did not initiate this deletion, please contact our security team immediately.

SECURITY NOTICE: If you believe this deletion was unauthorized, reach out to us at support@criptenv.dev with your account email and any relevant details. We take account security very seriously.

—
CriptEnv — Zero-Knowledge Secret Management
Need help? Visit {settings.FRONTEND_URL}/support
"""
        return self._send(to, "Your CriptEnv account has been deleted", html, text)

    # ─── Email: Email Verification ────────────────────────────────────────────

    def send_email_verification(self, to: str, verification_url: str, expires_hours: int = 24) -> Optional[dict]:
        """Send a professional email verification message."""
        expires_text = f"{expires_hours} hours" if expires_hours < 48 else f"{expires_hours // 24} days"

        content = f"""
        <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#f3f4f6;">Welcome to CriptEnv</h1>
        <p style="margin:0 0 16px;font-size:15px;color:#d1d5db;line-height:1.6;">
          Thanks for joining CriptEnv — the open-source, zero-knowledge secret management platform
          built for developers and teams who take security seriously.
        </p>
        <p style="margin:0 0 16px;font-size:15px;color:#d1d5db;line-height:1.6;">
          Before you can start managing your secrets, we need to verify your email address
          (<strong style="color:#e5e7eb;">{to}</strong>). This helps us protect your account and
          ensure important security notifications reach you.
        </p>
        {self._cta_button(verification_url, "Verify Email Address")}
        <p style="margin:0 0 8px;font-size:13px;color:#9ca3af;">
          Or copy and paste this link into your browser:
        </p>
        {self._url_box(verification_url)}
        <p style="margin:16px 0 0;font-size:13px;color:#9ca3af;">
          This verification link expires in <strong style="color:#d1d5db;">{expires_text}</strong>.
        </p>
        {self._security_box("If you did not create a CriptEnv account, you can safely ignore this email. No account will be activated and no data will be stored.")}
        <p style="margin:24px 0 0;font-size:14px;color:#9ca3af;line-height:1.6;border-top:1px solid #1f2937;padding-top:16px;">
          <strong style="color:#d1d5db;">What is CriptEnv?</strong><br>
          CriptEnv is a zero-knowledge secret management platform. Your secrets are encrypted
          client-side with AES-256-GCM before they ever reach our servers. We never see your plaintext.
        </p>
        """

        html = self._base_template(
            title="Verify Your Email — CriptEnv",
            content_html=content,
            preheader="Verify your email to activate your CriptEnv account."
        )

        text = f"""Welcome to CriptEnv

Thanks for joining CriptEnv — the open-source, zero-knowledge secret management platform built for developers and teams who take security seriously.

Before you can start managing your secrets, we need to verify your email address ({to}). This helps us protect your account and ensure important security notifications reach you.

Use the link below to verify your email:
{verification_url}

This verification link expires in {expires_text}.

SECURITY NOTICE: If you did not create a CriptEnv account, you can safely ignore this email. No account will be activated and no data will be stored.

—
What is CriptEnv?
CriptEnv is a zero-knowledge secret management platform. Your secrets are encrypted client-side with AES-256-GCM before they ever reach our servers. We never see your plaintext.

—
CriptEnv — Zero-Knowledge Secret Management
Need help? Visit {settings.FRONTEND_URL}/support
"""
        return self._send(to, "Verify your CriptEnv email address", html, text)

    # ─── Email: Welcome ───────────────────────────────────────────────────────

    def send_welcome(self, to: str, name: str = "") -> Optional[dict]:
        """Send a welcome email to newly verified users."""
        greeting = f"Hi {name}," if name else "Hi there,"

        content = f"""
        <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#f3f4f6;">You're all set, {name or "welcome aboard"}!</h1>
        <p style="margin:0 0 16px;font-size:15px;color:#d1d5db;line-height:1.6;">
          {greeting} Your email has been verified and your CriptEnv account is now fully active.
        </p>
        <p style="margin:0 0 16px;font-size:15px;color:#d1d5db;line-height:1.6;">
          Here's what you can do next:
        </p>
        <ul style="margin:0 0 20px;padding-left:20px;color:#d1d5db;font-size:15px;line-height:1.7;">
          <li>Create your first <strong style="color:#e5e7eb;">project</strong> to organize your secrets</li>
          <li>Set up <strong style="color:#e5e7eb;">environments</strong> (Production, Staging, Development)</li>
          <li>Push secrets via our <strong style="color:#e5e7eb;">CLI</strong> or the web dashboard</li>
          <li>Invite team members and control access with <strong style="color:#e5e7eb;">role-based permissions</strong></li>
          <li>Enable <strong style="color:#e5e7eb;">Two-Factor Authentication</strong> for extra security</li>
        </ul>
        {self._cta_button(settings.FRONTEND_URL + "/dashboard", "Go to Dashboard")}
        <p style="margin:16px 0 0;font-size:13px;color:#9ca3af;line-height:1.6;">
          Need help getting started? Check out our <a href="{settings.FRONTEND_URL}/docs" style="color:#818cf8;text-decoration:none;">Documentation</a>
          or reach out to our support team anytime.
        </p>
        """

        html = self._base_template(
            title="Welcome to CriptEnv",
            content_html=content,
            preheader="Your CriptEnv account is now active. Here's what to do next."
        )

        text = f"""Welcome to CriptEnv

You're all set, {name or "welcome aboard"}!

Your email has been verified and your CriptEnv account is now fully active.

Here's what you can do next:

• Create your first project to organize your secrets
• Set up environments (Production, Staging, Development)
• Push secrets via our CLI or the web dashboard
• Invite team members and control access with role-based permissions
• Enable Two-Factor Authentication for extra security

Go to your dashboard: {settings.FRONTEND_URL}/dashboard

Need help getting started? Check out our documentation at {settings.FRONTEND_URL}/docs or reach out to our support team anytime.

—
CriptEnv — Zero-Knowledge Secret Management
Need help? Visit {settings.FRONTEND_URL}/support
"""
        return self._send(to, "Welcome to CriptEnv — Your account is ready", html, text)

    # ─── Email: Project Invite ────────────────────────────────────────────────

    def send_project_invite(
        self,
        to: str,
        invite_url: str,
        project_name: str,
        role: str,
        invited_by_name: str = "",
        expires_days: int = 7
    ) -> Optional[dict]:
        """Send a project invitation email."""
        inviter_text = f" <strong style=\"color:#e5e7eb;\">{invited_by_name}</strong> has invited you" if invited_by_name else " You've been invited"

        content = f"""
        <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#f3f4f6;">Project Invitation</h1>
        <p style="margin:0 0 16px;font-size:15px;color:#d1d5db;line-height:1.6;">
          {inviter_text} to join the project <strong style="color:#e5e7eb;">{project_name}</strong> on CriptEnv
          with <strong style="color:#e5e7eb;">{role}</strong> access.
        </p>
        <p style="margin:0 0 16px;font-size:15px;color:#d1d5db;line-height:1.6;">
          CriptEnv is a zero-knowledge secret management platform. By accepting this invitation,
          you'll be able to securely manage environment variables, API keys, and sensitive credentials
          alongside your team — with full client-side encryption ensuring your secrets never leave
          your device unencrypted.
        </p>
        {self._cta_button(invite_url, "Accept Invitation")}
        <p style="margin:0 0 8px;font-size:13px;color:#9ca3af;">
          Or copy and paste this link into your browser:
        </p>
        {self._url_box(invite_url)}
        <p style="margin:16px 0 0;font-size:13px;color:#9ca3af;">
          This invitation expires in <strong style="color:#d1d5db;">{expires_days} days</strong>.
        </p>
        {self._security_box("If you were not expecting this invitation, you can safely ignore this email. No access will be granted unless you explicitly accept the invitation.")}
        """

        html = self._base_template(
            title=f"Invitation to join {project_name} — CriptEnv",
            content_html=content,
            preheader=f"You've been invited to join {project_name} on CriptEnv."
        )

        text = f"""Project Invitation — CriptEnv

{invited_by_name + " has invited you" if invited_by_name else "You've been invited"} to join the project "{project_name}" on CriptEnv with {role} access.

CriptEnv is a zero-knowledge secret management platform. By accepting this invitation, you'll be able to securely manage environment variables, API keys, and sensitive credentials alongside your team — with full client-side encryption ensuring your secrets never leave your device unencrypted.

Use the link below to accept the invitation:
{invite_url}

This invitation expires in {expires_days} days.

SECURITY NOTICE: If you were not expecting this invitation, you can safely ignore this email. No access will be granted unless you explicitly accept the invitation.

—
CriptEnv — Zero-Knowledge Secret Management
Need help? Visit {settings.FRONTEND_URL}/support
"""
        return self._send(to, f"Invitation to join {project_name} on CriptEnv", html, text)

    # ─── Email: Email Changed ─────────────────────────────────────────────────

    def send_email_changed(self, to: str, old_email: str) -> Optional[dict]:
        """Notify user that their account email address was changed."""
        content = f"""
        <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#f3f4f6;">Email Address Updated</h1>
        <p style="margin:0 0 16px;font-size:15px;color:#d1d5db;line-height:1.6;">
          The email address for your CriptEnv account has been successfully updated.
        </p>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:16px 0;background-color:#1f2937;border-radius:8px;">
          <tr>
            <td style="padding:20px 24px;">
              <p style="margin:0 0 8px;font-size:13px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;">Previous Email</p>
              <p style="margin:0;font-size:15px;color:#ef4444;font-weight:500;">{old_email}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 24px 20px;">
              <p style="margin:0 0 8px;font-size:13px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;">New Email</p>
              <p style="margin:0;font-size:15px;color:#34d399;font-weight:500;">{to}</p>
            </td>
          </tr>
        </table>
        <p style="margin:16px 0 0;font-size:15px;color:#d1d5db;line-height:1.6;">
          All future notifications, security alerts, and account-related communications will be sent to this new address.
        </p>
        {self._security_box("If you did not make this change, your account may have been compromised. Please change your password immediately and enable Two-Factor Authentication if you haven't already. Contact our support team for further assistance.")}
        """

        html = self._base_template(
            title="Email Updated — CriptEnv",
            content_html=content,
            preheader="Your CriptEnv account email address has been updated."
        )

        text = f"""Email Address Updated — CriptEnv

The email address for your CriptEnv account has been successfully updated.

Previous Email: {old_email}
New Email: {to}

All future notifications, security alerts, and account-related communications will be sent to this new address.

SECURITY NOTICE: If you did not make this change, your account may have been compromised. Please change your password immediately and enable Two-Factor Authentication if you haven't already. Contact our support team for further assistance.

—
CriptEnv — Zero-Knowledge Secret Management
Need help? Visit {settings.FRONTEND_URL}/support
"""
        return self._send(to, "Your CriptEnv email address has been updated", html, text)
