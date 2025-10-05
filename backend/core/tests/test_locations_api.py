"""
Tests for the location-related APIs.
"""
from django.test import TestCase, Client
from django.urls import reverse
from rest_framework import status
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import RefreshToken
from core.models import Location

User = get_user_model()

class LocationAPITests(TestCase):
    """Test the location-related APIs."""

    def setUp(self):
        """Set up test data."""
        self.client = Client()
        self.user = User.objects.create_user(
            email='admin@example.com',
            password='testpass123',
            name='Test Admin',
            is_staff=True
        )
        
        # Create test locations
        self.location1 = Location.objects.create(
            name='Test Location 1',
            address='123 Test St, Test City',
            latitude=40.7128,
            longitude=-74.0060
        )
        
        self.location2 = Location.objects.create(
            name='Test Location 2',
            address='456 Test Ave, Test City',
            latitude=34.0522,
            longitude=-118.2437
        )
        
        # URLs
        self.location_list_url = reverse('core:location-list')
        self.location_detail_url = reverse('core:location-detail', args=[self.location1.id])
    
    def get_auth_headers(self, user=None):
        """Helper method to get authentication headers."""
        if user is None:
            user = self.user
        refresh = RefreshToken.for_user(user)
        return {
            'HTTP_AUTHORIZATION': f'Bearer {refresh.access_token}'
        }

    def test_create_location(self):
        """Test creating a new location (admin only)."""
        data = {
            'name': 'New Test Location',
            'address': '789 Test Blvd, Test City',
            'latitude': 41.8781,
            'longitude': -87.6298,
            'description': 'A test location',
            'is_active': True
        }
        
        response = self.client.post(
            self.location_list_url,
            data=data,
            content_type='application/json',
            **self.get_auth_headers()
        )
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Location.objects.count(), 3)  # Original 2 + new location
        self.assertEqual(Location.objects.latest('id').name, 'New Test Location')
        self.assertTrue(Location.objects.latest('id').is_active)

    def test_get_location_list(self):
        """Test retrieving a list of locations."""
        response = self.client.get(
            self.location_list_url,
            **self.get_auth_headers()
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)  # Two locations exist
        self.assertEqual(response.data[0]['name'], 'Test Location 1')
        self.assertEqual(response.data[1]['name'], 'Test Location 2')

    def test_get_location_detail(self):
        """Test retrieving a single location's details."""
        response = self.client.get(
            self.location_detail_url,
            **self.get_auth_headers()
        )
        
        self.assertEqual(response.data['id'], self.location1.id)
        self.assertEqual(response.data['name'], 'Test Location 1')
        self.assertEqual(response.data['address'], '123 Test St, Test City')

    def test_update_location(self):
        """Test updating a location (admin only)."""
        update_data = {
            'name': 'Updated Test Location',
            'address': '123 Updated St, Test City',
            'is_active': False
        }
        
        response = self.client.patch(
            self.location_detail_url,
            data=update_data,
            content_type='application/json',
            **self.get_auth_headers()
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.location1.refresh_from_db()
        self.assertEqual(self.location1.name, 'Updated Test Location')
        self.assertEqual(self.location1.address, '123 Updated St, Test City')
        self.assertFalse(self.location1.is_active)

    def test_delete_location(self):
        ""Test deleting a location (admin only)."""
        location_id = self.location1.id
        response = self.client.delete(
            self.location_detail_url,
            **self.get_auth_headers()
        )
        
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(Location.objects.filter(id=location_id).count(), 0)

    def test_unauthorized_access(self):
        ""Test that only admin users can modify locations."""
        # Create a non-admin user
        regular_user = User.objects.create_user(
            email='regular@example.com',
            password='regularpass123',
            name='Regular User',
            is_staff=False
        )
        
        # Regular user tries to create a location
        data = {
            'name': 'Unauthorized Location',
            'address': '123 Unauthorized St',
            'latitude': 0,
            'longitude': 0
        }
        
        # Test create
        response = self.client.post(
            self.location_list_url,
            data=data,
            content_type='application/json',
            **self.get_auth_headers(regular_user)
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        
        # Test update
        response = self.client.patch(
            self.location_detail_url,
            data={'name': 'Updated Name'},
            content_type='application/json',
            **self.get_auth_headers(regular_user)
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        
        # Test delete
        response = self.client.delete(
            self.location_detail_url,
            **self.get_auth_headers(regular_user)
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        
        # Unauthenticated user tries to access the API
        response = self.client.get(self.location_list_url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_search_locations(self):
        ""Test searching for locations by name or address."""
        # Search by name
        response = self.client.get(
            f"{self.location_list_url}?search=Location 1",
            **self.get_auth_headers()
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['name'], 'Test Location 1')
        
        # Search by address
        response = self.client.get(
            f"{self.location_list_url}?search=Test Ave",
            **self.get_auth_headers()
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['name'], 'Test Location 2')
