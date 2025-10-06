from rest_framework import serializers
from .models import LogEntry, DailyLog, Violation
from datetime import date, datetime
from django.utils import timezone


class DateField(serializers.DateField):
    """Custom DateField that handles datetime values by converting them to date objects"""

    def to_representation(self, value):
        # Handle case where value is a datetime object
        if isinstance(value, datetime):
            value = value.date()
        return super().to_representation(value)

    def to_internal_value(self, value):
        # Handle case where input value is a datetime object
        if isinstance(value, datetime):
            value = value.date()
        return super().to_internal_value(value)


class LogEntrySerializer(serializers.ModelSerializer):
    """Serializer for LogEntry model"""
    current_duration = serializers.SerializerMethodField()
    date = DateField(read_only=True)

    class Meta:
        model = LogEntry
        fields = [
            'id', 'driver', 'date', 'start_time', 'end_time', 'duty_status',
            'location', 'notes', 'latitude', 'longitude', 'total_hours', 'current_duration',
            'vehicle_info', 'trailer_info', 'odometer_start', 'odometer_end',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'total_hours', 'current_duration', 'created_at', 'updated_at']

    def get_current_duration(self, obj):
        return obj.get_current_duration()

    def create(self, validated_data):
        # Set the driver from the request context
        validated_data['driver'] = self.context['request'].user
        return super().create(validated_data)


class DailyLogSerializer(serializers.ModelSerializer):
    """Serializer for DailyLog model"""
    log_entries = LogEntrySerializer(many=True, read_only=True)
    is_compliant = serializers.SerializerMethodField()
    # Removed date field - will use model's default

    class Meta:
        model = DailyLog
        fields = [
            'id', 'driver', 'total_on_duty_hours', 'total_driving_hours',
            'total_off_duty_hours', 'total_sleeper_berth_hours', 'cycle_start_date',
            'available_hours_next_day', 'is_certified', 'certified_at', 'certified_by',
            'has_supporting_documents', 'document_count', 'log_entries', 'is_compliant',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_is_compliant(self, obj):
        return obj.is_hos_compliant()

    def create(self, validated_data):
        # Set the driver from the request context
        validated_data['driver'] = self.context['request'].user
        return super().create(validated_data)


class DailyLogListSerializer(serializers.ModelSerializer):
    """Simplified serializer for daily log listings"""
    is_compliant = serializers.SerializerMethodField()
    # Removed date field - will use model's default

    class Meta:
        model = DailyLog
        fields = [
            'id', 'total_driving_hours', 'total_on_duty_hours',
            'total_off_duty_hours', 'is_certified', 'is_compliant'
        ]

    def get_is_compliant(self, obj):
        return obj.is_hos_compliant()


class ViolationSerializer(serializers.ModelSerializer):
    """Serializer for Violation model"""

    class Meta:
        model = Violation
        fields = [
            'id', 'driver', 'log_entry', 'daily_log', 'violation_type',
            'description', 'detected_at', 'severity', 'is_resolved',
            'resolved_at', 'resolution_notes'
        ]
        read_only_fields = ['id', 'detected_at']


class LogEntryCreateSerializer(serializers.ModelSerializer):
    """Specialized serializer for creating log entries"""
    date = DateField(read_only=True)  # Include date field for proper serialization

    class Meta:
        model = LogEntry
        fields = [
            'id', 'date', 'start_time', 'end_time', 'duty_status',
            'location', 'notes', 'latitude', 'longitude', 'total_hours',
            'vehicle_info', 'trailer_info', 'odometer_start', 'odometer_end'
        ]
        read_only_fields = ['id', 'date']  # Make date read-only since it uses model's default

    def validate(self, data):
        """Validate that end_time is after start_time"""
        start_time = data.get('start_time')
        end_time = data.get('end_time')

        if start_time and end_time and end_time <= start_time:
            raise serializers.ValidationError("End time must be after start time")

        return data
