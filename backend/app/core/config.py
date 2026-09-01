from pydantic_settings import BaseSettings
from typing import List, Optional


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # Database
    DATABASE_URL: str
    
    # JWT Configuration
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int
    REFRESH_TOKEN_EXPIRE_DAYS: int
    
    # Application
    APP_NAME: str = "BWC Task Manager"
    DEBUG: bool = False

    # CORS
    # Comma-separated list of allowed origins. Kept as a plain string because
    # pydantic-settings would try to JSON-decode a List[str] env value.
    # Read it via the CORS_ALLOWED_ORIGINS_LIST property, never directly.
    CORS_ALLOWED_ORIGINS: str = "https://app.becausewecan.gr"

    # File Upload
    UPLOAD_DIR: str = "./uploads"

    # Chatbot / Groq LLM
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "llama-3.3-70b-versatile"
    CHATBOT_MAX_TOOL_ITERATIONS: int = 5
    CHATBOT_MAX_HISTORY_MESSAGES: int = 20
    CHATBOT_MAX_USER_MESSAGE_CHARS: int = 4000
    CHATBOT_REQUEST_TIMEOUT_SECONDS: float = 30.0
    
    @property
    def CORS_ALLOWED_ORIGINS_LIST(self) -> List[str]:
        """CORS_ALLOWED_ORIGINS split on commas, whitespace stripped, blanks dropped.

        Falls back to the production app origin if the variable is set but
        empty, so a blank env value cannot silently widen or blank out CORS.
        """
        origins = [o.strip() for o in self.CORS_ALLOWED_ORIGINS.split(",") if o.strip()]
        return origins or ["https://app.becausewecan.gr"]

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"


settings = Settings()
