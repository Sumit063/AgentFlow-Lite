import os

from dotenv import load_dotenv

load_dotenv()


class Settings:
    def __init__(self) -> None:
        self.database_url = os.getenv("DATABASE_URL", "sqlite:///./agentflow.db")
        cors_env = os.getenv("CORS_ORIGINS", "http://localhost:3000")
        origins = [origin.strip() for origin in cors_env.split(",") if origin.strip()]
        frontend_url = os.getenv("FRONTEND_URL", "").strip()
        if frontend_url:
            origins.append(frontend_url)
        self.cors_origins = sorted(set(origins))
        self.demo_token = os.getenv("DEMO_TOKEN", "agentflow-demo-token")
        self.app_name = os.getenv("APP_NAME", "AgentFlow Lite")
        self.gemini_api_key = os.getenv("GEMINI_API_KEY", "")
        self.gemini_model = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")


settings = Settings()
