"""Download permission checks for documents."""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.call_notes_file import CallNotesFile
from app.models.chat_message import ChatMessage
from app.models.chat_thread_member import ChatThreadMember
from app.models.daily_call import DailyCall
from app.models.document import Document
from app.models.task import Task
from app.models.task_document import TaskDocument
from app.models.user import User


def _is_task_attachment_download_allowed(db: Session, document_id: UUID, user: User) -> bool:
    task_link = (
        db.query(TaskDocument)
        .filter(TaskDocument.document_id == document_id)
        .first()
    )
    if not task_link:
        return False

    task = db.query(Task).filter(Task.id == task_link.task_id).first()
    if not task:
        return False

    if str(task.owner_user_id) == str(user.id):
        return True
    if task.assigned_user_id and str(task.assigned_user_id) == str(user.id):
        return True
    return False


def _is_chat_file_download_allowed(db: Session, document_id: UUID, user: User) -> bool:
    if (
        db.query(ChatMessage.id)
        .join(ChatThreadMember, ChatThreadMember.thread_id == ChatMessage.thread_id)
        .filter(
            ChatMessage.file_id == document_id,
            ChatThreadMember.user_id == user.id,
        )
        .first()
    ):
        return True
    return False


def user_can_download_document(db: Session, document: Document, user: User) -> bool:
    """
    Return True if user may download this file.

    Rules:
    - Admin: always
    - Task attachment: task owner (creator) OR assigned user
    - Documents module upload: uploader
    - Chat file: uploader OR thread member
    - Call notes: handled separately in documents API (expiry / owner)
    """
    if user.user_type == "Admin":
        return True

    source = getattr(document, "source", None) or "document"

    if source == "task" or (
        db.query(TaskDocument.id).filter(TaskDocument.document_id == document.id).first()
    ):
        return _is_task_attachment_download_allowed(db, document.id, user)

    if source == "chat":
        if str(document.uploaded_by_user_id) == str(user.id):
            return True
        return _is_chat_file_download_allowed(db, document.id, user)

    if source == "call_note":
        now = datetime.now(timezone.utc)
        link = (
            db.query(CallNotesFile)
            .join(DailyCall, DailyCall.id == CallNotesFile.daily_call_id)
            .filter(
                CallNotesFile.file_id == document.id,
                DailyCall.user_id == user.id,
                CallNotesFile.expires_at >= now,
            )
            .first()
        )
        return link is not None

    # Documents module and any other non-task context
    return str(document.uploaded_by_user_id) == str(user.id)
