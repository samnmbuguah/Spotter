from django.urls import path
from . import views

app_name = 'logs'

urlpatterns = [
    # Log entry endpoints
    path('entries/', views.LogEntryListCreateView.as_view(), name='log-entry-list-create'),
    path('entries/<int:pk>/', views.LogEntryDetailView.as_view(), name='log-entry-detail'),

    # Daily log endpoints
    path('daily/', views.DailyLogListCreateView.as_view(), name='daily-log-list-create'),
    path('daily/<int:pk>/', views.DailyLogDetailView.as_view(), name='daily-log-detail'),
    path('daily/<int:pk>/certify/', views.certify_daily_log, name='certify-daily-log'),

    # PDF download endpoints
    path('pdf/', views.download_daily_log_pdf, name='download-daily-log-pdf'),
    path('pdf/<str:log_date>/', views.download_daily_log_pdf, name='download-daily-log-pdf-date'),
]
