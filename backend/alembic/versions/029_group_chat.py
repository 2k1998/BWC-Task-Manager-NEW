"""029_group_chat — make the chat schema truly support group threads.

Context: group-chat columns (chat_threads.is_group/group_name/created_by,
the chat_thread_members table, chat_messages.message_type/approval_status)
were hand-patched into the local dev DB without a migration, while the
legacy 1-to-1 constraints (uq_chat_threads_user_pair, ck_chat_threads_user_order,
NOT NULL user_one_id/user_two_id) were left in place. Production may have
neither the patch nor the members table.

Every step below is therefore conditional so this runs safely on both:
  - drop the 1-to-1 pair constraints if present
  - relax user_one_id / user_two_id to nullable
  - add is_group / group_name / created_by if missing (fix nullability if present)
  - add chat_messages.message_type / approval_status if missing; index thread_id
  - create chat_thread_members if missing; otherwise add role column,
    dedupe rows, add UNIQUE(thread_id, user_id), and realign CASCADE FKs
    to RESTRICT (house rule)
  - backfill chat_thread_members from user_one_id/user_two_id so existing
    threads stay visible once the junction table is the source of truth
  - backfill role='owner' (created_by, falling back to earliest joined_at)

Revision ID: 029_group_chat
Revises: 028_payment_type_expand
Create Date: 2026-09-01
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "029_group_chat"
down_revision = "028_payment_type_expand"
branch_labels = None
depends_on = None


def _insp(conn):
    return sa.inspect(conn)


def _has_table(conn, name: str) -> bool:
    return _insp(conn).has_table(name)


def _columns(conn, table: str) -> dict:
    return {c["name"]: c for c in _insp(conn).get_columns(table)}


def _unique_names(conn, table: str) -> set:
    return {c["name"] for c in _insp(conn).get_unique_constraints(table)}


def _unique_constraints(conn, table: str) -> list:
    return _insp(conn).get_unique_constraints(table)


def _check_names(conn, table: str) -> set:
    return {c["name"] for c in _insp(conn).get_check_constraints(table)}


def _index_columns(conn, table: str) -> list:
    return [tuple(ix["column_names"]) for ix in _insp(conn).get_indexes(table)]


def upgrade() -> None:
    conn = op.get_bind()

    # ------------------------------------------------------------------
    # 1. chat_threads: drop 1-to-1 constraints, relax pair columns,
    #    ensure group columns exist.
    # ------------------------------------------------------------------
    if "uq_chat_threads_user_pair" in _unique_names(conn, "chat_threads"):
        op.drop_constraint("uq_chat_threads_user_pair", "chat_threads", type_="unique")
    if "ck_chat_threads_user_order" in _check_names(conn, "chat_threads"):
        op.drop_constraint("ck_chat_threads_user_order", "chat_threads", type_="check")

    thread_cols = _columns(conn, "chat_threads")
    for col in ("user_one_id", "user_two_id"):
        if not thread_cols[col]["nullable"]:
            op.alter_column("chat_threads", col, nullable=True)

    if "is_group" not in thread_cols:
        op.add_column(
            "chat_threads",
            sa.Column("is_group", sa.Boolean(), server_default=sa.text("FALSE"), nullable=False),
        )
    elif thread_cols["is_group"]["nullable"]:
        conn.execute(sa.text("UPDATE chat_threads SET is_group = FALSE WHERE is_group IS NULL"))
        op.alter_column(
            "chat_threads", "is_group",
            nullable=False, server_default=sa.text("FALSE"),
        )

    if "group_name" not in thread_cols:
        op.add_column("chat_threads", sa.Column("group_name", sa.String(), nullable=True))

    if "created_by" not in thread_cols:
        op.add_column(
            "chat_threads",
            sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        )
        op.create_foreign_key(
            "fk_chat_threads_created_by_users",
            "chat_threads", "users",
            ["created_by"], ["id"],
            ondelete="RESTRICT",
        )

    # ------------------------------------------------------------------
    # 2. chat_messages: message_type / approval_status columns + thread index.
    # ------------------------------------------------------------------
    message_cols = _columns(conn, "chat_messages")
    if "message_type" not in message_cols:
        op.add_column(
            "chat_messages",
            sa.Column("message_type", sa.String(), server_default=sa.text("'text'"), nullable=False),
        )
    elif message_cols["message_type"]["nullable"]:
        conn.execute(sa.text("UPDATE chat_messages SET message_type = 'text' WHERE message_type IS NULL"))
        op.alter_column(
            "chat_messages", "message_type",
            nullable=False, server_default=sa.text("'text'"),
        )

    if "approval_status" not in message_cols:
        op.add_column("chat_messages", sa.Column("approval_status", sa.String(), nullable=True))

    if ("thread_id",) not in _index_columns(conn, "chat_messages"):
        op.create_index("ix_chat_messages_thread_id", "chat_messages", ["thread_id"])

    # ------------------------------------------------------------------
    # 3. chat_thread_members: create, or bring existing table up to spec.
    # ------------------------------------------------------------------
    if not _has_table(conn, "chat_thread_members"):
        op.create_table(
            "chat_thread_members",
            sa.Column(
                "id", postgresql.UUID(as_uuid=True),
                primary_key=True, server_default=sa.text("gen_random_uuid()"), nullable=False,
            ),
            sa.Column("thread_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("role", sa.String(), server_default=sa.text("'member'"), nullable=False),
            sa.Column(
                "joined_at", sa.DateTime(timezone=True),
                server_default=sa.text("NOW()"), nullable=False,
            ),
            sa.ForeignKeyConstraint(["thread_id"], ["chat_threads.id"], ondelete="RESTRICT"),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="RESTRICT"),
            sa.UniqueConstraint("thread_id", "user_id", name="uq_chat_thread_members_thread_user"),
            sa.CheckConstraint("role IN ('owner', 'member')", name="ck_chat_thread_members_role"),
        )
        op.create_index("ix_chat_thread_members_thread_id", "chat_thread_members", ["thread_id"])
        op.create_index("ix_chat_thread_members_user_id", "chat_thread_members", ["user_id"])
    else:
        member_cols = _columns(conn, "chat_thread_members")
        if "role" not in member_cols:
            op.add_column(
                "chat_thread_members",
                sa.Column("role", sa.String(), server_default=sa.text("'member'"), nullable=False),
            )
        if "ck_chat_thread_members_role" not in _check_names(conn, "chat_thread_members"):
            op.create_check_constraint(
                "ck_chat_thread_members_role",
                "chat_thread_members",
                "role IN ('owner', 'member')",
            )

        # Dedupe (no unique constraint may exist yet, duplicates are possible)
        # before adding UNIQUE(thread_id, user_id).
        conn.execute(sa.text(
            """
            DELETE FROM chat_thread_members a
            USING chat_thread_members b
            WHERE a.thread_id = b.thread_id
              AND a.user_id = b.user_id
              AND a.ctid > b.ctid
            """
        ))
        # Normalize to a single, canonically named unique constraint on
        # (thread_id, user_id) — the hand-patched DB may carry an auto-named one.
        pair_constraints = [
            uc for uc in _unique_constraints(conn, "chat_thread_members")
            if set(uc["column_names"]) == {"thread_id", "user_id"}
        ]
        for uc in pair_constraints:
            if uc["name"] != "uq_chat_thread_members_thread_user":
                op.drop_constraint(uc["name"], "chat_thread_members", type_="unique")
        if not any(uc["name"] == "uq_chat_thread_members_thread_user" for uc in pair_constraints):
            op.create_unique_constraint(
                "uq_chat_thread_members_thread_user",
                "chat_thread_members",
                ["thread_id", "user_id"],
            )

        # Align nullability drift from the hand patch.
        if _columns(conn, "chat_thread_members")["joined_at"]["nullable"]:
            conn.execute(sa.text("UPDATE chat_thread_members SET joined_at = NOW() WHERE joined_at IS NULL"))
            op.alter_column(
                "chat_thread_members", "joined_at",
                nullable=False, server_default=sa.text("NOW()"),
            )

        # House rule: all FKs use RESTRICT. The hand-patched table used CASCADE.
        for fk in _insp(conn).get_foreign_keys("chat_thread_members"):
            if (fk.get("options") or {}).get("ondelete", "").upper() == "CASCADE":
                op.drop_constraint(fk["name"], "chat_thread_members", type_="foreignkey")
                op.create_foreign_key(
                    fk["name"],
                    "chat_thread_members",
                    fk["referred_table"],
                    fk["constrained_columns"],
                    fk["referred_columns"],
                    ondelete="RESTRICT",
                )

    # ------------------------------------------------------------------
    # 4. Backfill membership rows from the legacy pair columns so existing
    #    threads remain visible when queries trust the junction table.
    # ------------------------------------------------------------------
    for col in ("user_one_id", "user_two_id"):
        conn.execute(sa.text(
            f"""
            INSERT INTO chat_thread_members (thread_id, user_id)
            SELECT t.id, t.{col}
            FROM chat_threads t
            WHERE t.{col} IS NOT NULL
              AND NOT EXISTS (
                  SELECT 1 FROM chat_thread_members m
                  WHERE m.thread_id = t.id AND m.user_id = t.{col}
              )
            """
        ))

    # ------------------------------------------------------------------
    # 5. Backfill owner roles: created_by first, else earliest joiner.
    # ------------------------------------------------------------------
    conn.execute(sa.text(
        """
        UPDATE chat_thread_members m
        SET role = 'owner'
        FROM chat_threads t
        WHERE m.thread_id = t.id
          AND t.created_by IS NOT NULL
          AND m.user_id = t.created_by
          AND m.role <> 'owner'
        """
    ))
    conn.execute(sa.text(
        """
        UPDATE chat_thread_members
        SET role = 'owner'
        WHERE id IN (
            SELECT DISTINCT ON (thread_id) id
            FROM chat_thread_members
            WHERE thread_id NOT IN (
                SELECT thread_id FROM chat_thread_members WHERE role = 'owner'
            )
            ORDER BY thread_id, joined_at ASC, id ASC
        )
        """
    ))


def downgrade() -> None:
    """Remove only what this migration added.

    The legacy 1-to-1 constraints (uq_chat_threads_user_pair,
    ck_chat_threads_user_order, NOT NULL pair columns) are NOT restored:
    group threads created after upgrade would violate them, so restoring
    is unsafe. Upgrade is fully re-runnable after this downgrade.
    """
    conn = op.get_bind()

    if _has_table(conn, "chat_thread_members"):
        if "uq_chat_thread_members_thread_user" in _unique_names(conn, "chat_thread_members"):
            op.drop_constraint(
                "uq_chat_thread_members_thread_user", "chat_thread_members", type_="unique"
            )
        if "ck_chat_thread_members_role" in _check_names(conn, "chat_thread_members"):
            op.drop_constraint(
                "ck_chat_thread_members_role", "chat_thread_members", type_="check"
            )
        if "role" in _columns(conn, "chat_thread_members"):
            op.drop_column("chat_thread_members", "role")

    if ("thread_id",) in _index_columns(conn, "chat_messages"):
        op.drop_index("ix_chat_messages_thread_id", table_name="chat_messages", if_exists=True)
