from fastapi import FastAPI, APIRouter, HTTPException, Request
from fastapi.responses import FileResponse, Response, StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import httpx
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List
import uuid
from datetime import datetime, timezone

BACKUPS_DIR = Path("/app/backups")
POCKETBASE_URL = os.environ.get("POCKETBASE_URL", "http://127.0.0.1:8090")
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

class StatusCheck(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StatusCheckCreate(BaseModel):
    client_name: str

@api_router.get("/")
async def root():
    return {"message": "Hello World"}

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.model_dump()
    status_obj = StatusCheck(**status_dict)
    doc = status_obj.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    await db.status_checks.insert_one(doc)
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    status_checks = await db.status_checks.find({}, {"_id": 0}).to_list(1000)
    for check in status_checks:
        if isinstance(check['timestamp'], str):
            check['timestamp'] = datetime.fromisoformat(check['timestamp'])
    return status_checks

@api_router.get("/backups")
async def list_backups():
    if not BACKUPS_DIR.exists():
        return {"backups": []}
    allowed = ("v3-original-source.zip", "v3-original-handoff.zip", "source.zip", "handoff.zip", "BOMBER_TRAINER_SOURCE_V4.zip", "BOMBER_TRAINER_HANDOFF_V4.zip", "BOMBER_TRAINER_SOURCE_V5.zip", "BOMBER_TRAINER_HANDOFF_V5.zip", "BOMBER_TRAINER_SOURCE_V6.zip", "BOMBER_TRAINER_HANDOFF_V6.zip")
    items = []
    for name in allowed:
        p = BACKUPS_DIR / name
        if p.exists():
            st = p.stat()
            items.append({"name": name, "size_bytes": st.st_size, "modified": datetime.fromtimestamp(st.st_mtime, tz=timezone.utc).isoformat(), "download_url": f"/api/backups/{name}"})
    return {"backups": items}

@api_router.get("/backups/{filename}")
async def download_backup(filename: str):
    allowed = {"v3-original-source.zip", "v3-original-handoff.zip", "source.zip", "handoff.zip", "BOMBER_TRAINER_SOURCE_V4.zip", "BOMBER_TRAINER_HANDOFF_V4.zip", "BOMBER_TRAINER_SOURCE_V5.zip", "BOMBER_TRAINER_HANDOFF_V5.zip", "BOMBER_TRAINER_SOURCE_V6.zip", "BOMBER_TRAINER_HANDOFF_V6.zip"}
    if filename not in allowed:
        raise HTTPException(status_code=404, detail="Backup not found")
    path = BACKUPS_DIR / filename
    if not path.exists():
        raise HTTPException(status_code=404, detail="Backup file missing on disk")
    return FileResponse(path=str(path), media_type="application/zip", filename=filename)

app.include_router(api_router)

_pb_client = httpx.AsyncClient(base_url=POCKETBASE_URL, timeout=30.0)

@app.on_event("shutdown")
async def _close_pb_client():
    await _pb_client.aclose()

@app.api_route("/api/pb/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"])
async def pocketbase_proxy(path: str, request: Request):
    body = await request.body()
    headers = {k: v for k, v in request.headers.items() if k.lower() not in {"host", "content-length"}}
    target = f"/{path}" if not path.startswith("/") else path
    if request.url.query:
        target = f"{target}?{request.url.query}"
    try:
        upstream = await _pb_client.request(request.method, target, content=body, headers=headers)
    except httpx.RequestError as exc:
        raise HTTPException(status_code=502, detail=f"PocketBase unreachable: {exc.__class__.__name__}")
    resp_headers = {k: v for k, v in upstream.headers.items() if k.lower() not in {"content-encoding", "transfer-encoding", "connection", "content-length"}}
    return Response(content=upstream.content, status_code=upstream.status_code, headers=resp_headers, media_type=upstream.headers.get("content-type"))

# AI streaming endpoint. The API key stays server-side in OPENAI_API_KEY.
@app.post("/integrated-ai/stream")
async def integrated_ai_stream(payload: dict):
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY is not configured")
    current = "\n".join(str(p.get("text", "")) for p in payload.get("message", []) if isinstance(p, dict)).strip()
    history = payload.get("history", [])
    messages = [m for m in history if isinstance(m, dict) and m.get("role") in {"user", "assistant"} and isinstance(m.get("content"), str)][-12:]
    messages.append({"role": "user", "content": current})
    upstream = await httpx.AsyncClient(timeout=90).post(
        "https://api.openai.com/v1/responses",
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        json={"model": "gpt-5", "stream": True, "input": messages, "instructions": "Ets Bomber Trainer, entrenador de preparació per a proves de bombers de Catalunya. Respon en català si l'usuari parla en català. Sigues pràctic, directe i no inventis dades. Dona recomanacions segures i demana dades quan faltin.", "max_output_tokens": 900},
    )
    if upstream.status_code >= 400:
        detail = upstream.text
        await upstream.aclose()
        raise HTTPException(status_code=upstream.status_code, detail=detail)

    async def event_stream():
        try:
            async for line in upstream.aiter_lines():
                if not line.startswith("data:"):
                    continue
                raw = line[5:].strip()
                if not raw or raw == "[DONE]":
                    continue
                try:
                    data = __import__("json").loads(raw)
                except Exception:
                    continue
                if data.get("type") == "response.output_text.delta" and data.get("delta"):
                    yield f"data: {__import__('json').dumps({'type':'content','data':{'content':data['delta']}})}\n\n"
            yield "data: {\"type\":\"completed\",\"data\":{\"content\":\"\"}}\n\n"
        finally:
            await upstream.aclose()

    return StreamingResponse(event_stream(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})

app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','), allow_methods=["*"], allow_headers=["*"])

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
