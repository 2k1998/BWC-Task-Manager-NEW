from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session
from uuid import UUID

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.user import UserBrief
from app.utils.hierarchy import get_assignable_user_ids, get_descendant_ids, get_visible_user_ids

router = APIRouter(prefix="/users", tags=["Users"])

USER_TYPE_RANK = {
    "Admin": 0,
    "Pillar": 1,
    "Manager": 2,
    "Head": 3,
    "Agent": 4,
}


def _user_brief(user: User) -> UserBrief:
    return UserBrief(
        id=user.id,
        full_name=f"{user.first_name} {user.last_name}".strip(),
        email=user.email,
        user_type=user.user_type,
    )


def _sort_users_for_assignable(users: list[User]) -> list[User]:
    return sorted(
        users,
        key=lambda u: (
            USER_TYPE_RANK.get(u.user_type, 99),
            f"{u.first_name} {u.last_name}".strip().lower(),
        ),
    )


@router.get("/assignable", response_model=list[UserBrief])
def list_assignable_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Users the current actor may assign tasks to."""
    assignable_ids = get_assignable_user_ids(current_user, db)
    users_q = db.query(User).filter(User.is_active.is_(True))
    if assignable_ids is not None:
        users_q = users_q.filter(User.id.in_(assignable_ids))
    users = _sort_users_for_assignable(users_q.all())
    return [_user_brief(user) for user in users]


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
