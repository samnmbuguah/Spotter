from django.core.management.base import BaseCommand
from django.utils import timezone
from django.conf import settings
from trips.models import Trip
from logs.models import LogEntry
import pytz


class Command(BaseCommand):
    help = 'Automatically close trips at configured times and start new ones'

    def handle(self, *args, **options):
        """Handle the automatic trip management based on driver settings"""
        self.stdout.write('Starting automatic trip management...')

        # Get current time in UTC
        now_utc = timezone.now()

        # Process each driver with auto-close enabled
        drivers_processed = 0

        for trip in Trip.objects.filter(
            status='active',
            is_automatic=True
        ).select_related('driver__driver_profile'):

            try:
                # Skip if driver doesn't have auto-close enabled
                if not trip.driver.driver_profile.auto_close_trip_at_midnight:
                    continue

                # Check if it's time to auto-close this trip
                if trip.should_auto_close(trip.driver.driver_profile.timezone):
                    self.stdout.write(
                        f'Processing auto-close for driver: {trip.driver.name} at time: {trip.driver.driver_profile.auto_close_trip_time}'
                    )

                    # Auto-close current trip
                    trip.auto_close_trip()

                    # Create new trip for today
                    new_trip = Trip.objects.create(
                        driver=trip.driver,
                        current_cycle=trip.driver.driver_profile.default_cycle,
                        is_automatic=True,
                        trip_date=now_utc.date(),
                        status='active',
                        start_time=now_utc
                    )

                    # Create initial "off duty" log entry for the new day
                    LogEntry.objects.create(
                        driver=trip.driver,
                        date=now_utc.date(),
                        start_time=now_utc.time(),
                        duty_status='off_duty',
                        location='',
                        total_hours=0,
                        notes='Automatic trip creation - starting in off duty status'
                    )

                    self.stdout.write(
                        f'Created new trip: {new_trip.name} for driver: {trip.driver.name}'
                    )

                    drivers_processed += 1

            except Exception as e:
                self.stdout.write(
                    self.style.ERROR(
                        f'Error processing trip for driver {trip.driver.name}: {str(e)}'
                    )
                )

        self.stdout.write(
            self.style.SUCCESS(
                f'Successfully processed {drivers_processed} drivers for automatic trip transitions'
            )
        )
