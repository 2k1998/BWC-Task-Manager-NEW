from uuid import UUID

from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.task import Task
from app.models.project import Project
from app.models.team_member import TeamMember
from app.utils.hierarchy import get_descendant_ids


def task_not_soft_deleted_filter():
    """Exclude soft-deleted tasks (matches GET /tasks)."""
    if hasattr(Task, "is_deleted"):
        return or_(Task.is_deleted == False, Task.is_deleted == None)
    return Task.deleted_at.is_(None)


def build_task_visibility_filter(
    current_user: User,
    db: Session,
    branch_ids: list | None = None,
):
    """Build SQLAlchemy filter for task list visibility (matches GET /tasks)."""
    if current_user.user_type == "Admin":
        if branch_ids is None:
            return True
        return and_(
            task_not_soft_deleted_filter(),
            or_(
                Task.owner_user_id.in_(branch_ids),
                Task.assigned_user_id.in_(branch_ids),
            ),
        )

    descendant_ids = get_descendant_ids(current_user.id, db)
    user_teams = db.query(TeamMember.team_id).filter(TeamMember.user_id == current_user.id).all()
    team_ids = [t[0] for t in user_teams]

    filters = [
        Task.owner_user_id == current_user.id,
        Task.assigned_user_id == current_user.id,
    ]

    if team_ids:
        filters.append(Task.assigned_team_id.in_(team_ids))

    if descendant_ids:
        filters.append(Task.assigned_user_id.in_(descendant_ids))
        filters.append(Task.owner_user_id.in_(descendant_ids))

    return and_(task_not_soft_deleted_filter(), or_(*filters))


def build_project_visibility_filter(current_user: User):
    """Build SQLAlchemy filter for project list visibility (matches GET /projects)."""
    if current_user.user_type == "Admin":
        return True

    return or_(
        Project.owner_user_id == current_user.id,
        Project.project_manager_user_id == current_user.id,
    )


def get_subordinate_ids(user: User, db: Session) -> list[str]:
    """Get list of all descendant user IDs (recursive)."""
    return [str(uid) for uid in get_descendant_ids(user.id, db)]


def can_user_view_task(task: Task, current_user: User, db: Session) -> bool:
    """Check if user can view a task based on visibility rules."""
    if current_user.user_type == "Admin":
        return True

    if str(task.owner_user_id) == str(current_user.id):
        return True

    if task.assigned_user_id and str(task.assigned_user_id) == str(current_user.id):
        return True

    if task.assigned_team_id:
        is_member = db.query(TeamMember).filter(
            TeamMember.team_id == task.assigned_team_id,
            TeamMember.user_id == current_user.id
        ).first()
        if is_member:
            return True

    if task.assigned_user_id:
        subordinate_ids = get_subordinate_ids(current_user, db)
        if str(task.assigned_user_id) in subordinate_ids:
            return True

    return False


def can_user_view_project(project: Project, current_user: User) -> bool:
    """Check if user can view a project based on visibility rules."""
    if current_user.user_type == "Admin":
        return True

    if str(project.owner_user_id) == str(current_user.id):
        return True

    if str(project.project_manager_user_id) == str(current_user.id):
        return True

    return False
