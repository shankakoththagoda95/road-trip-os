from app.integrations.ev_charging import OpenChargeMapProvider


provider = OpenChargeMapProvider()

stations = provider.search_nearby(
    latitude=59.3293,
    longitude=18.0686,
    radius_km=10,
)

print(f"Found {len(stations)} charging stations")

for station in stations[:5]:
    print()
    print(f"Name: {station.name}")
    print(f"Location: {station.latitude}, {station.longitude}")
    print(f"Country: {station.country}")
    print(f"Operator: {station.operator}")
    print(f"Connectors: {station.connector_types}")
    print(f"Max power: {station.charging_power_kw} kW")