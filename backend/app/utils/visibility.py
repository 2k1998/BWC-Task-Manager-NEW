from uuid import UUID

from sqlalchemy.orm import Session

from app.models.user import User
from app.models.task import Task
from app.models.project import Project
from app.models.team_member import TeamMember
from app.utils.hierarchy import get_descendant_ids


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
