"""
Tests for the login API.
"""
from django.test import TestCase, Client
from django.urls import reverse
from rest_framework import status
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import RefreshToken

User = get_user_model()

class LoginAPITests(TestCase):
    """Test the login API."""

    def setUp(self):
        """Set up test data."""
        self.client = Client()
        self.login_url = reverse('core:login')
        self.user_data = {
            'email': 'test@example.com',
            'password': 'testpass123',
            'name': 'Test User'
        }
        self.user = User.objects.create_user(**self.user_data)

    def test_login_success(self):
        """Test successful login with valid credentials."""
        response = self.client.post(
            self.login_url,
            data={'email': 'test@example.com', 'password': 'testpass123'},
            content_type='application/json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)
        self.assertIn('user', response.data)
        self.assertEqual(response.data['user']['email'], 'test@example.com')
        self.assertEqual(response.data['user']['name'], 'Test User')
        self.assertIn('csrftoken', response.cookies)

    def test_login_invalid_credentials(self):
        """Test login with invalid credentials."""
        response = self.client.post(
            self.login_url,
            data={'email': 'test@example.com', 'password': 'wrongpass'},
            content_type='application/json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(response.data['detail'], 'Invalid credentials')

    def test_login_missing_email(self):
        """Test login with missing email."""
        response = self.client.post(
            self.login_url,
            data={'password': 'testpass123'},
            content_type='application/json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['detail'], 'Please provide both email and password')

    def test_login_missing_password(self):
        """Test login with missing password."""
        response = self.client.post(
            self.login_url,
            data={'email': 'test@example.com'},
            content_type='application/json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['detail'], 'Please provide both email and password')

    def test_login_inactive_user(self):
        """Test login with an inactive user account."""
        self.user.is_active = False
        self.user.save()
        
        response = self.client.post(
            self.login_url,
            data={'email': 'test@example.com', 'password': 'testpass123'},
            content_type='application/json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(response.data['detail'], 'Invalid credentials')
