"""Email service using Resend for transactional emails."""

from datetime import datetime, timezone
from typing import Optional

import resend

from app.config import settings


class EmailService:
    """Transactional email service powered by Resend."""

    def __init__(self):
        self.enabled = bool(settings.RESEND_API_KEY)
        if self.enabled:
            resend.api_key = settings.RESEND_API_KEY

    def _send(self, to: str, subject: str, html: str, text: Optional[str] = None) -> Optional[dict]:
        """Send an email via Resend."""
        if not self.enabled:
            # In development without Resend key, log and return mock response
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

    def send_password_reset(self, to: str, reset_url: str, expires_minutes: int = 60) -> Optional[dict]:
        """Send password reset email with reset link."""
        html = f"""
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
            <h2>Password Reset Request</h2>
            <p>You requested a password reset for your CriptEnv account.</p>
            <p>Click the link below to reset your password. This link expires in {expires_minutes} minutes.</p>
            <p style="margin: 24px 0;">
                <a href="{reset_url}" 
                   style="background: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                    Reset Password
                </a>
            </p>
            <p style="color: #6b7280; font-size: 14px;">
                If you didn't request this, you can safely ignore this email.
            </p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
            <p style="color: #9ca3af; font-size: 12px;">
                CriptEnv — Zero-Knowledge Secret Management
            </p>
        </div>
        """
        text = f"""Password Reset Request\n\nYou requested a password reset for your CriptEnv account.\n\nClick the link below to reset your password (expires in {expires_minutes} minutes):\n{reset_url}\n\nIf you didn't request this, you can safely ignore this email."""
        return self._send(to, "Reset your CriptEnv password", html, text)

    def send_2fa_enabled(self, to: str) -> Optional[dict]:
        """Notify user that 2FA was enabled."""
        html = """
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
            <h2>Two-Factor Authentication Enabled</h2>
            <p>Two-factor authentication has been enabled on your CriptEnv account.</p>
            <p>If you didn't make this change, please contact support immediately.</p>
        </div>
        """
        text = "Two-Factor Authentication Enabled\n\nTwo-factor authentication has been enabled on your CriptEnv account.\n\nIf you didn't make this change, please contact support immediately."
        return self._send(to, "2FA enabled on your CriptEnv account", html, text)

    def send_account_deleted(self, to: str) -> Optional[dict]:
        """Notify user that account was deleted."""
        html = """
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
            <h2>Account Deleted</h2>
            <p>Your CriptEnv account has been permanently deleted.</p>
            <p>All associated data has been removed from our systems.</p>
        </div>
        """
        text = "Account Deleted\n\nYour CriptEnv account has been permanently deleted.\nAll associated data has been removed from our systems."
        return self._send(to, "Your CriptEnv account has been deleted", html, text)

    def send_email_verification(self, to: str, verification_url: str, expires_hours: int = 24) -> Optional[dict]:
        """Send email verification link."""
        html = f"""
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
            <h2>Verify your email address</h2>
            <p>Welcome to CriptEnv! Please verify your email address to complete your registration.</p>
            <p>Click the link below to verify your email. This link expires in {expires_hours} hours.</p>
            <p style="margin: 24px 0;">
                <a href="{verification_url}"
                   style="background: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                    Verify Email
                </a>
            </p>
            <p style="color: #6b7280; font-size: 14px;">
                If you didn't create an account, you can safely ignore this email.
            </p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
            <p style="color: #9ca3af; font-size: 12px;">
                CriptEnv — Zero-Knowledge Secret Management
            </p>
        </div>
        """
        text = f"""Verify your email address\n\nWelcome to CriptEnv! Please verify your email address to complete your registration.\n\nClick the link below to verify your email (expires in {expires_hours} hours):\n{verification_url}\n\nIf you didn't create an account, you can safely ignore this email."""
        return self._send(to, "Verify your CriptEnv email address", html, text)
