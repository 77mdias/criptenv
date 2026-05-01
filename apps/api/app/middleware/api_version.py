"""API Version Middleware

Adds X-API-Version header to all responses and handles invalid version requests.
Implements M3.4 API versioning requirements.
"""

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

API_VERSION = "1.0"
VALID_VERSIONS = ["v1", "1.0"]


class APIVersionMiddleware(BaseHTTPMiddleware):
    """Middleware that adds API version header and handles version routing.
    
    Valid requests (no version or /api/v1/) pass through with X-API-Version header.
    Invalid versions (e.g., /api/v2/) return 400 Bad Request.
    """
    
    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        
        # Skip non-API paths
        if not path.startswith("/api/"):
            response = await call_next(request)
            return response
        
        # Check for API version prefix
        if path.startswith("/api/v"):
            # Extract version (e.g., "v1", "v2", "v1.0")
            parts = path.split("/")
            if len(parts) >= 3:
                version = parts[2]  # e.g., "v1", "v2"
                version_number = version.replace("v", "")  # e.g., "1", "2"
                
                # Invalid version check
                if version_number != "1":
                    return JSONResponse(
                        status_code=400,
                        content={
                            "error": {
                                "code": "INVALID_API_VERSION",
                                "message": f"API version '{version}' is not supported. Please use v1.",
                                "details": {
                                    "supported_version": "v1",
                                    "received_version": version
                                }
                            }
                        }
                    )
        
        # Process request
        response = await call_next(request)
        
        # Add API version header to all API responses
        response.headers["X-API-Version"] = API_VERSION
        
        return response