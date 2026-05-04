from pydantic import BaseModel, Field
from typing import Dict, List
from uuid import UUID


# Allowed access levels (application-level validation)
ALLOWED_ACCESS_LEVELS = ["none", "read", "full"]
ALLOWED_MODULES = ["tasks", "contacts", "companies", "projects", "cars", "analytics", "payments", "documents"]
ALLOWED_MODULE_ACCESS_LEVELS = ["none", "view", "edit", "delete"]


class PagePermissionItem(BaseModel):
    """Schema for a single page permission."""
    page_id: UUID
    access: str = Field(..., description="Must be one of: none, read, full")


class SetPermissionsRequest(BaseModel):
    """Schema for setting user page permissions."""
    permissions: List[PagePermissionItem]
    
    class Config:
        json_schema_extra = {
            "example": {
                "permissions": [
                    {"page_id": "123e4567-e89b-12d3-a456-426614174000", "access": "full"},
                    {"page_id": "223e4567-e89b-12d3-a456-426614174001", "access": "read"}
                ]
            }
        }


class PagePermissionResponse(BaseModel):
    """Schema for page permission response."""
    id: UUID
    user_id: UUID
    page_id: UUID
    access: str
    
    class Config:
        from_attributes = True


class ModulePermissionItem(BaseModel):
    module: str = Field(..., description="Module key")
    access_level: str = Field(..., description="Must be one of: none, view, edit, delete")


class SetModulePermissionsRequest(BaseModel):
    permissions: List[ModulePermissionItem]

    class Config:
        json_schema_extra = {
            "example": {
                "permissions": [
                    {"module": "tasks", "access_level": "delete"},
                    {"module": "analytics", "access_level": "view"},
                ]
            }
        }


class ModulePermissionResponse(BaseModel):
    module: str
    access_level: str


class CurrentUserModulePermissionsResponse(BaseModel):
    """GET /auth/me/module-permissions — module keys from ALLOWED_MODULES."""

    permissions: Dict[str, str]
