from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.utils.translation import gettext_lazy as _

from . import models


class UserAdmin(BaseUserAdmin):
    """Define the admin pages for users."""
    ordering = ['id']
    list_display = ['email', 'name']
    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        (_('Personal Info'), {'fields': ('name',)}),
        (
            _('Permissions'),
            {
                'fields': (
                    'is_active',
                    'is_staff',
                    'is_superuser',
                )
            }
        ),
        (_('Important dates'), {'fields': ('last_login',)}),
    )
    readonly_fields = ['last_login']
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': (
                'email',
                'password1',
                'password2',
                'name',
                'is_active',
                'is_staff',
                'is_superuser',
            ),
        }),
    )


@admin.register(models.DriverProfile)
class DriverProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'license_number', 'license_expiry', 'current_vehicle')
    search_fields = ('user__email', 'user__name', 'license_number', 'current_vehicle', 'current_trailer')
    list_filter = ('default_cycle', 'auto_close_trip_at_midnight')
    fieldsets = (
        (None, {
            'fields': ('user', 'license_number', 'license_expiry', 'medical_card_expiry')
        }),
        ('Vehicle Information', {
            'fields': ('current_vehicle', 'current_trailer')
        }),
        ('Trip Settings', {
            'fields': ('default_cycle', 'auto_close_trip_at_midnight', 'auto_close_trip_time')
        }),
    )


admin.site.register(models.User, UserAdmin)
