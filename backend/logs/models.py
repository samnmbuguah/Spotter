from django.db import models
from django.conf import settings
from django.utils import timezone


class LogEntry(models.Model):
    """Model for individual HOS log entries"""
    DUTY_STATUS_CHOICES = [
        ('off_duty', 'Off Duty'),
        ('sleeper_berth', 'Sleeper Berth'),
        ('driving', 'Driving'),
        ('on_duty_not_driving', 'On Duty (Not Driving)'),
    ]

    driver = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='hos_log_entries')
    date = models.DateField(default=timezone.now)
    start_time = models.TimeField()
    end_time = models.TimeField(null=True, blank=True)
    duty_status = models.CharField(max_length=30, choices=DUTY_STATUS_CHOICES)
    location = models.CharField(max_length=255, blank=True)
    notes = models.TextField(blank=True)

    # Location data (optional)
    latitude = models.DecimalField(max_digits=10, decimal_places=8, null=True, blank=True)
    longitude = models.DecimalField(max_digits=11, decimal_places=8, null=True, blank=True)

    # Hours tracking
    total_hours = models.DecimalField(max_digits=4, decimal_places=2, default=0)

    # Vehicle and equipment information
    vehicle_info = models.CharField(max_length=255, blank=True, help_text='Vehicle identification')
    trailer_info = models.CharField(max_length=255, blank=True, help_text='Trailer identification')
    odometer_start = models.DecimalField(max_digits=8, decimal_places=1, null=True, blank=True, help_text='Starting odometer reading')
    odometer_end = models.DecimalField(max_digits=8, decimal_places=1, null=True, blank=True, help_text='Ending odometer reading')

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.driver.name} - {self.date} - {self.duty_status}"

    def save(self, *args, **kwargs):
        # Calculate total hours if end_time is provided
        if self.start_time and self.end_time:
            start_datetime = timezone.datetime.combine(self.date, self.start_time)
            end_datetime = timezone.datetime.combine(self.date, self.end_time)
            if end_datetime < start_datetime:
                end_datetime += timezone.timedelta(days=1)
            self.total_hours = (end_datetime - start_datetime).total_seconds() / 3600
        super().save(*args, **kwargs)

    class Meta:
        ordering = ['-date', '-start_time']
        unique_together = ['driver', 'date', 'start_time']


class DailyLog(models.Model):
    """Model for daily HOS summary logs"""
    driver = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='hos_daily_logs')
    date = models.DateField(default=timezone.now)

    # 24-hour period summary
    total_on_duty_hours = models.DecimalField(max_digits=4, decimal_places=2, default=0)
    total_driving_hours = models.DecimalField(max_digits=4, decimal_places=2, default=0)
    total_off_duty_hours = models.DecimalField(max_digits=4, decimal_places=2, default=0)
    total_sleeper_berth_hours = models.DecimalField(max_digits=4, decimal_places=2, default=0)

    # Cycle reset tracking
    cycle_start_date = models.DateField(null=True, blank=True)
    available_hours_next_day = models.DecimalField(max_digits=4, decimal_places=2, default=70)

    # Certification
    is_certified = models.BooleanField(default=False)
    certified_at = models.DateTimeField(null=True, blank=True)
    certified_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='certified_logs'
    )

    # Supporting documents (for ELD compliance)
    has_supporting_documents = models.BooleanField(default=False)
    document_count = models.PositiveIntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.driver.name} - {self.date}"

    def calculate_totals(self):
        """Calculate totals from log entries"""
        entries = LogEntry.objects.filter(driver=self.driver, date=self.date)

        self.total_on_duty_hours = 0
        self.total_driving_hours = 0
        self.total_off_duty_hours = 0
        self.total_sleeper_berth_hours = 0

        for entry in entries:
            if entry.duty_status == 'driving':
                self.total_driving_hours += float(entry.total_hours)
            elif entry.duty_status == 'on_duty_not_driving':
                self.total_on_duty_hours += float(entry.total_hours)
            elif entry.duty_status == 'off_duty':
                self.total_off_duty_hours += float(entry.total_hours)
            elif entry.duty_status == 'sleeper_berth':
                self.total_sleeper_berth_hours += float(entry.total_hours)

        return self

    def is_hos_compliant(self):
        """Check if daily log is HOS compliant"""
        # 11-hour driving limit
        if self.total_driving_hours > 11:
            return False

        # 14-hour on-duty limit
        if (self.total_driving_hours + self.total_on_duty_hours) > 14:
            return False

        # 10 consecutive hours off-duty (8 hours + 2 hours off-duty/sleeper)
        total_rest = self.total_off_duty_hours + self.total_sleeper_berth_hours
        if total_rest < 10:
            return False

        return True

    class Meta:
        ordering = ['-date']
        unique_together = ['driver', 'date']


class Violation(models.Model):
    """Model for tracking HOS violations"""
    VIOLATION_TYPE_CHOICES = [
        ('driving_limit', '11-hour Driving Limit'),
        ('on_duty_limit', '14-hour On-duty Limit'),
        ('rest_requirement', '10-hour Rest Requirement'),
        ('cycle_limit', '70/8 or 60/7 Cycle Limit'),
        ('falsification', 'Log Falsification'),
        ('missing_logs', 'Missing Required Logs'),
    ]

    driver = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='hos_violations')
    log_entry = models.ForeignKey(LogEntry, on_delete=models.CASCADE, null=True, blank=True)
    daily_log = models.ForeignKey(DailyLog, on_delete=models.CASCADE, null=True, blank=True)

    violation_type = models.CharField(max_length=50, choices=VIOLATION_TYPE_CHOICES)
    description = models.TextField()
    detected_at = models.DateTimeField(auto_now_add=True)
    severity = models.CharField(max_length=20, default='minor')  # minor, major, critical

    # Resolution tracking
    is_resolved = models.BooleanField(default=False)
    resolved_at = models.DateTimeField(null=True, blank=True)
    resolution_notes = models.TextField(blank=True)

    def __str__(self):
        return f"{self.driver.name} - {self.violation_type}"

    class Meta:
        ordering = ['-detected_at']
