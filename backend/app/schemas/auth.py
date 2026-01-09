from pydantic import BaseModel


class DemoLoginResponse(BaseModel):
    token: str
