"""Error schemas for consistent API error responses.

Implements M3.4.6 OpenAPI documentation with standardized error formats.
"""

from pydantic import BaseModel, Field
from typing import Optional, Any
from datetime import datetime


class APIErrorDetail(BaseModel):
    """Detailed error information."""
    code: str = Field(..., description="Error code (e.g., TOKEN_EXPIRED, VALIDATION_ERROR)")
    message: str = Field(..., description="Human-readable error message")
    details: Optional[dict[str, Any]] = Field(None, description="Additional context")
    request_id: Optional[str] = Field(None, description="Request ID for support")


class ErrorResponse(BaseModel):
    """Standard error response format for all API errors."""
    error: APIErrorDetail = Field(..., description="Error details")
    
    class Config:
        json_schema_extra = {
            "example": {
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": "Invalid input provided",
                    "details": {"field": "email", "reason": "invalid format"},
                    "request_id": "req_abc123"
                }
            }
        }


class ValidationErrorItem(BaseModel):
    """Single validation error item."""
    loc: list[str] = Field(..., description="Location of the error (e.g., ['body', 'email'])")
    msg: str = Field(..., description="Error message")
    type: str = Field(..., description="Error type")


class ValidationErrorResponse(BaseModel):
    """FastAPI validation error response format."""
    detail: list[ValidationErrorItem] = Field(..., description="List of validation errors")


class UnauthorizedErrorResponse(BaseModel):
    """401 Unauthorized response."""
    error: APIErrorDetail = Field(..., description="Authentication error details")
    
    class Config:
        json_schema_extra = {
            "example": {
                "error": {
                    "code": "UNAUTHORIZED",
                    "message": "Invalid or expired token",
                    "details": None,
                    "request_id": "req_abc123"
                }
            }
        }


class ForbiddenErrorResponse(BaseModel):
    """403 Forbidden response."""
    error: APIErrorDetail = Field(..., description="Authorization error details")
    
    class Config:
        json_schema_extra = {
            "example": {
                "error": {
                    "code": "FORBIDDEN",
                    "message": "Insufficient permissions to access this resource",
                    "details": {"required_scope": "write:secrets"},
                    "request_id": "req_abc123"
                }
            }
        }


class NotFoundErrorResponse(BaseModel):
    """404 Not Found response."""
    error: APIErrorDetail = Field(..., description="Resource not found error")
    
    class Config:
        json_schema_extra = {
            "example": {
                "error": {
                    "code": "NOT_FOUND",
                    "message": "The requested resource was not found",
                    "details": {"resource_type": "project", "resource_id": "uuid"},
                    "request_id": "req_abc123"
                }
            }
        }


class RateLimitErrorResponse(BaseModel):
    """429 Too Many Requests response."""
    error: APIErrorDetail = Field(..., description="Rate limit exceeded error")
    
    class Config:
        json_schema_extra = {
            "example": {
                "error": {
                    "code": "RATE_LIMIT_EXCEEDED",
                    "message": "Too many requests. Please slow down.",
                    "details": {
                        "limit": 1000,
                        "window": "60 seconds",
                        "retry_after": 30
                    },
                    "request_id": "req_abc123"
                }
            }
        }


class InternalServerErrorResponse(BaseModel):
    """500 Internal Server Error response."""
    error: APIErrorDetail = Field(..., description="Internal server error details")
    
    class Config:
        json_schema_extra = {
            "example": {
                "error": {
                    "code": "INTERNAL_ERROR",
                    "message": "An unexpected error occurred",
                    "details": None,
                    "request_id": "req_abc123"
                }
            }
        }