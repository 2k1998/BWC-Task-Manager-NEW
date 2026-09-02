import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)

from app.api.auth import router as auth_router
from app.api.admin_users import router as admin_users_router
from app.api.admin_branch import router as admin_branch_router
from app.api.companies import router as companies_router
from app.api.admin_departments import router as admin_departments_router
from app.api.teams import router as teams_router
from app.api.tasks import router as tasks_router
from app.api.projects import router as projects_router
from app.api.events import router as events_router
from app.api.documents import router as documents_router
from app.api.activity_logs import router as activity_logs_router
from app.api.notifications import router as notifications_router
from app.api.contacts import router as contacts_router
from app.api.daily_calls import router as daily_calls_router
from app.api.payments import router as payments_router
from app.api.cars import router as cars_router
from app.api.profile import router as profile_router
from app.api.presence import router as presence_router
from app.api.chat import router as chat_router
from app.api.chatbot import router as chatbot_router
from app.api.approvals import router as approvals_router
from app.api.analytics import router as analytics_router
from app.api.users import router as users_router
from app.routers.departments import router as departments_router
from app.services.daily_call_reminder_service import (
    start_daily_call_reminder_loop,
    stop_daily_call_reminder_loop,
)
from app.services.retention_jobs import start_retention_scheduler, stop_retention_scheduler
from app.core.config import settings
from app.core.rate_limit import limiter

logger = logging.getLogger(__name__)


def _upgrade_database() -> None:
    """Apply pending Alembic migrations. Render does not run `alembic upgrade`
    in the start command, so production would otherwise stay behind head.
    """
    from alembic import command
    from alembic.config import Config

    ini_path = Path(__file__).resolve().parent.parent / "alembic.ini"
    alembic_cfg = Config(str(ini_path))
    logger.info("Running alembic upgrade head (%s)", ini_path)
    command.upgrade(alembic_cfg, "head")
    logger.info("Database migrations are up to date")


@asynccontextmanager
async def lifespan(_: FastAPI):
    _upgrade_database()
    start_daily_call_reminder_loop()
    start_retention_scheduler()
    try:
        yield
    finally:
        stop_retention_scheduler()
        stop_daily_call_reminder_loop()


# Create FastAPI application
app = FastAPI(
    title=settings.APP_NAME,
    description="Backend API for BWC Task Manager",
    version="1.0.0",
    debug=settings.DEBUG,
    lifespan=lifespan,
)

# Rate limiting.
# The limiter buckets by the first hop of X-Forwarded-For because the app runs
# behind Render's reverse proxy - see app/core/rate_limit.py. This REQUIRES
# uvicorn to be started with proxy headers trusted, e.g.
#   uvicorn app.main:app --host 0.0.0.0 --port $PORT --proxy-headers --forwarded-allow-ips="*"
# Without those flags X-Forwarded-For is attacker-controlled and the per-IP
# buckets can be trivially evaded.
# Per-endpoint limits are applied with @limiter.limit(...) on the handlers
# (see app/api/auth.py); those handlers must take `request: Request` first.
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Configure CORS.
# Origins come from the CORS_ALLOWED_ORIGINS env var (comma-separated) and
# default to the production app origin. Append http://localhost:3001 in your
# local .env for dev - never hardcode it here.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ALLOWED_ORIGINS_LIST,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(auth_router)
app.include_router(admin_users_router)
app.include_router(admin_branch_router)
app.include_router(companies_router)
app.include_router(admin_departments_router)
app.include_router(teams_router)
app.include_router(tasks_router)
app.include_router(projects_router)
app.include_router(events_router)
app.include_router(documents_router)
app.include_router(activity_logs_router)
app.include_router(notifications_router)
app.include_router(contacts_router)
app.include_router(daily_calls_router)
app.include_router(payments_router)
app.include_router(cars_router)
app.include_router(profile_router)
app.include_router(presence_router)
app.include_router(chat_router)
app.include_router(chatbot_router)
app.include_router(approvals_router)
app.include_router(analytics_router)
app.include_router(users_router)
app.include_router(departments_router)


@app.get("/")
def root():
    """Root endpoint."""
    return {
        "message": "BWC Task Manager API",
        "version": "1.0.0",
        "status": "running"
    }


@app.get("/health")
def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}

