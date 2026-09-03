from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.llama import ask_llama


router = APIRouter(prefix="/api", tags=["chat"])


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)
    context: str = Field(default="", max_length=12000)


class ChatResponse(BaseModel):
    response: str


@router.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest):
    try:
        answer = ask_llama(
            message=req.message,
            context=req.context,
        )

        return {
            "response": answer,
        }

    except RuntimeError as exc:
        raise HTTPException(
            status_code=503,
            detail=str(exc),
        )