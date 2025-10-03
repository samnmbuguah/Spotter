# Django admin configuration - disabled for serverless deployment
# from django.contrib import admin
# from .models import LogEntry, DailyLog, Violation
#
#
# @admin.register(LogEntry)
# class LogEntryAdmin(admin.ModelAdmin):
#     list_display = ['driver', 'date', 'start_time', 'end_time', 'duty_status', 'total_hours']
#     list_filter = ['duty_status', 'date', 'driver']
#     search_fields = ['driver__name', 'driver__email', 'location']
#     date_hierarchy = 'date'
#     readonly_fields = ['total_hours', 'created_at', 'updated_at']
#
#     fieldsets = (
#         ('Driver Information', {
#             'fields': ('driver', 'date')
#         }),
#         ('Duty Status', {
#             'fields': ('duty_status', 'start_time', 'end_time', 'total_hours')
#         }),
#         ('Location', {
#             'fields': ('location', 'latitude', 'longitude')
#         }),
#         ('Additional Information', {
#             'fields': ('notes',)
#         }),
#         ('Timestamps', {
#             'fields': ('created_at', 'updated_at'),
#             'classes': ('collapse',)
#         }),
#     )
#
#
# @admin.register(DailyLog)
# class DailyLogAdmin(admin.ModelAdmin):
#     list_display = ['driver', 'date', 'total_driving_hours', 'total_on_duty_hours', 'is_certified']
#     list_filter = ['is_certified', 'date', 'driver']
#     search_fields = ['driver__name', 'driver__email']
#     date_hierarchy = 'date'
#     readonly_fields = ['created_at', 'updated_at']
#
#     fieldsets = (
#         ('Driver Information', {
#             'fields': ('driver', 'date')
#         }),
#         ('Hours Summary', {
#             'fields': ('total_on_duty_hours', 'total_driving_hours', 'total_off_duty_hours', 'total_sleeper_berth_hours')
#         }),
#         ('Cycle Information', {
#             'fields': ('cycle_start_date', 'available_hours_next_day')
#         }),
#         ('Certification', {
#             'fields': ('is_certified', 'certified_at', 'certified_by')
#         }),
#         ('Supporting Documents', {
#             'fields': ('has_supporting_documents', 'document_count')
#         }),
#         ('Timestamps', {
#             'fields': ('created_at', 'updated_at'),
#             'classes': ('collapse',)
#         }),
#     )
#
#
# @admin.register(Violation)
# class ViolationAdmin(admin.ModelAdmin):
#     list_display = ['driver', 'violation_type', 'severity', 'detected_at', 'is_resolved']
#     list_filter = ['violation_type', 'severity', 'is_resolved', 'detected_at']
#     search_fields = ['driver__name', 'driver__email', 'description']
#     date_hierarchy = 'detected_at'
#     readonly_fields = ['detected_at']
#
#     fieldsets = (
#         ('Violation Information', {
#             'fields': ('driver', 'violation_type', 'severity', 'description')
#         }),
#         ('Related Records', {
#             'fields': ('log_entry', 'daily_log')
#         }),
#         ('Resolution', {
#             'fields': ('is_resolved', 'resolved_at', 'resolution_notes')
#         }),
#         ('Detection', {
#             'fields': ('detected_at',)
#         }),
#     )
