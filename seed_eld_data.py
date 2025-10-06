"""
Seed data for testing ELD (Electronic Logging Device) functionality
This script creates sample locations, trips, and log entries to test the system.
Run with: python manage.py shell -c "exec(open('seed_eld_data.py').read())"
"""

from django.utils import timezone
from datetime import date, time, timedelta
from trips.models import Location, Trip, RouteStop
from logs.models import LogEntry, DailyLog
import random

def create_seed_data():
    print("Creating seed data for ELD testing...")

    # Create sample locations
    locations_data = [
        {
            'name': 'New York Terminal',
            'address': '123 Port Terminal Ave',
            'city': 'New York',
            'state': 'NY',
            'zip_code': '10001',
            'latitude': 40.7128,
            'longitude': -74.0060,
        },
        {
            'name': 'Chicago Warehouse',
            'address': '456 Industrial Blvd',
            'city': 'Chicago',
            'state': 'IL',
            'zip_code': '60601',
            'latitude': 41.8781,
            'longitude': -87.6298,
        },
        {
            'name': 'Dallas Distribution Center',
            'address': '789 Commerce Dr',
            'city': 'Dallas',
            'state': 'TX',
            'zip_code': '75201',
            'latitude': 32.7767,
            'longitude': -96.7970,
        },
        {
            'name': 'Los Angeles Depot',
            'address': '321 Pacific Hwy',
            'city': 'Los Angeles',
            'state': 'CA',
            'zip_code': '90001',
            'latitude': 34.0522,
            'longitude': -118.2437,
        },
        {
            'name': 'Miami Shipping Port',
            'address': '654 Ocean Terminal Rd',
            'city': 'Miami',
            'state': 'FL',
            'zip_code': '33101',
            'latitude': 25.7617,
            'longitude': -80.1918,
        },
    ]

    locations = []
    for loc_data in locations_data:
        location, created = Location.objects.get_or_create(
            name=loc_data['name'],
            defaults=loc_data
        )
        locations.append(location)
        if created:
            print(f"Created location: {location.name}")

    # Create a test driver (assuming you have a user with ID 1)
    try:
        from django.contrib.auth import get_user_model
        User = get_user_model()
        driver = User.objects.get(id=1)  # Adjust this ID as needed
    except User.DoesNotExist:
        print("No driver found with ID 1. Please create a user first.")
        return

    # Create sample trips
    trips_data = [
        {
            'name': 'NYC to Chicago Cross-Country',
            'current_location': locations[0],
            'pickup_location': locations[0],
            'dropoff_location': locations[1],
            'current_cycle': '70_8',
            'total_distance': 790,  # miles
            'trip_date': date.today() - timedelta(days=2),
        },
        {
            'name': 'Chicago to Dallas Regional',
            'current_location': locations[1],
            'pickup_location': locations[1],
            'dropoff_location': locations[2],
            'current_cycle': '70_8',
            'total_distance': 930,  # miles
            'trip_date': date.today() - timedelta(days=1),
        },
        {
            'name': 'Dallas to LA Long Haul',
            'current_location': locations[2],
            'pickup_location': locations[2],
            'dropoff_location': locations[3],
            'current_cycle': '70_8',
            'total_distance': 1430,  # miles
            'trip_date': date.today(),
        },
    ]

    trips = []
    for trip_data in trips_data:
        trip, created = Trip.objects.get_or_create(
            driver=driver,
            name=trip_data['name'],
            defaults={
                **trip_data,
                'status': 'completed',
                'is_automatic': True,
            }
        )
        trips.append(trip)
        if created:
            print(f"Created trip: {trip.name}")

    # Create detailed log entries for each trip
    for i, trip in enumerate(trips):
        create_trip_log_entries(driver, trip, locations)
        print(f"Created log entries for trip: {trip.name}")

    # Create fuel stops and rest stops
    create_route_stops(driver, trips[0], locations)

    print(f"Seed data created successfully!")
    print(f"Created {len(locations)} locations")
    print(f"Created {len(trips)} trips")
    print(f"Created log entries for testing")

def create_trip_log_entries(driver, trip, locations):
    """Create realistic log entries for a trip including 1-hour pickup/drop-off periods"""

    trip_date = trip.trip_date

    # Base start time for the trip
    base_time = time(6, 0)  # 6:00 AM

    log_entries = []

    # 1. Off Duty (before trip starts)
    off_duty_start = time(0, 0)  # Midnight
    off_duty_entry = LogEntry.objects.create(
        driver=driver,
        date=trip_date,
        start_time=off_duty_start,
        end_time=base_time,
        duty_status='off_duty',
        location=f'Home base before {trip.name}',
        total_hours=6.0,
        notes='Rest period before trip'
    )
    log_entries.append(off_duty_entry)

    # 2. On Duty (Not Driving) - 1 hour for pickup
    pickup_start = base_time
    pickup_end = (timezone.datetime.combine(trip_date, pickup_start) + timedelta(hours=1)).time()

    pickup_entry = LogEntry.objects.create(
        driver=driver,
        date=trip_date,
        start_time=pickup_start,
        # No end_time - this will be auto-switched after 1 hour
        duty_status='on_duty_not_driving',
        location=f'Pickup at {trip.pickup_location.name}',
        total_hours=0,  # Will be calculated when ended
        notes='Loading cargo for delivery'
    )
    log_entries.append(pickup_entry)

    # 3. Driving (main trip) - starts after pickup is complete (1 hour later)
    driving_start = (timezone.datetime.combine(trip_date, pickup_start) + timedelta(hours=1)).time()
    # Estimate driving time based on distance (assume 60 mph average)
    driving_hours = trip.total_distance / 60.0
    driving_end_time = (timezone.datetime.combine(trip_date, driving_start) + timedelta(hours=driving_hours)).time()

    driving_entry = LogEntry.objects.create(
        driver=driver,
        date=trip_date,
        start_time=driving_start,
        end_time=driving_end_time,
        duty_status='driving',
        location=f'En route from {trip.pickup_location.name} to {trip.dropoff_location.name}',
        total_hours=driving_hours,
        notes=f'Main driving segment - {trip.total_distance} miles'
    )
    log_entries.append(driving_entry)

    # 4. On Duty (Not Driving) - 1 hour for drop-off - starts after driving is complete
    dropoff_start = driving_end_time

    dropoff_entry = LogEntry.objects.create(
        driver=driver,
        date=trip_date,
        start_time=dropoff_start,
        # No end_time - this will be auto-switched after 1 hour
        duty_status='on_duty_not_driving',
        location=f'Drop-off at {trip.dropoff_location.name}',
        total_hours=0,  # Will be calculated when ended
        notes='Unloading cargo and paperwork'
    )
    log_entries.append(dropoff_entry)

    # 5. Off Duty (after trip completion) - starts after drop-off is complete (1 hour later)
    off_duty_after_start = (timezone.datetime.combine(trip_date, dropoff_start) + timedelta(hours=1)).time()
    # Fill remaining hours until midnight (or next day)
    off_duty_after_hour = timezone.datetime.combine(trip_date, off_duty_after_start).hour
    remaining_hours = 24 - off_duty_after_hour

    off_duty_after_entry = LogEntry.objects.create(
        driver=driver,
        date=trip_date,
        start_time=off_duty_after_start,
        duty_status='off_duty',
        location=f'Completed {trip.name}',
        total_hours=max(0, remaining_hours),
        notes='Rest period after trip completion'
    )
    log_entries.append(off_duty_after_entry)

    return log_entries

def create_route_stops(driver, trip, locations):
    """Create fuel stops and rest stops along the route"""

    # Create fuel stops (every 1000 miles as per requirements)
    if trip.total_distance >= 1000:
        fuel_stops_data = [
            {
                'name': 'Fuel Stop 1',
                'location': locations[1],  # Midway point
                'stop_type': 'fuel',
                'estimated_duration': 30,  # 30 minutes
                'order': 1,
            }
        ]

        for stop_data in fuel_stops_data:
            stop, created = RouteStop.objects.get_or_create(
                name=stop_data['name'],
                defaults=stop_data
            )
            if created:
                trip.route_stops.add(stop)
                print(f"Created route stop: {stop.name}")

    # Create rest stops for longer trips
    if trip.total_distance >= 500:
        rest_stops_data = [
            {
                'name': 'Rest Stop 1',
                'location': locations[1],
                'stop_type': 'rest',
                'estimated_duration': 480,  # 8 hours (30 min meal + 7.5 hours rest)
                'order': 2,
            }
        ]

        for stop_data in rest_stops_data:
            stop, created = RouteStop.objects.get_or_create(
                name=stop_data['name'],
                defaults=stop_data
            )
            if created:
                trip.route_stops.add(stop)
                print(f"Created rest stop: {stop.name}")

# Run the seed data creation
if __name__ == "__main__":
    create_seed_data()
