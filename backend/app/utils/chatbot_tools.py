from __future__ import annotations

import json
import logging

from sqlalchemy.orm import Session

from app.models.user import User
from app.models.user_profile import UserProfile
from app.utils.chatbot_context import ChatbotToolContext
from app.utils.chatbot_data_tools import (
    get_app_stats,
    get_my_contacts,
    get_my_projects,
    get_my_tasks,
    get_team_members,
    get_team_workload,
)
from app.utils.chatbot_knowledge import search_knowledge_base

logger = logging.getLogger(__name__)

TOOL_DEFINITIONS = [
    {
        "type": "function",
        "function": {
            "name": "search_knowledge_base",
            "description": (
                "Search the BWC Task Manager knowledge base for documented information about "
                "how the app works: features, how-tos, role/hierarchy rules, urgency labels, "
                "task statuses, module behavior. ALWAYS call this before answering 'how do I…', "
                "'what is…', or any factual question about the app."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": (
                            "Keywords from the user's question. Keep it short, 2-5 words."
                        ),
                    }
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_my_tasks",
            "description": (
                "Retrieve the current user's tasks (theirs and those visible in their branch). "
                "Use whenever the user asks 'what are my tasks', 'show me my open tasks', "
                "'what's due today', 'tasks assigned to me', or any factual question about "
                "tasks in their scope."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "status": {
                        "type": "string",
                        "description": (
                            "Optional. Filter by status: New, Received, On Process, Pending, "
                            "Completed, or Loose End."
                        ),
                    },
                    "urgency_label": {
                        "type": "string",
                        "description": (
                            "Optional. Filter by urgency: Urgent & Important, Urgent, Important, "
                            "Not Urgent & Not Important, or Orange."
                        ),
                    },
                    "assigned_to_me": {
                        "type": "boolean",
                        "description": "Optional. If true, only tasks assigned to the current user.",
                    },
                    "created_by_me": {
                        "type": "boolean",
                        "description": "Optional. If true, only tasks owned/created by the current user.",
                    },
                    "due_before": {
                        "type": "string",
                        "description": (
                            "Optional. ISO date YYYY-MM-DD — tasks with deadline on or before this date."
                        ),
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Optional. Max results (default 10, max 25).",
                    },
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_my_projects",
            "description": (
                "Retrieve projects visible to the current user (owned or managed by them; "
                "Admin sees all). Use for 'my projects', 'what projects am I on', "
                "'projects in progress', or status-filtered project lists."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "status": {
                        "type": "string",
                        "description": (
                            "Optional. Filter by status: Planning, In Progress, Completed, "
                            "On Hold, or Canceled."
                        ),
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Optional. Max results (default 10, max 25).",
                    },
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_my_contacts",
            "description": (
                "Retrieve the current user's personal contacts (not shared across the branch). "
                "Use for 'find a contact', 'who is X', 'contact info for Y', or phone/email lookup."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "search": {
                        "type": "string",
                        "description": (
                            "Optional. Search by first name, last name, phone, or email (partial match)."
                        ),
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Optional. Max results (default 10, max 25).",
                    },
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_team_members",
            "description": (
                "Retrieve members of the current user's team. Use this for 'who is on my team', "
                "'who reports to me', 'show me my direct reports'. For include_indirect=true, "
                "returns the entire branch under the user."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "include_indirect": {
                        "type": "boolean",
                        "description": (
                            "Optional. Default false. If true, includes all descendants in the "
                            "branch; if false, only direct reports (parent_id equals current user)."
                        ),
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Optional. Max results (default 25, max 50).",
                    },
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_team_workload",
            "description": (
                "Retrieve a workload summary across the user's team — open tasks, overdue counts, "
                "and recently completed tasks per team member. Use for 'how busy is my team', "
                "'who has the most open tasks', 'team workload report'. Only available to Heads, "
                "Managers, Pillars, and Admins."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "days_back": {
                        "type": "integer",
                        "description": (
                            "Optional. Days to count recently completed tasks (default 30, max 90)."
                        ),
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Optional. Max team members to return (default 10, max 25).",
                    },
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_app_stats",
            "description": (
                "Retrieve the current user's personal task statistics — open, overdue, due today, "
                "due this week, completed recently. Use for 'what's my workload', 'how am I doing', "
                "'give me a summary', 'do I have anything urgent'."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "days_back": {
                        "type": "integer",
                        "description": (
                            "Optional. Days window for completed count (default 7, max 90)."
                        ),
                    },
                },
                "required": [],
            },
        },
    },
]


def _get_user_language(db: Session, user: User) -> str:
    profile = db.query(UserProfile).filter(UserProfile.user_id == user.id).first()
    if profile and profile.language:
        return profile.language
    return "en"


def execute_tool(tool_name: str, arguments_json: str, user: User, db: Session) -> str:
    try:
        args = json.loads(arguments_json)
    except (json.JSONDecodeError, TypeError):
        logger.warning("Invalid tool arguments JSON: %r", arguments_json)
        return "Error: tool arguments were not valid JSON."

    if not isinstance(args, dict):
        args = {}

    ctx = ChatbotToolContext(user, db)

    if tool_name == "search_knowledge_base":
        language = _get_user_language(db, user)
        results = search_knowledge_base(
            query=args.get("query", ""),
            language=language,
            db=db,
        )
        if not results:
            return "No matching knowledge base articles found."

        blocks = [f"# {row['topic']}\n{row['content']}" for row in results]
        return "\n\n---\n\n".join(blocks)

    if tool_name == "get_my_tasks":
        return get_my_tasks(args, ctx)
    if tool_name == "get_my_projects":
        return get_my_projects(args, ctx)
    if tool_name == "get_my_contacts":
        return get_my_contacts(args, ctx)
    if tool_name == "get_team_members":
        return get_team_members(args, ctx)
    if tool_name == "get_team_workload":
        return get_team_workload(args, ctx)
    if tool_name == "get_app_stats":
        return get_app_stats(args, ctx)

    logger.warning("Unknown chatbot tool requested: %s", tool_name)
    return f"Unknown tool: {tool_name}"
