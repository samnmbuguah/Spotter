from django.contrib import admin
from .models import Location, RouteStop, Trip


@admin.register(Location)
class LocationAdmin(admin.ModelAdmin):
    list_display = ['name', 'city', 'state', 'zip_code']
    search_fields = ['name', 'city', 'state', 'address']
    list_filter = ['state', 'city']


@admin.register(RouteStop)
class RouteStopAdmin(admin.ModelAdmin):
    list_display = ['name', 'stop_type', 'location', 'estimated_duration', 'order']
    list_filter = ['stop_type']
    search_fields = ['name', 'location__name']
    ordering = ['order']


@admin.register(Trip)
class TripAdmin(admin.ModelAdmin):
    list_display = ['name', 'driver', 'status', 'current_cycle', 'available_hours', 'created_at']
    list_filter = ['status', 'current_cycle', 'created_at']
    search_fields = ['name', 'driver__name', 'driver__email']
    readonly_fields = ['created_at', 'updated_at']
    date_hierarchy = 'created_at'

    fieldsets = (
        ('Trip Information', {
            'fields': ('driver', 'name', 'status')
        }),
        ('Locations', {
            'fields': ('current_location', 'pickup_location', 'dropoff_location')
        }),
        ('HOS Details', {
            'fields': ('current_cycle', 'available_hours', 'used_hours', 'last_reset_date')
        }),
        ('Trip Details', {
            'fields': ('start_time', 'end_time', 'total_distance', 'route_stops')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
