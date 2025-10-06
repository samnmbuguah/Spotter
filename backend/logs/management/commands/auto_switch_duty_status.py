from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
from logs.models import LogEntry
import pytz


class Command(BaseCommand):
    help = 'Automatically switch duty status from pickup/drop-off back to driving after 1 hour'

    def handle(self, *args, **options):
        """Handle automatic status switching for pickup and drop-off activities"""
        self.stdout.write('Starting automatic duty status management...')

        now = timezone.now()
        one_hour_ago = now - timedelta(hours=1)

        # Find log entries that have been in "on_duty_not_driving" status for 1 hour
        # and don't have an end_time (meaning they're still ongoing)
        ongoing_pickup_dropoff = LogEntry.objects.filter(
            duty_status='on_duty_not_driving',
            end_time__isnull=True,
            start_time__lte=one_hour_ago
        )

        processed_count = 0

        for entry in ongoing_pickup_dropoff:
            try:
                # Check if this entry started exactly 1 hour ago (within a 5-minute window)
                entry_start = timezone.datetime.combine(entry.date, entry.start_time)
                entry_start = timezone.make_aware(entry_start)

                time_diff = abs((now - entry_start).total_seconds())

                # Only process if it's been exactly 1 hour (within 5 minutes tolerance)
                if 3600 <= time_diff <= 3900:  # 1 hour ± 5 minutes
                    self.stdout.write(
                        f'Processing auto-switch for driver: {entry.driver.name} '
                        f'from {entry.duty_status} back to driving'
                    )

                    # End the current pickup/drop-off entry
                    entry.end_time = entry.start_time  # Will be updated by the save method
                    entry.save()

                    # Create a new driving entry starting now
                    new_driving_entry = LogEntry.objects.create(
                        driver=entry.driver,
                        date=now.date(),
                        start_time=now.time(),
                        duty_status='driving',
                        location=entry.location,
                        total_hours=0,  # Ongoing
                        notes=f'Auto-switched from {entry.duty_status} after 1 hour - pickup/drop-off complete'
                    )

                    self.stdout.write(
                        f'Created new driving entry: {new_driving_entry.id} for driver: {entry.driver.name}'
                    )

                    processed_count += 1

            except Exception as e:
                self.stdout.write(
                    self.style.ERROR(
                        f'Error processing entry {entry.id} for driver {entry.driver.name}: {str(e)}'
                    )
                )

        self.stdout.write(
            self.style.SUCCESS(
                f'Successfully processed {processed_count} automatic status switches'
            )
        )
