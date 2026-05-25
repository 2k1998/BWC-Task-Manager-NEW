from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import Optional, List
import secrets
import string
from uuid import UUID

from app.core.database import get_db
from app.core.deps import require_admin, require_hierarchy_manager
from app.core.security import hash_password
from app.models.user import User
from app.models.permission import UserPagePermission, UserPermission
from app.models.page import Page
from app.schemas.user import (
    UserCreate,
    UserUpdate,
    UserResponse,
    UserListResponse,
    UserTreeNodeResponse,
    ALLOWED_USER_TYPES,
)
from app.utils.hierarchy import (
    get_descendant_ids,
    get_visible_user_ids,
    validate_can_manage_target,
    validate_creatable_role,
    validate_parent_for_role,
    validate_parent_in_actor_subtree,
)
from app.schemas.permission import (
    SetPermissionsRequest,
    PagePermissionResponse,
    ALLOWED_ACCESS_LEVELS,
    SetModulePermissionsRequest,
    ModulePermissionResponse,
    ALLOWED_MODULES,
    ALLOWED_MODULE_ACCESS_LEVELS,
)
from app.utils.audit import create_audit_log
from app.utils.permissions import get_user_module_permissions_rows

router = APIRouter(prefix="/admin/users", tags=["Admin - User Management"])


def generate_temporary_password(length: int = 12) -> str:
    """Generate a random temporary password."""
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
    return ''.join(secrets.choice(alphabet) for _ in range(length))


def _build_user_module_permissions_response(user_id: UUID, db: Session) -> List[ModulePermissionResponse]:
    return get_user_module_permissions_rows(db, user_id)


def _user_to_tree_node(user: User) -> UserTreeNodeResponse:
    full_name = f"{user.first_name} {user.last_name}".strip()
    return UserTreeNodeResponse(
        id=user.id,
        full_name=full_name,
        email=user.email,
        user_type=user.user_type,
        parent_id=user.parent_id,
        children=[],
    )


def _build_tree_nodes(users: list[User]) -> list[UserTreeNodeResponse]:
    nodes = {u.id: _user_to_tree_node(u) for u in users}
    roots: list[UserTreeNodeResponse] = []
    for u in users:
        node = nodes[u.id]
        if u.parent_id and u.parent_id in nodes:
            nodes[u.parent_id].children.append(node)
        else:
            roots.append(node)
    return roots


def _scoped_users_for_tree(actor: User, db: Session) -> list[User]:
    if actor.user_type == "Admin":
        return db.query(User).filter(User.is_active.is_(True)).all()
    visible_ids = get_visible_user_ids(actor, db)
    if not visible_ids:
        return []
    return db.query(User).filter(User.id.in_(visible_ids)).all()


def _apply_user_update(
    user: User,
    user_data: UserUpdate,
    actor: User,
    db: Session,
) -> None:
    effective_role = user_data.user_type if user_data.user_type is not None else user.user_type

    if user_data.email is not None:
        existing = db.query(User).filter(User.email == user_data.email, User.id != user.id).first()
        if existing:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")
        user.email = user_data.email

    if user_data.username is not None:
        existing = db.query(User).filter(User.username == user_data.username, User.id != user.id).first()
        if existing:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username already taken")
        user.username = user_data.username

    if user_data.first_name is not None:
        user.first_name = user_data.first_name

    if user_data.last_name is not None:
        user.last_name = user_data.last_name

    if user_data.user_type is not None:
        if user_data.user_type not in ALLOWED_USER_TYPES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid user_type. Must be one of: {', '.join(ALLOWED_USER_TYPES)}",
            )
        if actor.user_type != "Admin":
            validate_creatable_role(actor.user_type, user_data.user_type)
        user.user_type = user_data.user_type

    if user_data.is_active is not None:
        user.is_active = user_data.is_active

    if "parent_id" in user_data.model_fields_set:
        parent_id = user_data.parent_id
        validate_parent_for_role(effective_role, parent_id, db, editing_user_id=user.id)
        if parent_id is not None:
            validate_parent_in_actor_subtree(actor, parent_id, db)
        user.parent_id = parent_id


@router.get("/me", response_model=UserResponse)
def get_current_user_info(
    current_user: User = Depends(require_hierarchy_manager),
):
    """
    Get current admin user's information.
    """
    return current_user


@router.post("", status_code=status.HTTP_201_CREATED)
def create_user(
    user_data: UserCreate,
    db: Session = Depends(get_db),
    actor: User = Depends(require_hierarchy_manager),
):
    """
    Create a new user (hierarchy managers).
    Generates temporary password and forces password change on first login.
    """
    if user_data.user_type not in ALLOWED_USER_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid user_type. Must be one of: {', '.join(ALLOWED_USER_TYPES)}",
        )

    validate_creatable_role(actor.user_type, user_data.user_type)
    validate_parent_for_role(user_data.user_type, user_data.parent_id, db)
    if user_data.parent_id is not None:
        validate_parent_in_actor_subtree(actor, user_data.parent_id, db)

    if db.query(User).filter(User.email == user_data.email).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

    if db.query(User).filter(User.username == user_data.username).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username already taken")

    temp_password = generate_temporary_password()

    new_user = User(
        email=user_data.email,
        username=user_data.username,
        first_name=user_data.first_name,
        last_name=user_data.last_name,
        hashed_password=hash_password(temp_password),
        user_type=user_data.user_type,
        parent_id=user_data.parent_id,
        force_password_change=True,
        is_active=True,
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    create_audit_log(
        db=db,
        admin_user_id=str(actor.id),
        target_user_id=str(new_user.id),
        action="create_user",
        before_state=None,
        after_state={
            "email": new_user.email,
            "username": new_user.username,
            "user_type": new_user.user_type,
            "parent_id": str(new_user.parent_id) if new_user.parent_id else None,
        },
    )

    return {
        "user_id": new_user.id,
        "email": new_user.email,
        "username": new_user.username,
        "first_name": new_user.first_name,
        "last_name": new_user.last_name,
        "user_type": new_user.user_type,
        "is_active": new_user.is_active,
        "parent_id": new_user.parent_id,
        "generated_password": temp_password,
    }


@router.get("", response_model=UserListResponse)
def list_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    user_type: Optional[str] = None,
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db),
    actor: User = Depends(require_hierarchy_manager),
):
    """
    List users with pagination. Admin: all. Others: descendants only.
    """
    query = db.query(User)

    if actor.user_type != "Admin":
        descendant_ids = get_descendant_ids(actor.id, db)
        if not descendant_ids:
            return UserListResponse(users=[], total=0, page=page, page_size=page_size)
        query = query.filter(User.id.in_(descendant_ids))

    if user_type:
        if user_type not in ALLOWED_USER_TYPES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid user_type. Must be one of: {', '.join(ALLOWED_USER_TYPES)}",
            )
        query = query.filter(User.user_type == user_type)

    if is_active is not None:
        query = query.filter(User.is_active == is_active)

    total = query.count()
    users = query.offset((page - 1) * page_size).limit(page_size).all()

    return UserListResponse(users=users, total=total, page=page, page_size=page_size)


@router.get("/tree", response_model=list[UserTreeNodeResponse])
def get_users_tree(
    db: Session = Depends(get_db),
    actor: User = Depends(require_hierarchy_manager),
):
    """Nested hierarchy tree. Admin: full tree. Others: self + descendants."""
    users = _scoped_users_for_tree(actor, db)
    return _build_tree_nodes(users)


@router.get("/{user_id}", response_model=UserResponse)
def get_user(
    user_id: UUID,
    db: Session = Depends(get_db),
    actor: User = Depends(require_hierarchy_manager),
):
    """Get user details by ID (scoped to branch for non-Admin)."""
    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if actor.user_type != "Admin":
        if user_id != actor.id:
            validate_can_manage_target(actor, user_id, db)

    return user


@router.get("/{user_id}/permissions", response_model=List[ModulePermissionResponse])
def get_user_module_permissions(
    user_id: UUID,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    return _build_user_module_permissions_response(user_id=user_id, db=db)


@router.patch("/{user_id}/permissions", response_model=List[ModulePermissionResponse])
def patch_user_module_permissions(
    user_id: UUID,
    permissions_data: SetModulePermissionsRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    for perm in permissions_data.permissions:
        if perm.module not in ALLOWED_MODULES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid module '{perm.module}'. Must be one of: {', '.join(ALLOWED_MODULES)}"
            )
        if perm.access_level not in ALLOWED_MODULE_ACCESS_LEVELS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid access_level '{perm.access_level}'. Must be one of: {', '.join(ALLOWED_MODULE_ACCESS_LEVELS)}"
            )

    existing = db.query(UserPermission).filter(UserPermission.user_id == user_id).all()
    existing_by_module = {perm.module: perm for perm in existing}

    for perm_data in permissions_data.permissions:
        existing_perm = existing_by_module.get(perm_data.module)
        if existing_perm:
            existing_perm.access_level = perm_data.access_level
        else:
            db.add(
                UserPermission(
                    user_id=user_id,
                    module=perm_data.module,
                    access_level=perm_data.access_level,
                )
            )

    db.commit()
    return _build_user_module_permissions_response(user_id=user_id, db=db)


def _update_user_impl(
    user_id: UUID,
    user_data: UserUpdate,
    db: Session,
    actor: User,
) -> User:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    validate_can_manage_target(actor, user_id, db)

    before_state = {
        "email": user.email,
        "username": user.username,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "user_type": user.user_type,
        "is_active": user.is_active,
        "parent_id": str(user.parent_id) if user.parent_id else None,
    }

    _apply_user_update(user, user_data, actor, db)

    db.commit()
    db.refresh(user)

    after_state = {
        "email": user.email,
        "username": user.username,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "user_type": user.user_type,
        "is_active": user.is_active,
        "parent_id": str(user.parent_id) if user.parent_id else None,
    }

    create_audit_log(
        db=db,
        admin_user_id=str(actor.id),
        target_user_id=str(user.id),
        action="update_user",
        before_state=before_state,
        after_state=after_state,
    )

    return user


@router.put("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: UUID,
    user_data: UserUpdate,
    db: Session = Depends(get_db),
    actor: User = Depends(require_hierarchy_manager),
):
    """Update user details (PUT)."""
    return _update_user_impl(user_id, user_data, db, actor)


@router.patch("/{user_id}", response_model=UserResponse)
def patch_user(
    user_id: UUID,
    user_data: UserUpdate,
    db: Session = Depends(get_db),
    actor: User = Depends(require_hierarchy_manager),
):
    """Update user details (PATCH)."""
    return _update_user_impl(user_id, user_data, db, actor)



@router.post("/{user_id}/reset-password")
def reset_password(
    user_id: UUID,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """
    Reset user password (admin only).
    Generates new random password and returns it plaintext ONCE.
    """
    user = db.query(User).filter(User.id == user_id).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Generate new password
    new_password = generate_temporary_password()
    
    # Capture before state
    before_state = {"action": "password_reset_requested"}
    
    # Update password
    user.hashed_password = hash_password(new_password)
    user.force_password_change = True
    db.commit()
    
    # Create audit log
    create_audit_log(
        db=db,
        admin_user_id=str(admin.id),
        target_user_id=str(user.id),
        action="reset_password",
        before_state=before_state,
        # REDACTED: Never log the new password
        after_state={"password_reset": True}
    )
    
    return {"generated_password": new_password}


@router.post("/{user_id}/permissions", response_model=List[PagePermissionResponse])
def set_user_permissions(
    user_id: UUID,
    permissions_data: SetPermissionsRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """
    Set page permissions for a user (admin only).
    Replaces all existing permissions.
    """
    user = db.query(User).filter(User.id == user_id).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Validate all access levels
    for perm in permissions_data.permissions:
        if perm.access not in ALLOWED_ACCESS_LEVELS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid access level '{perm.access}'. Must be one of: {', '.join(ALLOWED_ACCESS_LEVELS)}"
            )
    
    # Validate all pages exist
    page_ids = [perm.page_id for perm in permissions_data.permissions]
    pages = db.query(Page).filter(Page.id.in_(page_ids)).all()
    
    if len(pages) != len(page_ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="One or more page IDs are invalid"
        )
    
    # Capture before state
    existing_perms = db.query(UserPagePermission).filter(
        UserPagePermission.user_id == user_id
    ).all()
    before_state = {
        "permissions": [
            {"page_id": str(p.page_id), "access": p.access}
            for p in existing_perms
        ]
    }
    
    # Delete existing permissions
    db.query(UserPagePermission).filter(UserPagePermission.user_id == user_id).delete()
    
    # Create new permissions
    new_permissions = []
    for perm_data in permissions_data.permissions:
        perm = UserPagePermission(
            user_id=user_id,
            page_id=perm_data.page_id,
            access=perm_data.access
        )
        db.add(perm)
        new_permissions.append(perm)
    
    db.commit()
    
    # Refresh all permissions
    for perm in new_permissions:
        db.refresh(perm)
    
    # Capture after state
    after_state = {
        "permissions": [
            {"page_id": str(p.page_id), "access": p.access}
            for p in new_permissions
        ]
    }
    
    # Create audit log
    create_audit_log(
        db=db,
        admin_user_id=str(admin.id),
        target_user_id=str(user_id),
        action="set_permissions",
        before_state=before_state,
        after_state=after_state
    )
    
    return new_permissions


@router.post("/{user_id}/deactivate")
def deactivate_user(  # Legacy POST endpoint kept for backward compatibility
    user_id: UUID,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """
    Deactivate a user (admin only).
    Prevents login but keeps historical references intact.
    """
    user = db.query(User).filter(User.id == user_id).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Prevent deactivating yourself
    if user.id == admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot deactivate your own account"
        )
    
    # Capture before state
    before_state = {"is_active": user.is_active}
    
    # Deactivate user
    user.is_active = False
    db.commit()
    
    # Capture after state
    after_state = {"is_active": user.is_active}
    
    # Create audit log
    create_audit_log(
        db=db,
        admin_user_id=str(admin.id),
        target_user_id=str(user.id),
        action="deactivate_user",
        before_state=before_state,
        after_state=after_state
    )
    
    return {"message": "User deactivated successfully"}


@router.patch("/{user_id}/deactivate")
def deactivate_user_patch(
    user_id: UUID,
    db: Session = Depends(get_db),
    actor: User = Depends(require_hierarchy_manager),
):
    """Deactivate a user. Non-Admin: descendants only."""
    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    validate_can_manage_target(actor, user_id, db)

    if user.id == actor.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot deactivate your own account",
        )

    before_state = {"is_active": user.is_active}
    user.is_active = False
    db.commit()
    after_state = {"is_active": user.is_active}

    create_audit_log(
        db=db,
        admin_user_id=str(actor.id),
        target_user_id=str(user.id),
        action="deactivate_user",
        before_state=before_state,
        after_state=after_state,
    )

    return {"message": "User deactivated successfully"}


@router.patch("/{user_id}/activate")
def activate_user(
    user_id: UUID,
    db: Session = Depends(get_db),
    actor: User = Depends(require_hierarchy_manager),
):
    """Activate a user. Non-Admin: descendants only."""
    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    validate_can_manage_target(actor, user_id, db)

    before_state = {"is_active": user.is_active}
    user.is_active = True
    db.commit()
    after_state = {"is_active": user.is_active}

    create_audit_log(
        db=db,
        admin_user_id=str(actor.id),
        target_user_id=str(user.id),
        action="activate_user",
        before_state=before_state,
        after_state=after_state,
    )

    return {"message": "User activated successfully"}


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: UUID,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """
    Permanently delete a user (admin only).
    """
    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    if user.id == admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own account"
        )

    try:
        db.delete(user)
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unable to delete user due to related records"
        )

    create_audit_log(
        db=db,
        admin_user_id=str(admin.id),
        target_user_id=str(user_id),
        action="delete_user",
        before_state={"id": str(user_id)},
        after_state=None
    )

    return None
