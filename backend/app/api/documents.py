from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
import uuid
import os
from pathlib import Path

from app.core.database import get_db
from app.core.deps import get_current_user, require_admin
from app.core.config import settings
from app.models.user import User
from app.models.document import Document
from app.models.call_notes_file import CallNotesFile
from app.models.daily_call import DailyCall
from app.schemas.document import DocumentResponse, DocumentListResponse
from app.utils.activity_logger import log_activity
from app.utils.branch_filter import resolve_admin_branch_ids
from app.utils.document_access import user_can_download_document
from datetime import datetime, timezone

router = APIRouter(prefix="/documents", tags=["Documents"])

MAX_FILE_SIZE = 100 * 1024 * 1024
ALLOWED_UPLOAD_SOURCES = frozenset({"document", "chat"})


def ensure_upload_dir():
    """Ensure upload directory exists."""
    upload_dir = Path(settings.UPLOAD_DIR)
    upload_dir.mkdir(parents=True, exist_ok=True)
    return upload_dir


@router.post("", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile = File(...),
    source: str = Query("document", description="Upload context: document (Documents module) or chat"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Upload a document.
    Documents module uploads use source=document; chat attachments use source=chat.
    """
    normalized_source = (source or "document").strip().lower()
    if normalized_source not in ALLOWED_UPLOAD_SOURCES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid source. Allowed values: {', '.join(sorted(ALLOWED_UPLOAD_SOURCES))}",
        )

    file_content = await file.read()
    file_size = len(file_content)
    
    if file_size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File size exceeds maximum allowed size of {MAX_FILE_SIZE / (1024 * 1024)}MB"
        )
    
    upload_dir = ensure_upload_dir()
    
    file_uuid = str(uuid.uuid4())
    storage_filename = file_uuid
    storage_path = upload_dir / storage_filename
    
    with open(storage_path, "wb") as f:
        f.write(file_content)
    
    document = Document(
        filename=storage_filename,
        original_filename=file.filename,
        file_size_bytes=file_size,
        mime_type=file.content_type or "application/octet-stream",
        storage_path=str(storage_path),
        uploaded_by_user_id=current_user.id, # Strict owner derivation
        source=normalized_source,
    )
    
    db.add(document)
    db.commit()
    db.refresh(document)
    
    # Activity Log
    log_activity(
        db=db,
        entity_type="Document",
        entity_id=str(document.id),
        action_type="UPLOAD",
        performed_by_user_id=str(current_user.id),
        old_value=None,
        new_value={
            "original_filename": document.original_filename,
            "file_size_bytes": document.file_size_bytes,
            "mime_type": document.mime_type,
            "uploaded_by_user_id": str(document.uploaded_by_user_id)
        }
    )
    
    return document


@router.get("", response_model=DocumentListResponse)
def list_documents(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    branch_user_id: Optional[UUID] = Query(None, description="Admin only: filter by branch"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List documents uploaded via the Documents module only.
    Task attachments, chat files, and call notes are excluded.
    """
    branch_ids = resolve_admin_branch_ids(branch_user_id, current_user, db)
    if branch_ids is not None and not branch_ids:
        return DocumentListResponse(documents=[], total=0, page=page, page_size=page_size)

    query = db.query(Document).filter(Document.source == "document")
    if branch_ids is not None:
        query = query.filter(Document.uploaded_by_user_id.in_(branch_ids))
    
    total = query.count()
    documents = query.order_by(Document.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    
    return DocumentListResponse(
        documents=documents,
        total=total,
        page=page,
        page_size=page_size
    )


@router.get("/{document_id}")
def download_document(
    document_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Download a document.
    Task attachments: task owner or assigned user (or Admin).
    Documents module uploads: uploader or Admin.
    Call notes: daily-call owner while not expired.
    """
    document = db.query(Document).filter(Document.id == document_id).first()
    
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )

    # Phase 12: call notes are short-lived and private.
    # If this document is linked to any call note for a DailyCall, enforce:
    # - only the daily-call owner can download it
    # - expired notes return 410 Gone
    now = datetime.now(timezone.utc)
    has_valid_call_note_link = (
        db.query(CallNotesFile.id)
        .join(DailyCall, DailyCall.id == CallNotesFile.daily_call_id)
        .filter(
            CallNotesFile.file_id == document.id,
            DailyCall.user_id == current_user.id,
            CallNotesFile.expires_at >= now,
        )
        .first()
        is not None
    )

    if has_valid_call_note_link:
        pass  # allowed — fall through to file streaming
    else:
        has_any_call_note_link_for_user = (
            db.query(CallNotesFile.id)
            .join(DailyCall, DailyCall.id == CallNotesFile.daily_call_id)
            .filter(
                CallNotesFile.file_id == document.id,
                DailyCall.user_id == current_user.id,
            )
            .first()
            is not None
        )

        if has_any_call_note_link_for_user:
            raise HTTPException(status_code=status.HTTP_410_GONE, detail="Call notes file expired")

        has_any_call_note_link_any_user = db.query(CallNotesFile.id).filter(CallNotesFile.file_id == document.id).first()
        if has_any_call_note_link_any_user:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have access to this file")

        if not user_can_download_document(db, document, current_user):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to download this file.",
            )
    
    if not os.path.exists(document.storage_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found on disk"
        )
    
    def file_iterator():
        with open(document.storage_path, "rb") as f:
            while chunk := f.read(8192):
                yield chunk
    
    return StreamingResponse(
        file_iterator(),
        media_type=document.mime_type,
        headers={
            "Content-Disposition": f'attachment; filename="{document.original_filename}"'
        }
    )


@router.delete("/{document_id}", status_code=status.HTTP_200_OK)
def delete_document(
    document_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    Delete a document (admin only).
    Hard delete - removes file and database record.
    """
    document = db.query(Document).filter(Document.id == document_id).first()
    
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    # Capture full snapshot before delete
    snapshot = {
        "id": str(document.id),
        "filename": document.filename,
        "original_filename": document.original_filename,
        "file_size_bytes": document.file_size_bytes,
        "mime_type": document.mime_type,
        "uploaded_by_user_id": str(document.uploaded_by_user_id)
    }

    if os.path.exists(document.storage_path):
        os.remove(document.storage_path)
    
    db.delete(document)
    db.commit()
    
    # Activity Log
    log_activity(
        db=db,
        entity_type="Document",
        entity_id=str(document_id),
        action_type="DELETE",
        performed_by_user_id=str(current_user.id),
        old_value=snapshot,
        new_value=None
    )
    
    return {"message": f"Document '{document.original_filename}' deleted successfully"}
