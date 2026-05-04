from sqlalchemy.orm import Session
from typing import Optional, List, TYPE_CHECKING
from uuid import UUID

from app.models.user import User
from app.models.permission import UserPagePermission, UserPermission

if TYPE_CHECKING:
    from app.schemas.permission import ModulePermissionResponse


def check_user_permission(db: Session, user: User, page_key: str) -> str:
    """
    Check user's permission level for a specific page.
    
    Permission evaluation order (per PRD #0):
    1. Admin override - admins have full access to everything
    2. Explicit page permission
    3. Default to 'none'
    
    Args:
        db: Database session
        user: User object
        page_key: Page key to check permission for
    
    Returns:
        Permission level: 'none', 'read', or 'full'
    """
    # Admin override - admins bypass all permission checks
    if user.user_type == "Admin":
        return "full"
    
    # Check explicit page permission
    from app.models.page import Page
    
    page = db.query(Page).filter(Page.key == page_key).first()
    if not page:
        return "none"
    
    permission = db.query(UserPagePermission).filter(
        UserPagePermission.user_id == user.id,
        UserPagePermission.page_id == page.id
    ).first()
    
    if permission:
        return permission.access
    
    # Default to no access
    return "none"


def get_user_hierarchy(db: Session, user_id: UUID) -> List[User]:
    """
    Get all subordinates for a user (recursive).
    
    Args:
        db: Database session
        user_id: User ID to get subordinates for
    
    Returns:
        List of all subordinate users
    """
    subordinates = []
    
    # Get direct subordinates
    direct_subordinates = db.query(User).filter(User.manager_id == user_id).all()
    
    for subordinate in direct_subordinates:
        subordinates.append(subordinate)
        # Recursively get subordinates of subordinates
        subordinates.extend(get_user_hierarchy(db, subordinate.id))
    
    return subordinates


MODULE_PERMISSION_LEVELS = {
    "none": 0,
    "view": 1,
    "edit": 2,
    "delete": 3,
}


def user_has_permission(user_id: UUID, module: str, required_level: str, db: Session) -> bool:
    """
    Check whether a user has at least the required module access level.

    Hierarchy: delete > edit > view > none
    Admin users always return True.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return False

    if user.user_type == "Admin":
        return True

    required_rank = MODULE_PERMISSION_LEVELS.get(required_level)
    if required_rank is None:
        return False

    permission = db.query(UserPermission).filter(
        UserPermission.user_id == user_id,
        UserPermission.module == module,
    ).first()

    effective_level = permission.access_level if permission else "none"
    effective_rank = MODULE_PERMISSION_LEVELS.get(effective_level, 0)
    return effective_rank >= required_rank


def get_user_module_permissions_map(db: Session, user_id: UUID) -> dict[str, str]:
    """
    Map module -> access_level for all ALLOWED_MODULES.
    Admins: every module is 'delete'. Non-admins: DB row or 'none' for missing modules.
    """
    from app.schemas.permission import ALLOWED_MODULES

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return {m: "none" for m in ALLOWED_MODULES}
    if user.user_type == "Admin":
        return {m: "delete" for m in ALLOWED_MODULES}

    existing = db.query(UserPermission).filter(UserPermission.user_id == user_id).all()
    by_module = {row.module: row.access_level for row in existing}
    return {m: by_module.get(m, "none") for m in ALLOWED_MODULES}


def get_user_module_permissions_rows(db: Session, user_id: UUID) -> List["ModulePermissionResponse"]:
    """Full module permission list (same rules as get_user_module_permissions_map)."""
    from app.schemas.permission import ModulePermissionResponse, ALLOWED_MODULES

    perms = get_user_module_permissions_map(db, user_id)
    return [
        ModulePermissionResponse(module=m, access_level=perms[m])
        for m in ALLOWED_MODULES
    ]
