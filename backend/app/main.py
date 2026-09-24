import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.api.v1.auth import router as auth_router
from app.api.v1.users import router as users_router
from app.api.v1.vehicles import router as vehicles_router
from app.core.database import engine
from app.api.v1.trips import router as trips_router
from app.api.v1.trip_destinations import router as trip_destinations_router
from app.api.v1.itineraries import router as itineraries_router
from app.api.v1.trip_fuel import router as trip_fuel_router
from app.api.v1.user_settings import router as user_settings_router
from app.api.v1.fuel_stations import router as fuel_stations_router
from app.api.v1 import itineraries
from app.api.v1.ev_charging import router as ev_charging_router
from app.api.v1.trip_ev import router as trip_ev_router
from app.api.v1.ev_status import router as ev_status_router
from app.api.v1.trip_budget import router as trip_budget_router
from app.api.v1.weather import router as weather_router
from app.api.v1.elevation import router as elevation_router
from app.api.v1.routes import router as routes_router
from app.api.v1.checklists import router as checklists_router


load_dotenv()

# Comma-separated list of origins allowed to call the API from a browser.
# Defaults to the Expo web dev server.
CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:8081,http://127.0.0.1:8081",
    ).split(",")
    if origin.strip()
]


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(users_router)
app.include_router(auth_router)
app.include_router(vehicles_router)
app.include_router(trips_router)
app.include_router(trip_destinations_router)
app.include_router(itineraries_router)
app.include_router(trip_fuel_router)
app.include_router(user_settings_router)
app.include_router(fuel_stations_router)
app.include_router(ev_charging_router)
app.include_router(trip_ev_router)
app.include_router(ev_status_router)
app.include_router(trip_budget_router)
app.include_router(weather_router)
app.include_router(elevation_router)
app.include_router(routes_router)
app.include_router(checklists_router)


@app.get("/")
def root():
    return {"message": "Welcome to Road-Trip OS!"}


@app.get("/health")
def health_check():
    with engine.connect() as connection:
        result = connection.execute(text("SELECT 1"))

    return {"database": result.scalar() == 1}