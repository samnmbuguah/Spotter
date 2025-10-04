from rest_framework import serializers
from .models import Location, RouteStop, Trip


class LocationSerializer(serializers.ModelSerializer):
    """Serializer for Location model"""

    class Meta:
        model = Location
        fields = ['id', 'name', 'address', 'city', 'state', 'zip_code', 'latitude', 'longitude']
        read_only_fields = ['id']


class RouteStopSerializer(serializers.ModelSerializer):
    """Serializer for RouteStop model"""
    location = LocationSerializer(read_only=True)
    location_id = serializers.IntegerField(write_only=True)

    class Meta:
        model = RouteStop
        fields = ['id', 'name', 'location', 'location_id', 'stop_type', 'estimated_duration', 'order']
        read_only_fields = ['id']

    def create(self, validated_data):
        location_id = validated_data.pop('location_id')
        location = Location.objects.get(id=location_id)
        route_stop = RouteStop.objects.create(location=location, **validated_data)
        return route_stop


class TripSerializer(serializers.ModelSerializer):
    """Serializer for Trip model"""
    current_location = LocationSerializer(read_only=True)
    pickup_location = LocationSerializer(read_only=True)
    dropoff_location = LocationSerializer(read_only=True)
    route_stops = RouteStopSerializer(many=True, read_only=True)

    # Accept location data instead of just IDs
    current_location_data = serializers.DictField(write_only=True, required=False)
    pickup_location_data = serializers.DictField(write_only=True, required=False)
    dropoff_location_data = serializers.DictField(write_only=True)
    route_stop_ids = serializers.ListField(
        child=serializers.IntegerField(), write_only=True, required=False
    )

    class Meta:
        model = Trip
        fields = [
            'id', 'name', 'current_location', 'pickup_location', 'dropoff_location',
            'current_cycle', 'status', 'start_time', 'end_time', 'total_distance',
            'available_hours', 'used_hours', 'route_stops',
            'current_location_data', 'pickup_location_data', 'dropoff_location_data', 'route_stop_ids',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'available_hours', 'used_hours', 'created_at', 'updated_at']

    def create_location_if_not_exists(self, location_data):
        """Create or get a location based on address"""
        if not location_data:
            return None

        # Try to find existing location with same address
        try:
            return Location.objects.get(address=location_data.get('address'))
        except Location.DoesNotExist:
            # Create new location
            location = Location.objects.create(
                name=location_data.get('name', ''),
                address=location_data.get('address', ''),
                latitude=location_data.get('lat'),
                longitude=location_data.get('lng'),
                city=location_data.get('city', ''),
                state=location_data.get('state', ''),
                zip_code=location_data.get('zip_code', ''),
            )
            return location

    def create(self, validated_data):
        # Extract location data
        current_location_data = validated_data.pop('current_location_data', None)
        pickup_location_data = validated_data.pop('pickup_location_data', None)
        dropoff_location_data = validated_data.pop('dropoff_location_data', None)
        route_stop_ids = validated_data.pop('route_stop_ids', [])

        # Create or get location objects
        current_location = self.create_location_if_not_exists(current_location_data) if current_location_data else None
        pickup_location = self.create_location_if_not_exists(pickup_location_data) if pickup_location_data else None
        dropoff_location = self.create_location_if_not_exists(dropoff_location_data) if dropoff_location_data else None

        # Create trip
        trip = Trip.objects.create(
            current_location=current_location,
            pickup_location=pickup_location,
            dropoff_location=dropoff_location,
            **validated_data
        )

        # Add route stops if provided
        if route_stop_ids:
            route_stops = RouteStop.objects.filter(id__in=route_stop_ids)
            trip.route_stops.set(route_stops)

        return trip

    def update(self, instance, validated_data):
        # Extract location data
        current_location_data = validated_data.pop('current_location_data', None)
        pickup_location_data = validated_data.pop('pickup_location_data', None)
        dropoff_location_data = validated_data.pop('dropoff_location_data', None)
        route_stop_ids = validated_data.pop('route_stop_ids', None)

        # Update locations if provided
        if current_location_data is not None:
            instance.current_location = self.create_location_if_not_exists(current_location_data)
        if pickup_location_data is not None:
            instance.pickup_location = self.create_location_if_not_exists(pickup_location_data)
        if dropoff_location_data is not None:
            instance.dropoff_location = self.create_location_if_not_exists(dropoff_location_data)

        # Update route stops if provided
        if route_stop_ids is not None:
            route_stops = RouteStop.objects.filter(id__in=route_stop_ids)
            instance.route_stops.set(route_stops)

        # Update other fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        instance.save()
        return instance


class TripListSerializer(serializers.ModelSerializer):
    """Simplified serializer for trip listings"""
    current_location = LocationSerializer(read_only=True)
    pickup_location = LocationSerializer(read_only=True)
    dropoff_location = LocationSerializer(read_only=True)
    hos_compliant = serializers.SerializerMethodField()

    class Meta:
        model = Trip
        fields = [
            'id', 'name', 'current_location', 'pickup_location', 'dropoff_location',
            'current_cycle', 'status', 'total_distance', 'available_hours', 'hos_compliant',
            'created_at'
        ]

    def get_hos_compliant(self, obj):
        return obj.calculate_hos_compliance()
