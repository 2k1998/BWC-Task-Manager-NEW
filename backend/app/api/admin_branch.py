from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_admin
from app.models.user import User
from app.schemas.branch import BranchHeadResponse
from app.utils.hierarchy import get_descendant_ids

router = APIRouter(prefix="/admin", tags=["Admin"])

_BRANCH_HEAD_RANK = {"Pillar": 0, "Manager": 1, "Head": 2}


@router.get("/branch-heads", response_model=List[BranchHeadResponse])
def list_branch_heads(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """Return users who have at least one descendant in the hierarchy."""
    users = db.query(User).filter(User.is_active == True).all()  # noqa: E712
    heads: list[BranchHeadResponse] = []
    for user in users:
        if not get_descendant_ids(user.id, db):
            continue
        full_name = f"{user.first_name} {user.last_name}".strip()
        heads.append(
            BranchHeadResponse(
                id=user.id,
                full_name=full_name,
                user_type=user.user_type,
            )
        )

    heads.sort(
        key=lambda h: (
            _BRANCH_HEAD_RANK.get(h.user_type, 99),
            h.full_name.lower(),
        )
    )
    return heads
