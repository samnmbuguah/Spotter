from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes
from django.shortcuts import get_object_or_404
from django.utils import timezone

from .models import Location, RouteStop, Trip
from .serializers import LocationSerializer, RouteStopSerializer, TripSerializer, TripListSerializer


class LocationListCreateView(generics.ListCreateAPIView):
    """List all locations or create a new location"""
    queryset = Location.objects.all()
    serializer_class = LocationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Location.objects.filter()


class LocationDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Retrieve, update or delete a location"""
    queryset = Location.objects.all()
    serializer_class = LocationSerializer
    permission_classes = [permissions.IsAuthenticated]


class RouteStopListCreateView(generics.ListCreateAPIView):
    """List all route stops or create a new route stop"""
    queryset = RouteStop.objects.all()
    serializer_class = RouteStopSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return RouteStop.objects.filter()


class RouteStopDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Retrieve, update or delete a route stop"""
    queryset = RouteStop.objects.all()
    serializer_class = RouteStopSerializer
    permission_classes = [permissions.IsAuthenticated]


class TripListCreateView(generics.ListCreateAPIView):
    """List all trips for the authenticated user or create a new trip"""
    serializer_class = TripListSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Trip.objects.filter(driver=self.request.user).select_related(
            'driver', 'current_location', 'pickup_location', 'dropoff_location'
        ).prefetch_related('route_stops')

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return TripSerializer
        return TripListSerializer

    def perform_create(self, serializer):
        serializer.save(driver=self.request.user)


class TripDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Retrieve, update or delete a trip"""
    serializer_class = TripSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Trip.objects.filter(driver=self.request.user).select_related(
            'driver', 'current_location', 'pickup_location', 'dropoff_location'
        ).prefetch_related('route_stops__location')


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def start_trip(request, pk):
    """Start a trip and begin tracking HOS"""
    trip = get_object_or_404(Trip, pk=pk, driver=request.user)

    if trip.status != 'planning':
        return Response(
            {'error': 'Trip is not in planning status'},
            status=status.HTTP_400_BAD_REQUEST
        )

    trip.status = 'active'
    trip.start_time = timezone.now()
    trip.save()

    # Create a driving log entry when trip starts
    from logs.models import LogEntry

    # Get today's date
    today = timezone.now().date()

    # Create driving status log entry
    LogEntry.objects.create(
        driver=request.user,
        date=today,
        start_time=timezone.now().time(),
        duty_status='driving',
        location=f'Trip started: {trip.name}',
        total_hours=0,
        notes=f'Automatic log entry created when trip started'
    )

    serializer = TripSerializer(trip)
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def complete_trip(request, pk):
    """Complete a trip and update HOS records"""
    trip = get_object_or_404(Trip, pk=pk, driver=request.user)

    if trip.status != 'active':
        return Response(
            {'error': 'Trip is not active'},
            status=status.HTTP_400_BAD_REQUEST
        )

    trip.status = 'completed'
    trip.end_time = timezone.now()

    # Update used hours
    if trip.start_time:
        duration = (trip.end_time - trip.start_time).total_seconds() / 3600  # Convert to hours
        trip.used_hours += duration
        trip.available_hours -= duration

    trip.save()

    # Create off-duty log entry when trip completes
    from logs.models import LogEntry

    # Get today's date
    today = timezone.now().date()

    # Create off-duty status log entry
    LogEntry.objects.create(
        driver=request.user,
        date=today,
        start_time=timezone.now().time(),
        duty_status='off_duty',
        location=f'Trip completed: {trip.name}',
        total_hours=0,
        notes=f'Automatic log entry created when trip completed'
    )

    serializer = TripSerializer(trip)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def trip_compliance_check(request, pk):
    """Check if a trip is HOS compliant"""
    trip = get_object_or_404(Trip, pk=pk, driver=request.user)

    is_compliant = trip.calculate_hos_compliance()
    estimated_hours = trip.estimate_trip_duration()

    return Response({
        'trip_id': trip.id,
        'hos_compliant': is_compliant,
        'available_hours': float(trip.available_hours),
        'estimated_trip_hours': estimated_hours,
        'remaining_hours': float(trip.available_hours) - estimated_hours,
        'current_cycle': trip.current_cycle,
    })


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def driver_hos_status(request):
    """Get current HOS status for the authenticated driver"""
    trips = Trip.objects.filter(driver=request.user, status__in=['active', 'completed'])

    total_used_hours = sum(float(trip.used_hours) for trip in trips)
    available_hours = 70.0 - total_used_hours  # Default to 70/8 cycle

    # Get the most recent reset date
    if trips.exists():
        latest_trip = trips.order_by('-last_reset_date').first()
        last_reset_date = latest_trip.last_reset_date
    else:
        last_reset_date = timezone.now().date()

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def get_current_trip(request):
    """Get or create the current active trip for the authenticated driver"""
    trip = Trip.get_or_create_current_trip(request.user)
    serializer = TripSerializer(trip)
    return Response(serializer.data)
