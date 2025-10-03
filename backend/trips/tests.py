import pytest
from django.test import TestCase
from django.contrib.auth import get_user_model
from faker import Faker

from .models import Location, RouteStop, Trip
from .serializers import LocationSerializer, RouteStopSerializer, TripSerializer

fake = Faker()

User = get_user_model()


class LocationModelTest(TestCase):
    """Test cases for Location model"""

    def setUp(self):
        self.location_data = {
            'name': fake.company(),
            'address': fake.address(),
            'city': fake.city(),
            'state': fake.state_abbr(),
            'zip_code': fake.zipcode(),
            'latitude': fake.latitude(),
            'longitude': fake.longitude(),
        }

    def test_location_creation(self):
        """Test creating a location"""
        location = Location.objects.create(**self.location_data)
        self.assertEqual(location.name, self.location_data['name'])
        self.assertEqual(location.address, self.location_data['address'])
        self.assertEqual(str(location), f"{location.name}, {location.city}, {location.state}")

    def test_location_unique_together(self):
        """Test that name and address must be unique together"""
        Location.objects.create(**self.location_data)
        
        with self.assertRaises(Exception):  # Could be IntegrityError depending on database
            Location.objects.create(**self.location_data)

    def test_location_str_method(self):
        """Test location string representation"""
        location = Location.objects.create(**self.location_data)
        expected = f"{location.name}, {location.city}, {location.state}"
        self.assertEqual(str(location), expected)


class RouteStopModelTest(TestCase):
    """Test cases for RouteStop model"""

    def setUp(self):
        self.location = Location.objects.create(
            name=fake.company(),
            address=fake.address(),
            city=fake.city(),
            state=fake.state_abbr(),
            zip_code=fake.zipcode(),
        )
        self.route_stop_data = {
            'name': fake.company(),
            'location': self.location,
            'stop_type': 'rest',
            'estimated_duration': 30,
            'order': 1,
        }

    def test_route_stop_creation(self):
        """Test creating a route stop"""
        route_stop = RouteStop.objects.create(**self.route_stop_data)
        self.assertEqual(route_stop.name, self.route_stop_data['name'])
        self.assertEqual(route_stop.stop_type, 'rest')
        self.assertEqual(route_stop.get_stop_type_display(), 'Rest Stop')

    def test_route_stop_ordering(self):
        """Test that route stops are ordered by order field"""
        # Create multiple route stops
        for i in range(3):
            RouteStop.objects.create(
                name=fake.company(),
                location=self.location,
                stop_type='rest',
                estimated_duration=30,
                order=i,
            )

        route_stops = RouteStop.objects.all()
        orders = [stop.order for stop in route_stops]
        self.assertEqual(orders, [0, 1, 2])


class TripModelTest(TestCase):
    """Test cases for Trip model"""

    def setUp(self):
        self.user = User.objects.create_user(
            email='test@example.com',
            password='testpass123',
            name='Test Driver'
        )

        # Create test locations
        self.current_location = Location.objects.create(
            name='Current Location',
            address='123 Current St',
            city='Current City',
            state='CC',
        )
        self.pickup_location = Location.objects.create(
            name='Pickup Location',
            address='456 Pickup Ave',
            city='Pickup City',
            state='PC',
        )
        self.dropoff_location = Location.objects.create(
            name='Dropoff Location',
            address='789 Dropoff Blvd',
            city='Dropoff City',
            state='DC',
        )

    def test_trip_creation(self):
        """Test creating a trip"""
        trip = Trip.objects.create(
            driver=self.user,
            name='Test Trip',
            current_location=self.current_location,
            pickup_location=self.pickup_location,
            dropoff_location=self.dropoff_location,
            total_distance=100.0,
        )

        self.assertEqual(trip.driver, self.user)
        self.assertEqual(trip.name, 'Test Trip')
        self.assertEqual(trip.status, 'planning')
        self.assertEqual(trip.current_cycle, '70_8')
        self.assertEqual(trip.available_hours, 70.0)

    def test_trip_hos_compliance_calculation(self):
        """Test HOS compliance calculation"""
        trip = Trip.objects.create(
            driver=self.user,
            name='Test Trip',
            current_location=self.current_location,
            pickup_location=self.pickup_location,
            dropoff_location=self.dropoff_location,
            total_distance=50.0,  # Should take less than 1 hour at 60 mph
        )

        # Should be compliant since 50 miles / 60 mph ≈ 0.83 hours < 70 hours available
        self.assertTrue(trip.calculate_hos_compliance())

        # Test with insufficient hours
        trip.available_hours = 0.5  # Less than estimated trip time
        trip.save()
        self.assertFalse(trip.calculate_hos_compliance())

    def test_trip_duration_estimation(self):
        """Test trip duration estimation"""
        trip = Trip.objects.create(
            driver=self.user,
            name='Test Trip',
            current_location=self.current_location,
            pickup_location=self.pickup_location,
            dropoff_location=self.dropoff_location,
            total_distance=120.0,  # 2 hours at 60 mph
        )

        estimated_hours = trip.estimate_trip_duration()
        self.assertEqual(estimated_hours, 2.0)

        # Test without distance
        trip.total_distance = None
        trip.save()
        self.assertEqual(trip.estimate_trip_duration(), 0)


class LocationSerializerTest(TestCase):
    """Test cases for Location serializer"""

    def setUp(self):
        self.location_data = {
            'name': fake.company(),
            'address': fake.address(),
            'city': fake.city(),
            'state': fake.state_abbr(),
            'zip_code': fake.zipcode(),
            'latitude': fake.latitude(),
            'longitude': fake.longitude(),
        }

    def test_location_serializer_valid(self):
        """Test valid location serialization"""
        serializer = LocationSerializer(data=self.location_data)
        self.assertTrue(serializer.is_valid())
        location = serializer.save()
        self.assertEqual(location.name, self.location_data['name'])

    def test_location_serializer_invalid(self):
        """Test invalid location serialization"""
        invalid_data = self.location_data.copy()
        del invalid_data['name']  # Required field

        serializer = LocationSerializer(data=invalid_data)
        self.assertFalse(serializer.is_valid())


class RouteStopSerializerTest(TestCase):
    """Test cases for RouteStop serializer"""

    def setUp(self):
        self.location = Location.objects.create(
            name=fake.company(),
            address=fake.address(),
            city=fake.city(),
            state=fake.state_abbr(),
        )

    def test_route_stop_serializer_valid(self):
        """Test valid route stop serialization"""
        data = {
            'name': fake.company(),
            'location_id': self.location.id,
            'stop_type': 'rest',
            'estimated_duration': 30,
            'order': 1,
        }

        serializer = RouteStopSerializer(data=data)
        self.assertTrue(serializer.is_valid())
        route_stop = serializer.save()
        self.assertEqual(route_stop.name, data['name'])


class TripSerializerTest(TestCase):
    """Test cases for Trip serializer"""

    def setUp(self):
        self.user = User.objects.create_user(
            email='test@example.com',
            password='testpass123',
            name='Test Driver'
        )

        self.current_location = Location.objects.create(
            name='Current Location',
            address='123 Current St',
            city='Current City',
            state='CC',
        )
        self.pickup_location = Location.objects.create(
            name='Pickup Location',
            address='456 Pickup Ave',
            city='Pickup City',
            state='PC',
        )
        self.dropoff_location = Location.objects.create(
            name='Dropoff Location',
            address='789 Dropoff Blvd',
            city='Dropoff City',
            state='DC',
        )

    def test_trip_serializer_valid(self):
        """Test valid trip serialization"""
        data = {
            'name': 'Test Trip',
            'current_location_id': self.current_location.id,
            'pickup_location_id': self.pickup_location.id,
            'dropoff_location_id': self.dropoff_location.id,
            'total_distance': 100.0,
        }

        serializer = TripSerializer(data=data)
        self.assertTrue(serializer.is_valid())
        trip = serializer.save(driver=self.user)
        self.assertEqual(trip.name, 'Test Trip')
        self.assertEqual(trip.driver, self.user)
