from fastapi import APIRouter

from app.config import settings
from app.schemas.auth import DemoLoginResponse

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/demo-login", response_model=DemoLoginResponse)
def demo_login():
    return DemoLoginResponse(token=settings.demo_token)
