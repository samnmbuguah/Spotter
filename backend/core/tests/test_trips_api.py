"""
Tests for the trip-related APIs.
"""
from django.test import TestCase, Client
from django.urls import reverse
from rest_framework import status
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import RefreshToken
from core.models import Trip, Location
from datetime import datetime, timedelta

User = get_user_model()

class TripAPITests(TestCase):
    """Test the trip-related APIs."""

    def setUp(self):
        """Set up test data."""
        self.client = Client()
        self.user = User.objects.create_user(
            email='driver@example.com',
            password='testpass123',
            name='Test Driver',
            is_driver=True
        )
        self.other_user = User.objects.create_user(
            email='other@example.com',
            password='otherpass123',
            name='Other User'
        )
        
        # Create locations
        self.origin = Location.objects.create(
            name='Test Origin',
            address='123 Test St, Origin City',
            latitude=40.7128,
            longitude=-74.0060
        )
        self.destination = Location.objects.create(
            name='Test Destination',
            address='456 Test Ave, Destination City',
            latitude=34.0522,
            longitude=-118.2437
        )
        
        # Create test trips
        self.trip = Trip.objects.create(
            driver=self.user,
            origin=self.origin,
            destination=self.destination,
            start_time=datetime.now() - timedelta(hours=2),
            expected_end_time=datetime.now() + timedelta(hours=2),
            status='in_progress'
        )
        
        # URLs
        self.trip_list_url = reverse('core:trip-list')
        self.trip_detail_url = reverse('core:trip-detail', args=[self.trip.id])
        self.start_trip_url = reverse('core:trip-start', args=[self.trip.id])
        self.complete_trip_url = reverse('core:trip-complete', args=[self.trip.id])
        self.check_compliance_url = reverse('core:trip-check-compliance', args=[self.trip.id])
    
    def get_auth_headers(self, user=None):
        """Helper method to get authentication headers."""
        if user is None:
            user = self.user
        refresh = RefreshToken.for_user(user)
        return {
            'HTTP_AUTHORIZATION': f'Bearer {refresh.access_token}'
        }

    def test_create_trip(self):
        """Test creating a new trip."""
        data = {
            'origin': self.origin.id,
            'destination': self.destination.id,
            'start_time': (datetime.now() + timedelta(hours=1)).isoformat(),
            'expected_end_time': (datetime.now() + timedelta(hours=5)).isoformat(),
            'status': 'scheduled'
        }
        
        response = self.client.post(
            self.trip_list_url,
            data=data,
            content_type='application/json',
            **self.get_auth_headers()
        )
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Trip.objects.count(), 2)  # Original trip + new trip
        self.assertEqual(Trip.objects.latest('id').driver, self.user)

    def test_get_trip_list(self):
        """Test retrieving a list of trips."""
        response = self.client.get(
            self.trip_list_url,
            **self.get_auth_headers()
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)  # Only one trip exists
        self.assertEqual(response.data[0]['id'], self.trip.id)

    def test_get_trip_detail(self):
        """Test retrieving a single trip's details."""
        response = self.client.get(
            self.trip_detail_url,
            **self.get_auth_headers()
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['id'], self.trip.id)
        self.assertEqual(response.data['status'], 'in_progress')

    def test_update_trip(self):
        ""Test updating a trip."""
        update_data = {
            'status': 'delayed',
            'notes': 'Traffic delay'
        }
        
        response = self.client.patch(
            self.trip_detail_url,
            data=update_data,
            content_type='application/json',
            **self.get_auth_headers()
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.trip.refresh_from_db()
        self.assertEqual(self.trip.status, 'delayed')
        self.assertEqual(self.trip.notes, 'Traffic delay')

    def test_delete_trip(self):
        ""Test deleting a trip."""
        response = self.client.delete(
            self.trip_detail_url,
            **self.get_auth_headers()
        )
        
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(Trip.objects.count(), 0)

    def test_start_trip(self):
        ""Test starting a trip."""
        self.trip.status = 'scheduled'
        self.trip.save()
        
        response = self.client.post(
            self.start_trip_url,
            **self.get_auth_headers()
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.trip.refresh_from_db()
        self.assertEqual(self.trip.status, 'in_progress')
        self.assertIsNotNone(self.trip.actual_start_time)

    def test_complete_trip(self):
        ""Test completing a trip."""
        response = self.client.post(
            self.complete_trip_url,
            **self.get_auth_headers()
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.trip.refresh_from_db()
        self.assertEqual(self.trip.status, 'completed')
        self.assertIsNotNone(self.trip.actual_end_time)

    def test_check_compliance(self):
        ""Test checking trip compliance."""
        response = self.client.get(
            self.check_compliance_url,
            **self.get_auth_headers()
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('is_compliant', response.data)
        self.assertIn('violations', response.data)

    def test_unauthorized_access(self):
        ""Test that users can only access their own trips."""
        # Other user tries to access the trip
        response = self.client.get(
            self.trip_detail_url,
            **self.get_auth_headers(self.other_user)
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        
        # Unauthenticated user tries to access the trip
        response = self.client.get(self.trip_detail_url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
