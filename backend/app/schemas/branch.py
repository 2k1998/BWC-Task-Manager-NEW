from uuid import UUID

from pydantic import BaseModel


class BranchHeadResponse(BaseModel):
    id: UUID
    full_name: str
    user_type: str
