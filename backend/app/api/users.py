from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session
from uuid import UUID

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.utils.hierarchy import get_descendant_ids, get_visible_user_ids

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("")
def search_users(
    query: str = Query("", min_length=0, max_length=100),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = query.strip()

    users_q = db.query(User).filter(User.is_active.is_(True), User.id != current_user.id)

    visible_ids = get_visible_user_ids(current_user, db)
    if visible_ids is not None:
        visible_without_self = [uid for uid in visible_ids if uid != current_user.id]
        if not visible_without_self:
            return {"users": []}
        users_q = users_q.filter(User.id.in_(visible_without_self))

    if q:
        pattern = f"%{q}%"
        users_q = users_q.filter(
            or_(
                User.first_name.ilike(pattern),
                User.last_name.ilike(pattern),
                User.username.ilike(pattern),
                User.email.ilike(pattern),
            )
        )

    users = users_q.order_by(User.first_name.asc(), User.last_name.asc(), User.username.asc()).limit(limit).all()
    return {
        "users": [
            {
                "id": str(user.id),
                "first_name": user.first_name,
                "last_name": user.last_name,
                "username": user.username,
                "email": user.email,
            }
            for user in users
        ]
    }
