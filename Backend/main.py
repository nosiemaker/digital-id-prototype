import os
import sys
import django
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

sys.path.insert(0, os.path.dirname(__file__))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "zdid_core.settings")
django.setup()

from routers.sysuser_registration import third_party_router, user_router
from routers import citizen_registration, hospital, audit_router
from routers import auth, citizens, kyc, digital_id, qr_router, districts, reports_router
from middleware.auth import AuthMiddleware
from Utils.audit_logger import AuditMiddleware


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create directory for generated PDFs on startup
    os.makedirs(os.path.join(os.path.dirname(__file__), "media", "generated_pdfs"), exist_ok=True)
    yield

load_dotenv()

app = FastAPI(
    title="ZDID API Gateway",
    description="Backend for zambia Digital ID",
    lifespan=lifespan,
)

# Include routers
app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(citizens.router, tags=["citizens"])
app.include_router(citizen_registration.router,prefix="/enrollments", tags=["enrollments"])
app.include_router(hospital.birth_router,prefix="/births", tags=["birth_records"])
app.include_router(hospital.death_router,prefix="/deaths", tags=["death_records"])
app.include_router(user_router,prefix="/users", tags=["users"])
app.include_router(third_party_router,prefix="/third_party", tags=["third_party"])
app.include_router(kyc.router, prefix="/kyc", tags=["kyc"])
app.include_router(qr_router.router, prefix="/qr", tags=["qr"])
app.include_router(districts.router, prefix="/districts", tags=["Locations"])
app.include_router(audit_router.router, prefix="/audit_logs", tags=["Audit Logs"])
app.include_router(reports_router.router, prefix="/reports", tags=["auth"])
app.include_router(digital_id.router)


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

app.mount("/media", StaticFiles(directory="media"), name="media")
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
async def root():
    return {"message": "ZDID Backend is live"}

# Mount Django app at the root to handle /admin and /static
from django.core.wsgi import get_wsgi_application
from fastapi.middleware.wsgi import WSGIMiddleware

django_app = get_wsgi_application()
app.mount("/", WSGIMiddleware(django_app))
