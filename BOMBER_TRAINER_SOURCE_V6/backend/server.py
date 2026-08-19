from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

@app.get("/health")
def health():
    return {"ok": True, "ai_configured": bool(os.getenv("OPENAI_API_KEY"))}

@app.post("/integrated-ai/stream")
async def integrated_ai(payload: dict):
    """Placeholder endpoint; production AI integration should be implemented here."""
    return {"error": "AI endpoint not implemented"}
