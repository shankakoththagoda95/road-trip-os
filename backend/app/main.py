from fastapi import FastAPI
from sqlalchemy import text

from app.api.v1.auth import router as auth_router
from app.api.v1.users import router as users_router
from app.api.v1.vehicles import router as vehicles_router
from app.core.database import engine
from app.api.v1.trips import router as trips_router
from app.api.v1.trip_destinations import router as trip_destinations_router
from app.api.v1.itineraries import router as itineraries_router
from app.api.v1 import itineraries


app = FastAPI()


app.include_router(users_router)
app.include_router(auth_router)
app.include_router(vehicles_router)
app.include_router(trips_router)
app.include_router(trip_destinations_router)
app.include_router(itineraries_router)

@app.get("/")
def root():
    return {"message": "Welcome to Road-Trip OS!"}


@app.get("/health")
def health_check():
    with engine.connect() as connection:
        result = connection.execute(text("SELECT 1"))

    return {"database": result.scalar() == 1}