from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core import exceptions as django_exceptions
from django.db import IntegrityError, transaction
from rest_framework.exceptions import ValidationError
from .models import DriverProfile, Document, DutyStatusLog
import uuid

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    """Serializer for the user object."""
    password = serializers.CharField(
        write_only=True,
        required=True,
        style={'input_type': 'password', 'placeholder': 'Password'}
    )

    class Meta:
        model = User
        fields = ['id', 'email', 'name', 'password']
        read_only_fields = ['id']

    def validate_password(self, value):
        try:
            validate_password(value)
        except django_exceptions.ValidationError as e:
            raise serializers.ValidationError(list(e.messages))
        return value

    def create(self, validated_data):
        """Create and return a user with encrypted password."""
        return User.objects.create_user(**validated_data)


class AuthTokenSerializer(serializers.Serializer):
    """Serializer for the user authentication object."""
    email = serializers.EmailField()
    password = serializers.CharField(
        style={'input_type': 'password'},
        trim_whitespace=False
    )

    def validate(self, attrs):
        """Validate and authenticate the user."""
        email = attrs.get('email')
        password = attrs.get('password')

        user = User.objects.filter(email=email).first()

        if user and user.check_password(password):
            if not user.is_active:
                msg = 'User account is disabled.'
                raise serializers.ValidationError(msg, code='authorization')
            attrs['user'] = user
            return attrs
        else:
            msg = 'Unable to log in with provided credentials.'
            raise serializers.ValidationError(msg, code='authorization')


class DriverProfileSerializer(serializers.ModelSerializer):
    """Serializer for the driver profile object."""
    user = UserSerializer(read_only=True)

    class Meta:
        model = DriverProfile  # Fixed: uncommented and properly referenced
        fields = [
            'id', 'user', 'license_number', 'license_expiry', 'phone_number', 'company',
            'timezone', 'default_cycle', 'auto_close_trip_at_midnight', 'auto_close_trip_time'
        ]
        read_only_fields = ['id', 'user']

    def update(self, instance, validated_data):
        """Update and return driver profile."""
        user_data = validated_data.pop('user', None)
        if user_data:
            user = instance.user
            for attr, value in user_data.items():
                setattr(user, attr, value)
            user.save()

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        return instance


class DocumentSerializer(serializers.ModelSerializer):
    """Serializer for document uploads."""
    id = serializers.UUIDField(read_only=True)
    file = serializers.FileField(required=True)
    upload_date = serializers.DateTimeField(read_only=True)
    document_type = serializers.ChoiceField(choices=Document.DOCUMENT_TYPES)
    description = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = Document
        fields = ['id', 'file', 'upload_date', 'document_type', 'description']
        read_only_fields = ['id', 'upload_date']

    def create(self, validated_data):
        """Create a new document instance."""
        validated_data['driver'] = self.context['request'].user
        return super().create(validated_data)


class DutyStatusLogSerializer(serializers.ModelSerializer):
    """Serializer for duty status logs."""
    id = serializers.UUIDField(read_only=True)
    driver = serializers.PrimaryKeyRelatedField(read_only=True)
    status = serializers.ChoiceField(choices=DutyStatusLog.STATUS_CHOICES)
    location = serializers.CharField(required=True)
    latitude = serializers.DecimalField(max_digits=9, decimal_places=6, required=False, allow_null=True)
    longitude = serializers.DecimalField(max_digits=9, decimal_places=6, required=False, allow_null=True)
    vehicle_condition = serializers.ChoiceField(
        choices=DutyStatusLog.VEHICLE_CONDITION_CHOICES,
        required=False,
        allow_null=True
    )
    documents = DocumentSerializer(many=True, read_only=True)
    document_ids = serializers.ListField(
        child=serializers.UUIDField(),
        write_only=True,
        required=False,
        default=[]
    )
    co_driver = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        required=False,
        allow_null=True
    )

    class Meta:
        model = DutyStatusLog
        fields = [
            'id', 'driver', 'status', 'start_time', 'end_time', 'location',
            'latitude', 'longitude', 'odometer_start', 'odometer_end',
            'vehicle_info', 'trailer_info', 'notes', 'documents', 'document_ids',
            'co_driver', 'vehicle_condition', 'inspection_notes', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'driver', 'created_at', 'updated_at', 'documents']
        extra_kwargs = {
            'start_time': {'required': True},
            'end_time': {'required': False, 'allow_null': True},
            'odometer_start': {'required': False, 'allow_null': True},
            'odometer_end': {'required': False, 'allow_null': True},
        }

    def validate(self, attrs):
        """Validate the duty status log data."""
        status = attrs.get('status')
        
        # Require odometer_start and vehicle_condition for driving status
        if status == 'driving':
            if 'odometer_start' not in attrs or attrs['odometer_start'] is None:
                raise ValidationError({"odometer_start": "Odometer start is required for driving status."})
            
            if 'vehicle_condition' not in attrs or not attrs['vehicle_condition']:
                raise ValidationError({
                    "vehicle_condition": "Vehicle condition is required for driving status."
                })
        
        # Ensure end_time is after start_time if both are provided
        if 'start_time' in attrs and 'end_time' in attrs and attrs['end_time']:
            if attrs['end_time'] <= attrs['start_time']:
                raise ValidationError({"end_time": "End time must be after start time."})
        
        return attrs

    def create(self, validated_data):
        """Create a new duty status log."""
        document_ids = validated_data.pop('document_ids', [])
        validated_data['driver'] = self.context['request'].user
        
        # If this is a new driving log, ensure we close any existing driving logs
        if validated_data.get('status') == 'driving':
            DutyStatusLog.objects.filter(
                driver=validated_data['driver'],
                status='driving',
                end_time__isnull=True
            ).update(end_time=validated_data['start_time'])
        
        # Create the duty status log
        duty_status_log = DutyStatusLog.objects.create(**validated_data)
        
        # Associate documents if any
        if document_ids:
            documents = Document.objects.filter(
                id__in=document_ids,
                driver=validated_data['driver']
            )
            duty_status_log.documents.set(documents)
        
        return duty_status_log
    
    def update(self, instance, validated_data):
        """Update an existing duty status log."""
        document_ids = validated_data.pop('document_ids', None)
        
        # Update the instance
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        
        instance.save()
        
        # Update documents if provided
        if document_ids is not None:
            documents = Document.objects.filter(
                id__in=document_ids,
                driver=instance.driver
            )
            instance.documents.set(documents)
        
        return instance
