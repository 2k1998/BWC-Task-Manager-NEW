from __future__ import annotations

from uuid import UUID

from sqlalchemy.orm import Session

from app.models.user import User
from app.models.user_profile import UserProfile
from app.utils.hierarchy import get_visible_user_ids, is_hierarchy_manager
from app.utils.permissions import get_user_module_permissions_map, user_has_permission

_MODULE_NONE_NOTE = "You do not have access to this module."


class ChatbotToolContext:
    """Security boundary for chatbot data tools — caches hierarchy and permission lookups."""

    def __init__(self, user: User, db: Session) -> None:
        self.user = user
        self.db = db
        self._visible_user_ids: list[UUID] | None = None
        self._visible_user_ids_cached = False
        self._permissions_map: dict[str, str] | None = None
        self._module_view_cache: dict[str, bool] = {}
        self._language: str | None = None

    def visible_user_ids(self) -> list[UUID] | None:
        if not self._visible_user_ids_cached:
            self._visible_user_ids = get_visible_user_ids(self.user, self.db)
            self._visible_user_ids_cached = True
        return self._visible_user_ids

    def is_admin(self) -> bool:
        return self.user.user_type == "Admin"

    def is_hierarchy_manager(self) -> bool:
        return is_hierarchy_manager(self.user.user_type)

    def module_access_level(self, module: str) -> str:
        if self._permissions_map is None:
            self._permissions_map = get_user_module_permissions_map(self.db, self.user.id)
        return self._permissions_map.get(module, "none")

    def can_view(self, module: str) -> bool:
        if module in self._module_view_cache:
            return self._module_view_cache[module]
        if self.is_admin():
            result = True
        else:
            result = user_has_permission(self.user.id, module, "view", self.db)
        self._module_view_cache[module] = result
        return result

    def no_module_access_message(self, module: str) -> str | None:
        """FILTERED policy: none access returns a note (no data)."""
        if self.is_admin() or self.module_access_level(module) != "none":
            return None
        return _MODULE_NONE_NOTE

    def filter_by_visible_users(self, query, user_id_column):
        visible_ids = self.visible_user_ids()
        if visible_ids is None:
            return query
        return query.filter(user_id_column.in_(visible_ids))

    def language(self) -> str:
        if self._language is None:
            profile = (
                self.db.query(UserProfile)
                .filter(UserProfile.user_id == self.user.id)
                .first()
            )
            self._language = profile.language if profile and profile.language else "el"
        return self._language
