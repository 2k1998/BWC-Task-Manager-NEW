from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.user import User

ROLE_CREATION_MAP = {
    "Admin": ["Pillar", "Manager", "Head", "Agent"],
    "Pillar": ["Manager", "Head", "Agent"],
    "Manager": ["Head", "Agent"],
    "Head": ["Agent"],
    "Agent": [],
}

VALID_PARENT_ROLES_MAP = {
    "Pillar": ["Admin"],
    "Manager": ["Admin", "Pillar"],
    "Head": ["Admin", "Pillar", "Manager"],
    "Agent": ["Admin", "Pillar", "Manager", "Head"],
}

HIERARCHY_MANAGER_TYPES = ("Admin", "Pillar", "Manager", "Head")


def get_allowed_roles_for(user_type: str) -> list[str]:
    """Return which user_type values this role is allowed to create."""
    return list(ROLE_CREATION_MAP.get(user_type, []))


def get_valid_parent_roles_for(role: str) -> list[str]:
    """Return valid parent user_type values for a child role."""
    return list(VALID_PARENT_ROLES_MAP.get(role, []))


def get_descendant_ids(user_id: UUID, db: Session) -> list[UUID]:
    """Return all user IDs below this user in the tree (recursive, all depths)."""
    descendants: list[UUID] = []
    frontier = [user_id]
    while frontier:
        current_id = frontier.pop()
        child_ids = [
            row[0]
            for row in db.query(User.id).filter(User.parent_id == current_id).all()
        ]
        descendants.extend(child_ids)
        frontier.extend(child_ids)
    return descendants


def get_visible_user_ids(actor: User, db: Session) -> list[UUID] | None:
    """
    Return user IDs visible to actor, or None if no filter (Admin sees all).
    Non-Admin: self + all descendants.
    """
    if actor.user_type == "Admin":
        return None
    return [actor.id, *get_descendant_ids(actor.id, db)]


def is_hierarchy_manager(user_type: str) -> bool:
    return user_type in HIERARCHY_MANAGER_TYPES


def validate_creatable_role(actor_type: str, new_type: str) -> None:
    if new_type not in get_allowed_roles_for(actor_type):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Role '{actor_type}' cannot create users of type '{new_type}'",
        )


def _would_create_cycle(user_id: UUID, new_parent_id: UUID, db: Session) -> bool:
    """True if setting new_parent_id on user_id would create a cycle."""
    current: UUID | None = new_parent_id
    while current is not None:
        if current == user_id:
            return True
        parent = db.query(User.parent_id).filter(User.id == current).first()
        current = parent[0] if parent else None
    return False


def validate_parent_for_role(
    child_role: str,
    parent_id: UUID | None,
    db: Session,
    *,
    editing_user_id: UUID | None = None,
) -> None:
    valid_parent_types = get_valid_parent_roles_for(child_role)
    if not valid_parent_types:
        if parent_id is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Role '{child_role}' cannot have a parent",
            )
        return

    if parent_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Role '{child_role}' requires a parent",
        )

    parent = db.query(User).filter(User.id == parent_id).first()
    if not parent:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Parent user not found",
        )

    if parent.user_type not in valid_parent_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Parent must be one of: {', '.join(valid_parent_types)}",
        )

    if editing_user_id is not None:
        if parent_id == editing_user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User cannot be their own parent",
            )
        if _would_create_cycle(editing_user_id, parent_id, db):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Parent assignment would create a cycle",
            )


def validate_parent_in_actor_subtree(
    actor: User,
    parent_id: UUID,
    db: Session,
) -> None:
    """Non-Admin creators: parent must be self or a descendant."""
    if actor.user_type == "Admin":
        return
    allowed = {actor.id, *get_descendant_ids(actor.id, db)}
    if parent_id not in allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Parent must be within your branch",
        )


def validate_can_manage_target(actor: User, target_id: UUID, db: Session) -> None:
    """Target must be self or in actor's descendants (Admin bypasses)."""
    if actor.user_type == "Admin":
        return
    if target_id == actor.id:
        return
    descendant_ids = get_descendant_ids(actor.id, db)
    if target_id not in descendant_ids:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this user",
        )


def get_branch_root(user: User, db: Session) -> User:
    """
    Returns the topmost non-Admin ancestor of `user`.
    For non-Admin: walks up parent_id until parent is None or parent's user_type == "Admin".
    Returns the last non-Admin encountered.
    """
    current = user
    for _ in range(10):
        if current.parent_id is None:
            return current
        parent = db.query(User).filter(User.id == current.parent_id).first()
        if not parent:
            return current
        if parent.user_type == "Admin":
            return current
        current = parent
    return current


def get_assignable_user_ids(user: User, db: Session) -> list[UUID] | None:
    """
    Returns user IDs that `user` can ASSIGN a task to.
    Returns None for Admin (assign to anyone).
    For non-Admin: branch_root.id + get_descendant_ids(branch_root.id, db)
    """
    if user.user_type == "Admin":
        return None
    branch_root = get_branch_root(user, db)
    return [branch_root.id, *get_descendant_ids(branch_root.id, db)]
