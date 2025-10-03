from django.db import models
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone
from django.conf import settings
import uuid
import os


def document_upload_path(instance, filename):
    return f'documents/{instance.driver.id}/{uuid.uuid4()}_{filename}'


class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        """Create and save a new user"""
        if not email:
            raise ValueError('Users must have an email address')
        user = self.model(email=self.normalize_email(email), **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password):
        """Create and save a new superuser"""
        user = self.create_user(email, password)
        user.is_staff = True
        user.is_superuser = True
        user.save(using=self._db)
        return user


class User(AbstractBaseUser, PermissionsMixin):
    """Custom user model that supports using email instead of username"""
    email = models.EmailField(max_length=255, unique=True)
    name = models.CharField(max_length=255)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    is_driver = models.BooleanField(default=False)
    is_dispatcher = models.BooleanField(default=False)
    phone_number = models.CharField(max_length=20, blank=True)
    date_joined = models.DateTimeField(default=timezone.now)
    last_login = models.DateTimeField(null=True, blank=True)

    objects = UserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['name']

    def __str__(self):
        return self.email


class Document(models.Model):
    DOCUMENT_TYPES = [
        ('inspection', 'Vehicle Inspection'),
        ('receipt', 'Receipt'),
        ('log', 'Log Sheet'),
        ('other', 'Other')
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    file = models.FileField(upload_to=document_upload_path)
    upload_date = models.DateTimeField(auto_now_add=True)
    document_type = models.CharField(max_length=20, choices=DOCUMENT_TYPES)
    driver = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='documents')
    description = models.TextField(blank=True)
    
    def __str__(self):
        return f"{self.get_document_type_display()} - {self.upload_date.strftime('%Y-%m-%d')}"


class DutyStatusLog(models.Model):
    STATUS_CHOICES = [
        ('off_duty', 'Off Duty'),
        ('sleeper', 'Sleeper Berth'),
        ('driving', 'Driving'),
        ('on_duty', 'On Duty (Not Driving)')
    ]
    
    VEHICLE_CONDITION_CHOICES = [
        ('satisfactory', 'Satisfactory'),
        ('needs_attention', 'Needs Attention'),
        ('unsafe', 'Unsafe to Drive')
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    driver = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='duty_logs')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES)
    start_time = models.DateTimeField()
    end_time = models.DateTimeField(null=True, blank=True)
    location = models.CharField(max_length=255)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    odometer_start = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    odometer_end = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    vehicle_info = models.JSONField(default=dict)
    trailer_info = models.CharField(max_length=100, blank=True)
    notes = models.TextField(blank=True)
    documents = models.ManyToManyField(Document, blank=True)
    co_driver = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, 
                                 null=True, blank=True, related_name='co_driver_logs')
    vehicle_condition = models.CharField(max_length=20, choices=VEHICLE_CONDITION_CHOICES, 
                                       null=True, blank=True)
    inspection_notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-start_time']
    
    def __str__(self):
        return f"{self.driver.name} - {self.get_status_display()} ({self.start_time})"
    
    def duration(self):
        if not self.end_time:
            return None
        return self.end_time - self.start_time


class DriverProfile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='driver_profile')
    license_number = models.CharField(max_length=50, blank=True)
    license_expiry = models.DateField(null=True, blank=True)
    medical_card_expiry = models.DateField(null=True, blank=True)
    current_vehicle = models.CharField(max_length=100, blank=True)
    current_trailer = models.CharField(max_length=100, blank=True)
    
    # HOS cycle settings
    default_cycle = models.CharField(
        max_length=10,
        choices=[('70_8', '70 hours / 8 days'), ('60_7', '60 hours / 7 days')],
        default='70_8'
    )

    # Automatic trip management
    auto_close_trip_at_midnight = models.BooleanField(
        default=True,
        help_text='Automatically close current trip and start new one at midnight'
    )
    auto_close_trip_time = models.TimeField(
        default='00:00:00',
        help_text='Time to automatically close current trip (in driver\'s timezone)'
    )

    def __str__(self):
        return f"{self.user.name}'s Driver Profile"


@receiver(post_save, sender=User)
def create_driver_profile(sender, instance, created, **kwargs):
    """Create a driver profile automatically when a user is created"""
    if created and instance.is_driver:
        DriverProfile.objects.get_or_create(user=instance)
