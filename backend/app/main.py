from fastapi import FastAPI
from sqlalchemy import text

from app.api.v1.auth import router as auth_router
from app.api.v1.users import router as users_router
from app.api.v1.vehicles import router as vehicles_router
from app.core.database import engine


app = FastAPI()


app.include_router(users_router)
app.include_router(auth_router)
app.include_router(vehicles_router)


@app.get("/")
def root():
    return {"message": "Welcome to Road-Trip OS!"}


@app.get("/health")
def health_check():
    with engine.connect() as connection:
        result = connection.execute(text("SELECT 1"))

    return {"database": result.scalar() == 1}