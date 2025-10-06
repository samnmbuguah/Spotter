from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import datetime, timedelta
import random

from logs.models import LogEntry, DailyLog, Violation

User = get_user_model()

class Command(BaseCommand):
    help = 'Seed the database with test log data'

    def add_arguments(self, parser):
        parser.add_argument('--days', type=int, default=7, help='Number of days of logs to generate')
        parser.add_argument('--email', type=str, default='testdriver@example.com', help='Email of the driver to create logs for')

    def handle(self, *args, **options):
        days = options['days']
        email = options['email']

        # Get or create test driver user
        user, created = User.objects.get_or_create(
            email=email,
            defaults={
                'name': 'Test Driver',
                'is_active': True,
                'is_driver': True
            }
        )
        if created:
            user.set_password('testpass123')
            user.save()
            self.stdout.write(self.style.SUCCESS(f'Created test user: {email} with password: testpass123'))
        else:
            self.stdout.write(self.style.SUCCESS(f'Using existing user: {email}'))

        # Clear existing logs for this user
        LogEntry.objects.filter(driver=user).delete()
        DailyLog.objects.filter(driver=user).delete()
        Violation.objects.filter(driver=user).delete()

        # Generate logs for the past N days
        today = timezone.now().date()
        for day in range(days, 0, -1):
            log_date = today - timedelta(days=day)
            self.create_daily_logs(user, log_date)

        self.stdout.write(self.style.SUCCESS(f'Successfully seeded {days} days of log data for {email}'))

    def create_daily_logs(self, user, log_date):
        """Create log entries for a single day with realistic data"""
        # Create a daily log summary
        daily_log = DailyLog.objects.create(
            driver=user,
            date=log_date,
            total_on_duty_hours=0,
            total_driving_hours=0,
            total_off_duty_hours=0,
            total_sleeper_berth_hours=0,
            is_certified=random.choice([True, False])
        )

        # Realistic locations with coordinates (covering a route from Chicago to Indianapolis)
        locations = [
            ("Chicago, IL", 41.8781, -87.6298, 1000),  # Starting point
            ("Gary, IN", 41.5934, -87.3464, 1030),
            ("Merrillville, IN", 41.4828, -87.3328, 1050),
            ("Crown Point, IN", 41.4167, -87.3653, 1070),
            ("Lowell, IN", 41.2914, -87.4186, 1100),
            ("Rensselaer, IN", 40.9367, -87.1509, 1150),
            ("Remington, IN", 40.7642, -87.1511, 1180),
            ("Lafayette, IN", 40.4167, -86.8753, 1220),
            ("Lebanon, IN", 40.0484, -86.4692, 1250),
            ("Indianapolis, IN", 39.7684, -86.1581, 1280),  # Destination
        ]

        # Generate log entries for the day with a realistic truck route
        status_sequence = [
            ('off_duty', 8, locations[0]),  # 8 hours off duty (sleeping) in Chicago
            ('driving', 4, locations[1]),   # 4 hours driving to Gary, IN
            ('on_duty_not_driving', 2, locations[2]),  # 2 hours on duty in Merrillville, IN
            ('driving', 3, locations[3]),   # 3 more hours driving to Crown Point, IN
            ('on_duty_not_driving', 1, locations[4]),  # 1 more hour on duty in Lowell, IN
            ('off_duty', 6, locations[5])   # 6 more hours off duty in Rensselaer, IN
        ]

        current_time = datetime.combine(log_date, datetime.min.time()) + timedelta(hours=6)  # Start at 6 AM
        current_odometer = 1000  # Starting odometer reading

        for status, duration, (location_name, lat, lng, base_odometer) in status_sequence:
            end_time = current_time + timedelta(hours=duration)

            # Calculate odometer reading (increases during driving)
            if status == 'driving':
                odometer_start = current_odometer
                # Assume ~50 miles per hour of driving
                miles_driven = duration * 50
                odometer_end = odometer_start + miles_driven
                current_odometer = odometer_end
            else:
                odometer_start = current_odometer
                odometer_end = None

            # Create log entry
            log_entry = LogEntry.objects.create(
                driver=user,
                date=log_date,
                start_time=current_time.time(),
                end_time=end_time.time(),
                duty_status=status,
                location=location_name,
                latitude=lat,
                longitude=lng,
                notes=f"Auto-generated log entry for testing - {location_name}",
                vehicle_info="Truck ABC-123",
                trailer_info="Trailer XYZ-789",
                odometer_start=odometer_start,
                odometer_end=odometer_end
            )

            # Update daily log totals
            if status == 'driving':
                daily_log.total_driving_hours += duration
                daily_log.total_on_duty_hours += duration
            elif status == 'on_duty_not_driving':
                daily_log.total_on_duty_hours += duration
            elif status == 'sleeper_berth':
                daily_log.total_sleeper_berth_hours += duration
            else:  # off_duty
                daily_log.total_off_duty_hours += duration

            current_time = end_time

        # Save the updated daily log
        daily_log.save()

        # Randomly create a violation (30% chance)
        if random.random() < 0.3:
            violation_types = [
                ('driving_limit', 'Exceeded 11-hour driving limit'),
                ('on_duty_limit', 'Exceeded 14-hour on-duty limit'),
                ('rest_requirement', 'Insufficient rest period')
            ]
            violation_type, description = random.choice(violation_types)

            Violation.objects.create(
                driver=user,
                daily_log=daily_log,
                violation_type=violation_type,
                description=description,
                severity=random.choice(['minor', 'moderate', 'severe']),
                is_resolved=random.choice([True, False])
            )
