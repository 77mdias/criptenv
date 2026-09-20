from typing import Optional

from pydantic import AnyHttpUrl, BaseModel, Field


class AlertChannels(BaseModel):
    in_app: bool
    email: bool
    webhook: bool


def default_alert_channels() -> AlertChannels:
    return AlertChannels(in_app=True, email=False, webhook=False)


class AlertSettings(BaseModel):
    enabled: bool = True
    default_notify_days_before: int = Field(default=7, ge=1, le=365)
    channels: AlertChannels = Field(default_factory=default_alert_channels)
    webhook_url: Optional[AnyHttpUrl] = None


class AlertSettingsPatch(BaseModel):
    enabled: bool = True
    default_notify_days_before: int = Field(default=7, ge=1, le=365)
    channels: AlertChannels = Field(default_factory=default_alert_channels)
    webhook_url: Optional[AnyHttpUrl] = None


class AlertSettingsResponse(BaseModel):
    enabled: bool
    default_notify_days_before: int
    channels: AlertChannels
    webhook_url_preview: Optional[str] = None
    webhook_configured: bool
