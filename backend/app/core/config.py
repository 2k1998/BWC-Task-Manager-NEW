from pydantic_settings import BaseSettings
from typing import Optional


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
    
    # File Upload
    UPLOAD_DIR: str = "./uploads"

    # Chatbot / Groq LLM
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "llama-3.3-70b-versatile"
    CHATBOT_MAX_TOOL_ITERATIONS: int = 5
    CHATBOT_MAX_HISTORY_MESSAGES: int = 20
    CHATBOT_MAX_USER_MESSAGE_CHARS: int = 4000
    CHATBOT_REQUEST_TIMEOUT_SECONDS: float = 30.0
    
    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"


settings = Settings()
