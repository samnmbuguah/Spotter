"""
Tests for the HOS (Hours of Service) log-related APIs.
"""
from django.test import TestCase, Client
from django.urls import reverse
from rest_framework import status
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import RefreshToken
from core.models import HOSLog, Trip
from datetime import datetime, timedelta
import json

User = get_user_model()

class HOSLogAPITests(TestCase):
    """Test the HOS log-related APIs."""

    def setUp(self):
        """Set up test data."""
        self.client = Client()
        self.user = User.objects.create_user(
            email='driver@example.com',
            password='testpass123',
            name='Test Driver',
            is_driver=True
        )
        
        # Create a trip for testing
        self.trip = Trip.objects.create(
            driver=self.user,
            start_time=datetime.now() - timedelta(hours=2),
            expected_end_time=datetime.now() + timedelta(hours=2),
            status='in_progress'
        )
        
        # Create test HOS logs
        self.log1 = HOSLog.objects.create(
            driver=self.user,
            status='off_duty',
            start_time=datetime.now() - timedelta(hours=10),
            end_time=datetime.now() - timedelta(hours=8),
            location='Test Location 1',
            notes='Off duty period',
            is_certified=False
        )
        
        self.log2 = HOSLog.objects.create(
            driver=self.user,
            status='driving',
            start_time=datetime.now() - timedelta(hours=2),
            location='Test Location 2',  # No end time for current status
            notes='Currently driving',
            is_certified=False,
            trip=self.trip
        )
        
        # URLs
        self.log_list_url = reverse('core:hoslog-list')
        self.log_detail_url = reverse('core:hoslog-detail', args=[self.log1.id])
        self.daily_logs_url = reverse('core:hoslog-daily-logs')
        self.generate_daily_log_url = reverse('core:hoslog-generate-daily')
        self.certify_daily_log_url = reverse('core:hoslog-certify-daily', args=[1])  # Will be updated in test
        self.download_daily_log_url = reverse('core:hoslog-download-daily')
    
    def get_auth_headers(self, user=None):
        """Helper method to get authentication headers."""
        if user is None:
            user = self.user
        refresh = RefreshToken.for_user(user)
        return {
            'HTTP_AUTHORIZATION': f'Bearer {refresh.access_token}'
        }

    def test_create_hos_log(self):
        """Test creating a new HOS log entry."""
        data = {
            'status': 'on_duty',
            'start_time': (datetime.now() - timedelta(hours=1)).isoformat(),
            'location': 'Test Location 3',
            'notes': 'On duty for trip',
            'trip': self.trip.id
        }
        
        response = self.client.post(
            self.log_list_url,
            data=data,
            content_type='application/json',
            **self.get_auth_headers()
        )
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(HOSLog.objects.count(), 3)  # Original logs + new log
        self.assertEqual(HOSLog.objects.latest('id').driver, self.user)
        self.assertEqual(HOSLog.objects.latest('id').status, 'on_duty')

    def test_get_hos_log_list(self):
        """Test retrieving a list of HOS logs."""
        response = self.client.get(
            self.log_list_url,
            **self.get_auth_headers()
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)  # Two logs exist
        self.assertEqual(response.data[0]['id'], self.log1.id)
        self.assertEqual(response.data[1]['id'], self.log2.id)

    def test_get_hos_log_detail(self):
        """Test retrieving a single HOS log's details."""
        response = self.client.get(
            self.log_detail_url,
            **self.get_auth_headers()
        )
        
        self.assertEqual(response.data['id'], self.log1.id)
        self.assertEqual(response.data['status'], 'off_duty')
        self.assertEqual(response.data['notes'], 'Off duty period')

    def test_update_hos_log(self):
        ""Test updating a HOS log entry."""
        update_data = {
            'end_time': (datetime.now() - timedelta(hours=7)).isoformat(),
            'notes': 'Updated off duty period',
            'is_certified': True
        }
        
        response = self.client.patch(
            self.log_detail_url,
            data=update_data,
            content_type='application/json',
            **self.get_auth_headers()
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.log1.refresh_from_db()
        self.assertEqual(self.log1.notes, 'Updated off duty period')
        self.assertTrue(self.log1.is_certified)

    def test_delete_hos_log(self):
        ""Test deleting a HOS log entry."""
        log_id = self.log1.id
        response = self.client.delete(
            self.log_detail_url,
            **self.get_auth_headers()
        )
        
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(HOSLog.objects.filter(id=log_id).count(), 0)

    def test_get_daily_logs(self):
        ""Test retrieving daily logs summary."""
        response = self.client.get(
            self.daily_logs_url,
            **self.get_auth_headers()
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Should return logs grouped by date
        self.assertIn('logs_by_date', response.data)
        self.assertGreaterEqual(len(response.data['logs_by_date']), 1)

    def test_generate_daily_log(self):
        ""Test generating a daily log."""
        response = self.client.post(
            self.generate_daily_log_url,
            data={'date': datetime.now().date().isoformat()},
            content_type='application/json',
            **self.get_auth_headers()
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('daily_log', response.data)
        self.assertIn('summary', response.data)

    def test_certify_daily_log(self):
        ""Test certifying a daily log."""
        # First, generate a daily log to get its ID
        response = self.client.post(
            self.generate_daily_log_url,
            data={'date': datetime.now().date().isoformat()},
            content_type='application/json',
            **self.get_auth_headers()
        )
        
        log_id = response.data['daily_log']['id']
        certify_url = reverse('core:hoslog-certify-daily', args=[log_id])
        
        response = self.client.post(
            certify_url,
            **self.get_auth_headers()
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['is_certified'])

    def test_download_daily_log_pdf(self):
        ""Test downloading a daily log as PDF."""
        response = self.client.get(
            f"{self.download_daily_log_url}?date={datetime.now().date().isoformat()}",
            **self.get_auth_headers()
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response['Content-Type'], 'application/pdf')
        self.assertIn('attachment', response['Content-Disposition'])

    def test_unauthorized_access(self):
        """Test that users can only access their own logs."""
        # Create another user
        other_user = User.objects.create_user(
            email='other@example.com',
            password='otherpass123',
            name='Other User',
            is_driver=True
        )
        
        # Other user tries to access the log
        response = self.client.get(
            self.log_detail_url,
            **self.get_auth_headers(other_user)
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        
        # Unauthenticated user tries to access the log
        response = self.client.get(self.log_detail_url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
