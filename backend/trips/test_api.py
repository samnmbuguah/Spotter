import json
from django.urls import reverse
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase
from faker import Faker

from .models import Location, RouteStop, Trip

fake = Faker()

User = get_user_model()


class LocationAPITest(APITestCase):
    """Test cases for Location API endpoints"""

    def setUp(self):
        self.user = User.objects.create_user(
            email='test@example.com',
            password='testpass123',
            name='Test User'
        )
        self.client.force_authenticate(user=self.user)

        self.location_data = {
            'name': fake.company(),
            'address': fake.address(),
            'city': fake.city(),
            'state': fake.state_abbr(),
            'zip_code': fake.zipcode(),
            'latitude': fake.latitude(),
            'longitude': fake.longitude(),
        }

    def test_create_location(self):
        """Test creating a location via API"""
        url = reverse('location-list-create')
        response = self.client.post(url, self.location_data, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Location.objects.count(), 1)
        self.assertEqual(Location.objects.get().name, self.location_data['name'])

    def test_list_locations(self):
        """Test listing locations via API"""
        # Create a location
        Location.objects.create(**self.location_data)

        url = reverse('location-list-create')
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

    def test_get_location_detail(self):
        """Test getting a specific location via API"""
        location = Location.objects.create(**self.location_data)

        url = reverse('location-detail', kwargs={'pk': location.pk})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['name'], location.name)

    def test_update_location(self):
        """Test updating a location via API"""
        location = Location.objects.create(**self.location_data)

        url = reverse('location-detail', kwargs={'pk': location.pk})
        updated_data = self.location_data.copy()
        updated_data['name'] = 'Updated Location Name'

        response = self.client.put(url, updated_data, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        location.refresh_from_db()
        self.assertEqual(location.name, 'Updated Location Name')

    def test_delete_location(self):
        """Test deleting a location via API"""
        location = Location.objects.create(**self.location_data)

        url = reverse('location-detail', kwargs={'pk': location.pk})
        response = self.client.delete(url)

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(Location.objects.count(), 0)


class TripAPITest(APITestCase):
    """Test cases for Trip API endpoints"""

    def setUp(self):
        self.user = User.objects.create_user(
            email='test@example.com',
            password='testpass123',
            name='Test Driver'
        )
        self.client.force_authenticate(user=self.user)

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

    def test_create_trip(self):
        """Test creating a trip via API"""
        url = reverse('trip-list-create')
        trip_data = {
            'name': 'Test Trip',
            'current_location': self.current_location.id,
            'pickup_location': self.pickup_location.id,
            'dropoff_location': self.dropoff_location.id,
            'total_distance': 100.0,
        }

        response = self.client.post(url, trip_data, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Trip.objects.count(), 1)
        trip = Trip.objects.get()
        self.assertEqual(trip.name, 'Test Trip')
        self.assertEqual(trip.driver, self.user)

    def test_list_trips(self):
        """Test listing trips via API"""
        # Create a trip for the authenticated user
        Trip.objects.create(
            driver=self.user,
            name='Test Trip',
            current_location=self.current_location,
            pickup_location=self.pickup_location,
            dropoff_location=self.dropoff_location,
        )

        url = reverse('trip-list-create')
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

    def test_get_trip_detail(self):
        """Test getting a specific trip via API"""
        trip = Trip.objects.create(
            driver=self.user,
            name='Test Trip',
            current_location=self.current_location,
            pickup_location=self.pickup_location,
            dropoff_location=self.dropoff_location,
        )

        url = reverse('trip-detail', kwargs={'pk': trip.pk})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['name'], trip.name)

    def test_start_trip(self):
        """Test starting a trip via API"""
        trip = Trip.objects.create(
            driver=self.user,
            name='Test Trip',
            current_location=self.current_location,
            pickup_location=self.pickup_location,
            dropoff_location=self.dropoff_location,
        )

        url = reverse('start-trip', kwargs={'pk': trip.pk})
        response = self.client.post(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        trip.refresh_from_db()
        self.assertEqual(trip.status, 'active')

    def test_start_trip_invalid_status(self):
        """Test starting a trip that's not in planning status"""
        trip = Trip.objects.create(
            driver=self.user,
            name='Test Trip',
            current_location=self.current_location,
            pickup_location=self.pickup_location,
            dropoff_location=self.dropoff_location,
            status='active'  # Already active
        )

        url = reverse('start-trip', kwargs={'pk': trip.pk})
        response = self.client.post(url)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['error'], 'Trip is not in planning status')

    def test_complete_trip(self):
        """Test completing a trip via API"""
        trip = Trip.objects.create(
            driver=self.user,
            name='Test Trip',
            current_location=self.current_location,
            pickup_location=self.pickup_location,
            dropoff_location=self.dropoff_location,
            status='active',
            start_time='2024-01-01T10:00:00Z'
        )

        url = reverse('complete-trip', kwargs={'pk': trip.pk})
        response = self.client.post(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        trip.refresh_from_db()
        self.assertEqual(trip.status, 'completed')

    def test_trip_compliance_check(self):
        """Test HOS compliance check via API"""
        trip = Trip.objects.create(
            driver=self.user,
            name='Test Trip',
            current_location=self.current_location,
            pickup_location=self.pickup_location,
            dropoff_location=self.dropoff_location,
            total_distance=50.0,  # Should be compliant
        )

        url = reverse('trip-compliance-check', kwargs={'pk': trip.pk})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['hos_compliant'])
        self.assertEqual(response.data['current_cycle'], '70_8')

    def test_driver_hos_status(self):
        """Test getting driver HOS status via API"""
        # Create a completed trip
        Trip.objects.create(
            driver=self.user,
            name='Completed Trip',
            current_location=self.current_location,
            pickup_location=self.pickup_location,
            dropoff_location=self.dropoff_location,
            status='completed',
            used_hours=8.0,
        )

        url = reverse('driver-hos-status')
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['available_hours'], 62.0)  # 70 - 8
        self.assertEqual(response.data['used_hours'], 8.0)


class AuthenticationTest(APITestCase):
    """Test cases for authentication requirements"""

    def setUp(self):
        self.location_data = {
            'name': fake.company(),
            'address': fake.address(),
            'city': fake.city(),
            'state': fake.state_abbr(),
            'zip_code': fake.zipcode(),
        }

    def test_unauthenticated_access(self):
        """Test that endpoints require authentication"""
        self.client.force_authenticate(user=None)

        url = reverse('location-list-create')
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
