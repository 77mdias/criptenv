"""Tests for transactional email markup."""

from app.services.email_service import EmailService


def test_cta_button_uses_mobile_safe_centered_table_markup():
    html = EmailService._cta_button("https://example.com/invite", "Accept Invitation")

    assert 'width="100%"' in html
    assert 'align="center"' in html
    assert "box-sizing:border-box" in html
    assert 'class="btn"' not in html
    assert "max-width:280px" in html
