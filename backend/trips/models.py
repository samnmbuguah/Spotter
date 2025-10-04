from django.db import models
from django.conf import settings
from django.utils import timezone


class Location(models.Model):
    """Model for storing location information"""
    name = models.CharField(max_length=255)
    address = models.CharField(max_length=500)
    city = models.CharField(max_length=100)
    state = models.CharField(max_length=50)
    zip_code = models.CharField(max_length=20, blank=True)
    latitude = models.DecimalField(max_digits=10, decimal_places=8, null=True, blank=True)
    longitude = models.DecimalField(max_digits=11, decimal_places=8, null=True, blank=True)

    def __str__(self):
        return f"{self.name}, {self.city}, {self.state}"

    class Meta:
        unique_together = ['name', 'address']


class RouteStop(models.Model):
    """Model for rest stops and fuel stops along a route"""
    STOP_TYPE_CHOICES = [
        ('rest', 'Rest Stop'),
        ('fuel', 'Fuel Stop'),
        ('pickup', 'Pickup'),
        ('dropoff', 'Drop-off'),
    ]

    name = models.CharField(max_length=255)
    location = models.ForeignKey(Location, on_delete=models.CASCADE)
    stop_type = models.CharField(max_length=20, choices=STOP_TYPE_CHOICES)
    estimated_duration = models.IntegerField(help_text="Duration in minutes")
    order = models.PositiveIntegerField()

    def __str__(self):
        return f"{self.name} ({self.get_stop_type_display()})"

    class Meta:
        ordering = ['order']


class Trip(models.Model):
    """Main trip model for HOS compliance"""
    CYCLE_CHOICES = [
        ('70_8', '70 hours / 8 days'),
        ('60_7', '60 hours / 7 days'),
    ]

    STATUS_CHOICES = [
        ('planning', 'Planning'),
        ('active', 'Active'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
    ]

    driver = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='hos_trips')
    name = models.CharField(max_length=255, blank=True, help_text='Auto-generated trip name')

    # Location fields (can be null for automatic trips)
    current_location = models.ForeignKey(
        Location,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='current_trips'
    )
    pickup_location = models.ForeignKey(
        Location,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='pickup_trips'
    )
    dropoff_location = models.ForeignKey(
        Location,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='dropoff_trips'
    )

    current_cycle = models.CharField(max_length=10, choices=CYCLE_CHOICES, default='70_8')

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='planning')
    start_time = models.DateTimeField(null=True, blank=True)
    end_time = models.DateTimeField(null=True, blank=True)
    total_distance = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True, help_text="Distance in miles")

    # HOS tracking
    available_hours = models.DecimalField(max_digits=4, decimal_places=2, default=70.0)
    used_hours = models.DecimalField(max_digits=4, decimal_places=2, default=0.0)
    last_reset_date = models.DateField(default=timezone.now)

    route_stops = models.ManyToManyField(RouteStop, blank=True)

    # Automatic trip management fields
    is_automatic = models.BooleanField(default=False, help_text='Automatically created trip')
    trip_date = models.DateField(default=timezone.now, help_text='Date this trip represents')

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} - {self.driver.name} ({self.trip_date})"

    def save(self, *args, **kwargs):
        # Auto-generate trip name if not provided and it's an automatic trip
        if not self.name and self.is_automatic:
            self.name = f"Daily Trip - {self.trip_date}"
        super().save(*args, **kwargs)

    def calculate_hos_compliance(self):
        """Calculate if trip is HOS compliant"""
        if self.current_cycle == '70_8':
            max_hours = 70
            max_days = 8
        else:
            max_hours = 60
            max_days = 7

        # Check if driver has enough hours for the trip
        estimated_trip_hours = self.estimate_trip_duration()
        return self.available_hours >= estimated_trip_hours

    def estimate_trip_duration(self):
        """Estimate trip duration in hours"""
        # Simple estimation: assume average 60 mph
        if self.total_distance:
            return float(self.total_distance) / 60
        return 0

    def should_auto_close(self, driver_timezone_str):
        """Check if trip should be auto-closed based on driver's settings"""
        if not self.driver.driver_profile.auto_close_trip_at_midnight:
            return False

        import pytz
        from django.utils import timezone

        # Get driver's timezone
        tz = pytz.timezone(driver_timezone_str)

        # Get current time in driver's timezone
        now_utc = timezone.now()
        now_driver_tz = now_utc.astimezone(tz)

        # Get driver's configured auto-close time
        auto_close_time = self.driver.driver_profile.auto_close_trip_time

        # Check if current time matches the configured auto-close time
        # Allow a 5-minute window for the check
        auto_close_datetime = now_driver_tz.replace(
            hour=auto_close_time.hour,
            minute=auto_close_time.minute,
            second=0,
            microsecond=0
        )

        time_diff = abs((now_driver_tz - auto_close_datetime).total_seconds())
        return time_diff <= 300  # 5 minutes window

    def auto_close_trip(self):
        """Auto-close trip and create off-duty log entry"""
        from django.utils import timezone
        from logs.models import LogEntry

        # Mark trip as completed
        self.status = 'completed'
        self.end_time = timezone.now()
        self.save()

        # Create off-duty log entry for the current day
        # This represents the automatic transition to off-duty
        today = timezone.now().date()
        LogEntry.objects.create(
            driver=self.driver,
            date=today,
            start_time=timezone.now().time(),
            duty_status='off_duty',
            location='Auto-closed trip',
            total_hours=0,
            notes='Automatic trip closure - status set to off duty'
        )

        # Reset HOS hours for next day
        if self.current_cycle == '70_8':
            self.available_hours = 70.0
        else:
            self.available_hours = 60.0
        self.used_hours = 0.0
        self.last_reset_date = timezone.now().date()
        self.save()

    @classmethod
    def get_current_trip(cls, driver):
        """Get the current active trip for a driver"""
        return cls.objects.filter(
            driver=driver,
            status='active',
            is_automatic=True,
            trip_date=timezone.now().date()
        ).first()

    @classmethod
    def get_or_create_current_trip(cls, driver):
        """Get current trip or create one if it doesn't exist"""
        trip = cls.get_current_trip(driver)

        if not trip:
            # Create new automatic trip for today
            from core.models import DriverProfile
            try:
                profile = driver.driver_profile
                cycle = profile.default_cycle
            except DriverProfile.DoesNotExist:
                cycle = '70_8'  # Default cycle

            trip = cls.objects.create(
                driver=driver,
                current_cycle=cycle,
                is_automatic=True,
                trip_date=timezone.now().date(),
                status='active',
                start_time=timezone.now()
            )

            # Create initial off-duty log entry for automatic trip
            from logs.models import LogEntry
            LogEntry.objects.create(
                driver=driver,
                date=timezone.now().date(),
                start_time=timezone.now().time(),
                duty_status='off_duty',
                location='Automatic trip created',
                total_hours=0,
                notes='Initial log entry for automatic trip'
            )

        return trip
