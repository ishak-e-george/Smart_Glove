import time
import uuid
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1.router import api_router
from app.core.config import settings
from app.core.logging import setup_logging, request_id_ctx_var, logger

# Initialize logging
setup_logging()

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8081",
        "http://127.0.0.1:8081",
        "http://localhost:8082",
        "http://127.0.0.1:8082",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def add_request_id_and_log(request: Request, call_next):
    request_id = str(uuid.uuid4())
    token = request_id_ctx_var.set(request_id)
    start_time = time.time()
    
    logger.info(f"Request started: {request.method} {request.url.path}")
    
    try:
        response = await call_next(request)
        process_time = time.time() - start_time
        response.headers["X-Request-ID"] = request_id
        logger.info(
            f"Request finished: {request.method} {request.url.path} "
            f"Status: {response.status_code} "
            f"Time: {process_time:.3f}s"
        )
        return response
    finally:
        request_id_ctx_var.reset(token)

app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/")
def root():
    return {"message": "Welcome to Smart Glove API"}
