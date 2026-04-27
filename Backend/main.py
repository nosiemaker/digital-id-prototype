import os
import sys
import django
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

sys.path.insert(0, os.path.dirname(__file__))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "zdid_core.settings")
django.setup()

from routers.sysuser_registration import third_party_router, user_router
from routers import auth, citizens, citizen_registration,hospital
from routers import auth, citizens, kyc, digital_id, qr, districts
from middleware.auth import AuthMiddleware
from Utils.audit_logger import AuditMiddleware


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield

load_dotenv()

app = FastAPI(
    title="ZDID API Gateway",
    description="Backend for zambia Digital ID",
    lifespan=lifespan,
)

# Include routers
app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(citizens.router, prefix="/citizens", tags=["citizens"])
app.include_router(citizen_registration.router,prefix="/enrollments", tags=["enrollments"])
app.include_router(hospital.birth_router,prefix="/birth_record", tags=["birth_records"])
app.include_router(hospital.death_router,prefix="/death_record", tags=["death_records"])
app.include_router(user_router,prefix="/users", tags=["users"])
app.include_router(third_party_router,prefix="/third_party", tags=["third_party"])
app.include_router(kyc.router, prefix="/kyc", tags=["kyc"])
app.include_router(qr.router, prefix="/qr", tags=["qr"])
app.include_router(districts.router, prefix="/districts", tags=["Locations"])
#app.include_router(digital_id.router)


# Add authentication middleware
app.add_middleware(AuthMiddleware)

# Add audit logging middleware
app.add_middleware(AuditMiddleware)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {"message": "ZDID Backend is live"}
