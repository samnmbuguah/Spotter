from django.urls import path
from . import views

app_name = 'trips'

urlpatterns = [
    # Location endpoints
    path('locations/', views.LocationListCreateView.as_view(), name='location-list-create'),
    path('locations/<int:pk>/', views.LocationDetailView.as_view(), name='location-detail'),

    # Route stop endpoints
    path('route-stops/', views.RouteStopListCreateView.as_view(), name='route-stop-list-create'),
    path('route-stops/<int:pk>/', views.RouteStopDetailView.as_view(), name='route-stop-detail'),

    # Trip endpoints
    path('', views.TripListCreateView.as_view(), name='trip-list-create'),
    path('current/', views.get_current_trip, name='trip-current'),
    path('<int:pk>/', views.TripDetailView.as_view(), name='trip-detail'),
    path('<int:pk>/start/', views.start_trip, name='trip-start'),
    path('<int:pk>/complete/', views.complete_trip, name='trip-complete'),
    path('<int:pk>/compliance-check/', views.trip_compliance_check, name='trip-compliance-check'),

    # Driver HOS status
    path('hos-status/', views.driver_hos_status, name='driver-hos-status'),
]
