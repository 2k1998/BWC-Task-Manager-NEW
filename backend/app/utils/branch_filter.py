from __future__ import annotations

from typing import Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.user import User
from app.utils.hierarchy import get_descendant_ids


def resolve_admin_branch_ids(
    branch_user_id: Optional[UUID],
    current_user: User,
    db: Session,
) -> Optional[list[UUID]]:
    """
    When Admin passes branch_user_id, return anchor + all descendant user IDs.
    Otherwise return None (no extra branch filter).
    """
    if branch_user_id is None or current_user.user_type != "Admin":
        return None

    anchor = db.query(User).filter(User.id == branch_user_id).first()
    if not anchor:
        return []

    return [branch_user_id, *get_descendant_ids(branch_user_id, db)]
