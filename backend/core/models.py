from django.db import models
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone


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
    date_joined = models.DateTimeField(default=timezone.now)

    objects = UserManager()

    USERNAME_FIELD = 'email'

    # Define custom related names to avoid clashes with auth.User
    groups = models.ManyToManyField(
        'auth.Group',
        related_name='core_user_groups',
        blank=True,
        help_text='The groups this user belongs to.',
        verbose_name='groups',
    )
    user_permissions = models.ManyToManyField(
        'auth.Permission',
        related_name='core_user_permissions',
        blank=True,
        help_text='Specific permissions for this user.',
        verbose_name='user permissions',
    )

    def __str__(self):
        return self.email


class DriverProfile(models.Model):
    """Profile for drivers with additional information"""
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='driver_profile'
    )
    license_number = models.CharField(max_length=50, blank=True)
    license_expiry = models.DateField(null=True, blank=True)
    phone_number = models.CharField(max_length=20, blank=True)
    company = models.CharField(max_length=255, blank=True)

    # Timezone settings for automatic trip management
    timezone = models.CharField(
        max_length=50,
        default='America/New_York',
        help_text='Timezone for trip and log management'
    )

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
    if created:
        DriverProfile.objects.create(user=instance)
