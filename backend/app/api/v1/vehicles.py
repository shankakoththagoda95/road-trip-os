from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.models.vehicle import Vehicle
from app.schemas.vehicle import VehicleCreate, VehicleResponse, VehicleUpdate


router = APIRouter(
    prefix="/vehicles",
    tags=["vehicles"],
)


@router.post("/", response_model=VehicleResponse)
def create_vehicle(
    vehicle_data: VehicleCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    new_vehicle = Vehicle(
        user_id=current_user.id,
        name=vehicle_data.name,
        vehicle_type=vehicle_data.vehicle_type,
        fuel_type=vehicle_data.fuel_type,
        fuel_consumption=vehicle_data.fuel_consumption,
        tank_capacity=vehicle_data.tank_capacity,
        battery_capacity=vehicle_data.battery_capacity,
        energy_consumption=vehicle_data.energy_consumption,
    )

    db.add(new_vehicle)
    db.commit()
    db.refresh(new_vehicle)

    return new_vehicle


@router.get("/", response_model=list[VehicleResponse])
def get_my_vehicles(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    vehicles = db.scalars(
        select(Vehicle)
        .where(Vehicle.user_id == current_user.id)
        .order_by(Vehicle.id)
    ).all()

    return vehicles


@router.get("/{vehicle_id}", response_model=VehicleResponse)
def get_vehicle(
    vehicle_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    vehicle = db.scalar(
        select(Vehicle).where(
            Vehicle.id == vehicle_id,
            Vehicle.user_id == current_user.id,
        )
    )

    if vehicle is None:
        raise HTTPException(
            status_code=404,
            detail="Vehicle not found",
        )

    return vehicle


@router.put("/{vehicle_id}", response_model=VehicleResponse)
def update_vehicle(
    vehicle_id: int,
    vehicle_data: VehicleUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    vehicle = db.scalar(
        select(Vehicle).where(
            Vehicle.id == vehicle_id,
            Vehicle.user_id == current_user.id,
        )
    )

    if vehicle is None:
        raise HTTPException(
            status_code=404,
            detail="Vehicle not found",
        )

    vehicle.name = vehicle_data.name
    vehicle.vehicle_type = vehicle_data.vehicle_type
    vehicle.fuel_type = vehicle_data.fuel_type
    vehicle.fuel_consumption = vehicle_data.fuel_consumption
    vehicle.tank_capacity = vehicle_data.tank_capacity
    vehicle.battery_capacity = vehicle_data.battery_capacity
    vehicle.energy_consumption = vehicle_data.energy_consumption

    db.commit()
    db.refresh(vehicle)

    return vehicle


@router.delete("/{vehicle_id}")
def delete_vehicle(
    vehicle_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    vehicle = db.scalar(
        select(Vehicle).where(
            Vehicle.id == vehicle_id,
            Vehicle.user_id == current_user.id,
        )
    )

    if vehicle is None:
        raise HTTPException(
            status_code=404,
            detail="Vehicle not found",
        )

    db.delete(vehicle)
    db.commit()

    return {"message": "Vehicle deleted successfully"}