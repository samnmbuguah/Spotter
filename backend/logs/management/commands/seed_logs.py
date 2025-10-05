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
        parser.add_argument('--username', type=str, default='testdriver', help='Username of the driver to create logs for')

    def handle(self, *args, **options):
        days = options['days']
        username = options['username']

        # Get or create test driver user
        user, created = User.objects.get_or_create(
            username=username,
            defaults={
                'email': f'{username}@example.com',
                'name': 'Test Driver',
                'is_active': True
            }
        )
        if created:
            user.set_password('testpass123')
            user.save()
            self.stdout.write(self.style.SUCCESS(f'Created test user: {username} with password: testpass123'))
        else:
            self.stdout.write(self.style.SUCCESS(f'Using existing user: {username}'))

        # Clear existing logs for this user
        LogEntry.objects.filter(driver=user).delete()
        DailyLog.objects.filter(driver=user).delete()
        Violation.objects.filter(driver=user).delete()

        # Generate logs for the past N days
        today = timezone.now().date()
        for day in range(days, 0, -1):
            log_date = today - timedelta(days=day)
            self.create_daily_logs(user, log_date)

        self.stdout.write(self.style.SUCCESS(f'Successfully seeded {days} days of log data for {username}'))

    def create_daily_logs(self, user, log_date):
        """Create log entries for a single day"""
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

        # Generate log entries for the day
        status_sequence = [
            ('off_duty', 8),  # 8 hours off duty (sleeping)
            ('driving', 4),   # 4 hours driving
            ('on_duty_not_driving', 2),  # 2 hours on duty not driving
            ('driving', 3),   # 3 more hours driving
            ('on_duty_not_driving', 1),  # 1 more hour on duty
            ('off_duty', 6)   # 6 more hours off duty
        ]

        current_time = datetime.combine(log_date, datetime.min.time()) + timedelta(hours=6)  # Start at 6 AM
        
        for status, duration in status_sequence:
            end_time = current_time + timedelta(hours=duration)
            
            # Create log entry
            log_entry = LogEntry.objects.create(
                driver=user,
                date=log_date,
                start_time=current_time.time(),
                end_time=end_time.time(),
                duty_status=status,
                location=f"Location {random.randint(1, 10)}",
                notes=f"Auto-generated log entry for testing"
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
