from __future__ import annotations

import logging
from datetime import date, datetime, timedelta, timezone
from typing import Any, Optional
from uuid import UUID

from sqlalchemy import and_, case, func, nullslast, or_
from sqlalchemy.orm import Session
from app.models.contact import Contact
from app.models.project import Project
from app.models.task import Task
from app.models.team import Team
from app.models.user import User
from app.utils.chatbot_context import ChatbotToolContext
from app.utils.visibility import (
    build_project_visibility_filter,
    build_task_visibility_filter,
    task_not_soft_deleted_filter,
)

logger = logging.getLogger(__name__)

_MAX_LIMIT = 25
_DEFAULT_LIMIT = 10


def _clamp_limit(args: dict) -> int:
    return _clamp_int(args, "limit", _DEFAULT_LIMIT, _MAX_LIMIT)


def _clamp_int(args: dict, key: str, default: int, max_val: int) -> int:
    raw = args.get(key, default)
    try:
        value = int(raw)
    except (TypeError, ValueError):
        value = default
    return max(1, min(value, max_val))


_USER_TYPE_SORT = case(
    (User.user_type == "Pillar", 1),
    (User.user_type == "Manager", 2),
    (User.user_type == "Head", 3),
    (User.user_type == "Agent", 4),
    else_=99,
)


def _user_display_name(user: Optional[User]) -> str:
    if not user:
        return "unassigned"
    name = f"{user.first_name or ''} {user.last_name or ''}".strip()
    return name or user.username or "unknown"


def _contact_display_name(contact: Contact) -> str:
    return f"{contact.first_name} {contact.last_name}".strip()


def _parse_deadline_before(value: Any) -> date | None:
    if not value or not isinstance(value, str):
        return None
    try:
        return date.fromisoformat(value.strip()[:10])
    except ValueError:
        return None


def _format_deadline(deadline: date | None) -> str:
    return deadline.isoformat() if deadline else "no due date"


def _load_user_map(db: Session, user_ids: set[UUID]) -> dict[UUID, User]:
    if not user_ids:
        return {}
    users = db.query(User).filter(User.id.in_(user_ids)).all()
    return {u.id: u for u in users}


def _load_team_map(db: Session, team_ids: set[UUID]) -> dict[UUID, Team]:
    if not team_ids:
        return {}
    teams = db.query(Team).filter(Team.id.in_(team_ids)).all()
    return {t.id: t for t in teams}


def get_my_tasks(args: dict, ctx: ChatbotToolContext) -> str:
    try:
        denied = ctx.no_module_access_message("tasks")
        if denied:
            return denied

        limit = _clamp_limit(args)
        db = ctx.db

        visibility = build_task_visibility_filter(ctx.user, db, branch_ids=None)
        query = db.query(Task).filter(visibility)
        if visibility is True:
            query = query.filter(task_not_soft_deleted_filter())

        status = args.get("status")
        if status:
            query = query.filter(Task.status == status)

        urgency_label = args.get("urgency_label")
        if urgency_label:
            query = query.filter(Task.urgency_label == urgency_label)

        if args.get("assigned_to_me") is True:
            query = query.filter(Task.assigned_user_id == ctx.user.id)

        if args.get("created_by_me") is True:
            query = query.filter(Task.owner_user_id == ctx.user.id)

        deadline_before = _parse_deadline_before(
            args.get("due_before") or args.get("deadline_before")
        )
        if deadline_before is not None:
            query = query.filter(Task.deadline <= deadline_before)

        company_id_raw = args.get("company_id")
        if company_id_raw:
            try:
                query = query.filter(Task.company_id == UUID(str(company_id_raw)))
            except (ValueError, TypeError):
                pass

        total = query.count()
        tasks = (
            query.order_by(nullslast(Task.deadline.asc()), Task.created_at.desc())
            .limit(limit)
            .all()
        )

        if not tasks:
            return "No tasks found matching those criteria."

        user_ids: set[UUID] = set()
        team_ids: set[UUID] = set()
        for task in tasks:
            if task.owner_user_id:
                user_ids.add(task.owner_user_id)
            if task.assigned_user_id:
                user_ids.add(task.assigned_user_id)
            if task.assigned_team_id:
                team_ids.add(task.assigned_team_id)

        user_map = _load_user_map(db, user_ids)
        team_map = _load_team_map(db, team_ids)

        lines = [f"Found {len(tasks)} task(s):"]
        for task in tasks:
            assignee = user_map.get(task.assigned_user_id) if task.assigned_user_id else None
            if assignee:
                assigned_label = _user_display_name(assignee)
            elif task.assigned_team_id:
                team = team_map.get(task.assigned_team_id)
                assigned_label = f"team: {team.name}" if team else "team assignment"
            else:
                assigned_label = "unassigned"

            lines.append(
                f'- "{task.title}" — {task.status}, urgency: {task.urgency_label}, '
                f"due: {_format_deadline(task.deadline)}, assigned to: {assigned_label}"
            )

        if total > limit:
            lines.append(
                f"(Showing top {limit}. Refine the filters for more specific results.)"
            )

        return "\n".join(lines)
    except Exception:
        logger.exception("get_my_tasks failed for user %s", ctx.user.id)
        return "An error occurred fetching tasks."


def get_my_projects(args: dict, ctx: ChatbotToolContext) -> str:
    try:
        denied = ctx.no_module_access_message("projects")
        if denied:
            return denied

        limit = _clamp_limit(args)
        db = ctx.db

        query = db.query(Project).filter(build_project_visibility_filter(ctx.user))

        status = args.get("status")
        if status:
            query = query.filter(Project.status == status)

        total = query.count()
        projects = (
            query.order_by(Project.created_at.desc()).limit(limit).all()
        )

        if not projects:
            return "No projects found."

        lines = [f"Found {len(projects)} project(s):"]
        for project in projects:
            created = (
                project.created_at.date().isoformat()
                if isinstance(project.created_at, datetime)
                else str(project.created_at)[:10]
            )
            lines.append(f'- "{project.name}" — status: {project.status}, created: {created}')

        if total > limit:
            lines.append(
                f"(Showing top {limit}. Refine the filters for more specific results.)"
            )

        return "\n".join(lines)
    except Exception:
        logger.exception("get_my_projects failed for user %s", ctx.user.id)
        return "An error occurred fetching projects."


def get_my_contacts(args: dict, ctx: ChatbotToolContext) -> str:
    try:
        denied = ctx.no_module_access_message("contacts")
        if denied:
            return denied

        limit = _clamp_limit(args)
        db = ctx.db

        query = db.query(Contact).filter(Contact.user_id == ctx.user.id)

        search = args.get("search")
        if search and isinstance(search, str):
            like = f"%{search.strip()}%"
            query = query.filter(
                or_(
                    Contact.first_name.ilike(like),
                    Contact.last_name.ilike(like),
                    Contact.phone.ilike(like),
                    Contact.email.ilike(like),
                )
            )

        total = query.count()
        contacts = query.order_by(Contact.first_name.asc(), Contact.last_name.asc()).limit(limit).all()

        if not contacts:
            return "No contacts found."

        lines = [f"Found {len(contacts)} contact(s):"]
        for contact in contacts:
            email = contact.email or "no email"
            phone = contact.phone or "no phone"
            lines.append(
                f'- "{_contact_display_name(contact)}" — email: {email}, phone: {phone}'
            )

        if total > limit:
            lines.append(
                f"(Showing top {limit}. Refine the filters for more specific results.)"
            )

        return "\n".join(lines)
    except Exception:
        logger.exception("get_my_contacts failed for user %s", ctx.user.id)
        return "An error occurred fetching contacts."


def get_team_members(args: dict, ctx: ChatbotToolContext) -> str:
    try:
        limit = _clamp_int(args, "limit", 25, 50)
        include_indirect = args.get("include_indirect") is True
        db = ctx.db

        if ctx.is_admin():
            query = db.query(User).filter(User.user_type != "Admin")
        elif include_indirect:
            visible_ids = ctx.visible_user_ids() or []
            member_ids = [uid for uid in visible_ids if uid != ctx.user.id]
            if not member_ids:
                if ctx.user.user_type == "Agent":
                    return "You don't have any direct reports."
                return "No team members found."
            query = db.query(User).filter(User.id.in_(member_ids))
        else:
            query = db.query(User).filter(User.parent_id == ctx.user.id)

        total = query.count()
        members = (
            query.order_by(
                _USER_TYPE_SORT.asc(),
                User.first_name.asc(),
                User.last_name.asc(),
            )
            .limit(limit)
            .all()
        )

        if not members:
            if ctx.user.user_type == "Agent" and not include_indirect:
                return "You don't have any direct reports."
            return "No team members found."

        lines = [f"Team members ({len(members)}):"]
        for member in members:
            lines.append(
                f"- {_user_display_name(member)} ({member.user_type}) — {member.email}"
            )

        if total > limit:
            lines.append(
                f"(Showing top {limit}. Use include_indirect=true for the full branch.)"
            )

        return "\n".join(lines)
    except Exception:
        logger.exception("get_team_members failed for user %s", ctx.user.id)
        return "An error occurred fetching team members."


def get_team_workload(args: dict, ctx: ChatbotToolContext) -> str:
    try:
        if not ctx.is_hierarchy_manager():
            return (
                "You need to be a team leader (Head, Manager, Pillar, or Admin) "
                "to view team workload."
            )

        denied = ctx.no_module_access_message("tasks")
        if denied:
            return denied
        if not ctx.can_view("tasks"):
            return (
                "You do not have access to view tasks. Please contact an admin."
            )

        days_back = _clamp_int(args, "days_back", 30, 90)
        limit = _clamp_int(args, "limit", 10, 25)
        db = ctx.db

        today = datetime.now(timezone.utc).date()
        since = datetime.now(timezone.utc) - timedelta(days=days_back)
        not_deleted = task_not_soft_deleted_filter()

        open_expr = and_(Task.status != "Completed", not_deleted)
        overdue_expr = and_(open_expr, Task.deadline < today)
        completed_expr = and_(
            Task.status == "Completed",
            not_deleted,
            Task.updated_at >= since,
        )

        if ctx.is_admin():
            scope_rows = db.query(User.id).filter(User.user_type != "Admin").all()
            scope_ids = [row[0] for row in scope_rows]
        else:
            scope_ids = ctx.visible_user_ids() or [ctx.user.id]

        if not scope_ids:
            return "No workload data — your team has no tasks recorded."

        open_count = func.sum(case((open_expr, 1), else_=0)).label("open_count")
        overdue_count = func.sum(case((overdue_expr, 1), else_=0)).label("overdue_count")
        completed_recent_count = func.sum(
            case((completed_expr, 1), else_=0)
        ).label("completed_recent_count")

        # Team-assigned tasks (assigned_team_id set, no assignee) are excluded — same as analytics.
        rows = (
            db.query(
                User.id,
                User.first_name,
                User.last_name,
                User.user_type,
                open_count,
                overdue_count,
                completed_recent_count,
            )
            .join(Task, Task.assigned_user_id == User.id)
            .filter(
                User.id.in_(scope_ids),
                Task.assigned_user_id.isnot(None),
            )
            .group_by(User.id, User.first_name, User.last_name, User.user_type)
            .order_by(
                open_count.desc(),
                User.first_name.asc(),
                User.last_name.asc(),
            )
            .limit(limit)
            .all()
        )

        if not rows:
            return "No workload data — your team has no tasks recorded."

        lines = [f"Team workload (top {len(rows)} by open tasks):"]
        for row in rows:
            name = f"{row.first_name or ''} {row.last_name or ''}".strip() or "unknown"
            lines.append(
                f"- {name} ({row.user_type}): {int(row.open_count or 0)} open, "
                f"{int(row.overdue_count or 0)} overdue, "
                f"{int(row.completed_recent_count or 0)} completed in last {days_back} days"
            )

        return "\n".join(lines)
    except Exception:
        logger.exception("get_team_workload failed for user %s", ctx.user.id)
        return "An error occurred fetching team workload."


def get_app_stats(args: dict, ctx: ChatbotToolContext) -> str:
    try:
        denied = ctx.no_module_access_message("tasks")
        if denied:
            return denied

        days_back = _clamp_int(args, "days_back", 7, 90)
        db = ctx.db

        today = datetime.now(timezone.utc).date()
        week_end = today + timedelta(days=7)
        since = datetime.now(timezone.utc) - timedelta(days=days_back)

        personal = and_(
            Task.assigned_user_id == ctx.user.id,
            task_not_soft_deleted_filter(),
        )
        open_filter = and_(personal, Task.status != "Completed")

        my_open = db.query(func.count(Task.id)).filter(open_filter).scalar() or 0
        my_overdue = (
            db.query(func.count(Task.id))
            .filter(open_filter, Task.deadline < today)
            .scalar()
            or 0
        )
        my_due_today = (
            db.query(func.count(Task.id))
            .filter(open_filter, Task.deadline == today)
            .scalar()
            or 0
        )
        my_due_this_week = (
            db.query(func.count(Task.id))
            .filter(open_filter, Task.deadline >= today, Task.deadline <= week_end)
            .scalar()
            or 0
        )
        my_completed_recent = (
            db.query(func.count(Task.id))
            .filter(
                Task.assigned_user_id == ctx.user.id,
                task_not_soft_deleted_filter(),
                Task.status == "Completed",
                Task.updated_at >= since,
            )
            .scalar()
            or 0
        )

        lines = [
            "Your stats:",
            f"- Open tasks: {my_open}",
            f"- Overdue: {my_overdue}",
            f"- Due today: {my_due_today}",
            f"- Due this week (next 7 days): {my_due_this_week}",
            f"- Completed in last {days_back} days: {my_completed_recent}",
        ]

        if ctx.can_view("projects"):
            my_projects = (
                db.query(func.count(Project.id))
                .filter(
                    or_(
                        Project.owner_user_id == ctx.user.id,
                        Project.project_manager_user_id == ctx.user.id,
                    )
                )
                .scalar()
                or 0
            )
            lines.append(f"- Projects: {my_projects}")

        return "\n".join(lines)
    except Exception:
        logger.exception("get_app_stats failed for user %s", ctx.user.id)
        return "An error occurred fetching your stats."
