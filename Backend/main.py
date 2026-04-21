import os
import django
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "zdid_core.settings")

@asynccontextmanager
async def lifespan(app: FastAPI):
    django.setup()
    yield

app = FastAPI(
    title="ZDID API Gateway",
    description="Backend for zambia Digital ID",
    lifespan=lifespan
)

@app.get("/")
async def root():
    return {"message" : "ZDID Backend is live"}