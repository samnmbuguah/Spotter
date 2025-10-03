from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes
from django.shortcuts import get_object_or_404
from datetime import date, timedelta
from django.http import HttpResponse
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.units import inch

from .models import Location, RouteStop, Trip, LogEntry, DailyLog, Violation
from .serializers import LocationSerializer, RouteStopSerializer, TripSerializer, TripListSerializer, DailyLogSerializer, DailyLogListSerializer,
    ViolationSerializer, LogEntryCreateSerializer


class LogEntryListCreateView(generics.ListCreateAPIView):
    """List log entries for the authenticated user or create new entries"""
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return LogEntryCreateSerializer
        return LogEntrySerializer

    def get_queryset(self):
        return LogEntry.objects.filter(driver=self.request.user)

    def perform_create(self, serializer):
        serializer.save(driver=self.request.user)


class LogEntryDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Retrieve, update or delete a log entry"""
    serializer_class = LogEntrySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return LogEntry.objects.filter(driver=self.request.user)


class DailyLogListCreateView(generics.ListCreateAPIView):
    """List daily logs for the authenticated user or create new daily logs"""
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return DailyLogSerializer
        return DailyLogListSerializer

    def get_queryset(self):
        return DailyLog.objects.filter(driver=self.request.user).select_related(
            'driver', 'certified_by'
        )

    def perform_create(self, serializer):
        serializer.save(driver=self.request.user)


class DailyLogDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Retrieve, update or delete a daily log"""
    serializer_class = DailyLogSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return DailyLog.objects.filter(driver=self.request.user)


class ViolationListView(generics.ListAPIView):
    """List violations for the authenticated user"""
    serializer_class = ViolationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Violation.objects.filter(driver=self.request.user)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def certify_daily_log(request, pk):
    """Certify a daily log"""
    daily_log = get_object_or_404(DailyLog, pk=pk, driver=request.user)

    if daily_log.is_certified:
        return Response(
            {'error': 'Log is already certified'},
            status=status.HTTP_400_BAD_REQUEST
        )

    daily_log.is_certified = True
    daily_log.certified_at = timezone.now()
    daily_log.certified_by = request.user
    daily_log.save()

    serializer = DailyLogSerializer(daily_log)
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def generate_daily_log(request, log_date=None):
    """Generate or update daily log from log entries"""
    if log_date:
        try:
            target_date = date.fromisoformat(log_date)
        except ValueError:
            return Response(
                {'error': 'Invalid date format. Use YYYY-MM-DD'},
                status=status.HTTP_400_BAD_REQUEST
            )
    else:
        target_date = date.today()

    # Get or create daily log
    daily_log, created = DailyLog.objects.get_or_create(
        driver=request.user,
        date=target_date,
        defaults={'driver': request.user, 'date': target_date}
    )

    # Calculate totals from log entries
    daily_log.calculate_totals()
    daily_log.save()

    serializer = DailyLogSerializer(daily_log)
    return Response({
        'message': 'Daily log generated successfully',
        'daily_log': serializer.data,
        'created': created
    })


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def current_hos_status(request):
    """Get current HOS status for the authenticated driver"""
    today = date.today()

    # Get today's log entries
    today_entries = LogEntry.objects.filter(driver=request.user, date=today).order_by('-start_time')

    # Calculate current status
    current_status = 'off_duty'  # Default
    total_driving_today = 0
    total_on_duty_today = 0
    current_start_time = None
    current_location = None

    for entry in today_entries:
        if entry.duty_status == 'driving':
            total_driving_today += float(entry.total_hours)
        elif entry.duty_status in ['driving', 'on_duty_not_driving']:
            total_on_duty_today += float(entry.total_hours)

        # Current status is from the most recent entry
        if current_start_time is None or entry.start_time > current_start_time:
            current_status = entry.duty_status
            current_start_time = entry.start_time
            current_location = entry.location

    # Get daily log for compliance check
    daily_log, _ = DailyLog.objects.get_or_create(
        driver=request.user,
        date=today,
        defaults={'driver': request.user, 'date': today}
    )

    return Response({
        'driver': request.user.name,
        'current_status': current_status,
        'start_time': current_start_time.strftime('%H:%M:%S') if current_start_time else None,
        'location': current_location,
        'driving_hours_today': total_driving_today,
        'on_duty_hours_today': total_on_duty_today,
        'is_compliant_today': daily_log.is_hos_compliant(),
        'remaining_driving_hours': max(0, 11 - total_driving_today),
        'remaining_on_duty_hours': max(0, 14 - total_on_duty_today),
    })


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def check_violations(request, days=7):
    """Check for HOS violations in the last N days"""
    end_date = date.today()
    start_date = end_date - timedelta(days=days)

    # Get daily logs for the period
    daily_logs = DailyLog.objects.filter(
        driver=request.user,
        date__range=[start_date, end_date]
    )

    violations = []
    for daily_log in daily_logs:
        if not daily_log.is_hos_compliant():
            # Create violation record
            violation = Violation.objects.create(
                driver=request.user,
                daily_log=daily_log,
                violation_type='driving_limit',
                description=f'HOS violation detected for {daily_log.date}',
                severity='major'
            )
            violations.append(ViolationSerializer(violation).data)

    return Response({
        'violations_found': len(violations),
        'violations': violations,
        'period_days': days
    })


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def resolve_violation(request, pk):
    """Resolve a violation"""
    violation = get_object_or_404(Violation, pk=pk, driver=request.user)

    if violation.is_resolved:
        return Response(
            {'error': 'Violation is already resolved'},
            status=status.HTTP_400_BAD_REQUEST
        )

    violation.is_resolved = True
    violation.resolved_at = timezone.now()
    violation.resolution_notes = request.data.get('notes', '')
    violation.save()

    serializer = ViolationSerializer(violation)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def download_daily_log_pdf(request, log_date=None):
    """Generate and download a PDF of the daily log"""
    if log_date:
        try:
            target_date = date.fromisoformat(log_date)
        except ValueError:
            return Response(
                {'error': 'Invalid date format. Use YYYY-MM-DD'},
                status=status.HTTP_400_BAD_REQUEST
            )
    else:
        target_date = date.today()

    # Get log entries for the date
    log_entries = LogEntry.objects.filter(
        driver=request.user,
        date=target_date
    ).order_by('start_time')

    # Get or create daily log summary
    daily_log, created = DailyLog.objects.get_or_create(
        driver=request.user,
        date=target_date,
        defaults={'driver': request.user, 'date': target_date}
    )

    # Calculate totals if not already done
    if not created:
        daily_log.calculate_totals()

    # Create PDF response
    response = HttpResponse(content_type='application/pdf')
    response['Content-Disposition'] = f'attachment; filename="hos_log_{target_date}.pdf"'

    # Create PDF document
    doc = SimpleDocTemplate(response, pagesize=letter)
    styles = getSampleStyleSheet()

    # Custom styles
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=18,
        spaceAfter=20,
        textColor=colors.darkblue
    )

    header_style = ParagraphStyle(
        'Header',
        parent=styles['Heading2'],
        fontSize=14,
        spaceAfter=10,
        textColor=colors.darkgreen
    )

    normal_style = styles['Normal']

    # PDF content
    content = []

    # Title
    content.append(Paragraph(f"HOS Daily Log - {target_date}", title_style))
    content.append(Spacer(1, 20))

    # Driver Information
    content.append(Paragraph("DRIVER INFORMATION", header_style))
    driver_info_data = [
        ['Driver Name:', request.user.name or request.user.username],
        ['Date:', target_date.strftime('%B %d, %Y')],
        ['Company:', getattr(request.user, 'company', 'N/A')],
        ['License Number:', getattr(request.user, 'license_number', 'N/A')],
    ]

    driver_table = Table(driver_info_data, colWidths=[2*inch, 4*inch])
    driver_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), colors.lightgrey),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('GRID', (0, 0), (-1, -1), 1, colors.black)
    ]))
    content.append(driver_table)
    content.append(Spacer(1, 20))

    # Daily Summary
    content.append(Paragraph("DAILY SUMMARY", header_style))
    summary_data = [
        ['Total Driving Hours:', f"{daily_log.total_driving_hours:.1f}"],
        ['Total On-Duty Hours:', f"{daily_log.total_on_duty_hours:.1f}"],
        ['Total Off-Duty Hours:', f"{daily_log.total_off_duty_hours:.1f}"],
        ['Total Sleeper Berth Hours:', f"{daily_log.total_sleeper_berth_hours:.1f}"],
        ['HOS Compliant:', 'YES' if daily_log.is_hos_compliant() else 'NO'],
    ]

    summary_table = Table(summary_data, colWidths=[2.5*inch, 3.5*inch])
    summary_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), colors.lightgrey),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('GRID', (0, 0), (-1, -1), 1, colors.black)
    ]))
    content.append(summary_table)
    content.append(Spacer(1, 20))

    # Log Entries
    if log_entries.exists():
        content.append(Paragraph("DETAILED LOG ENTRIES", header_style))

        # Table headers
        entry_headers = ['Time', 'Duty Status', 'Location', 'Vehicle', 'Trailer', 'Odometer', 'Hours', 'Notes']

        entry_data = [entry_headers]

        # Add each log entry
        for entry in log_entries:
            start_time_str = entry.start_time.strftime('%H:%M') if entry.start_time else ''
            end_time_str = entry.end_time.strftime('%H:%M') if entry.end_time else ''
            time_str = f"{start_time_str}-{end_time_str}" if end_time_str else start_time_str

            row = [
                time_str,
                entry.duty_status.replace('_', ' ').title(),
                entry.location or '',
                entry.vehicle_info or '',
                entry.trailer_info or '',
                f"{entry.odometer_start or ''}-{entry.odometer_end or ''}",
                f"{entry.total_hours:.1f}",
                entry.notes or ''
            ]
            entry_data.append(row)

        # Create table
        entry_table = Table(entry_data, colWidths=[0.8*inch, 1.2*inch, 1.5*inch, 1*inch, 1*inch, 1*inch, 0.7*inch, 1.8*inch])

        entry_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 12),
            ('FONTSIZE', (0, 1), (-1, -1), 9),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))

        content.append(entry_table)
    else:
        content.append(Paragraph("NO LOG ENTRIES FOUND FOR THIS DATE", header_style))
        content.append(Paragraph("No driving activity was recorded for this date.", normal_style))

    content.append(Spacer(1, 30))

    # Certification section
    content.append(Paragraph("CERTIFICATION", header_style))
    cert_text = """
    I hereby certify that the information contained herein is true and correct to the best of my knowledge.
    I understand that any falsification of this record may result in civil and/or criminal penalties.
    """
    content.append(Paragraph(cert_text.strip(), normal_style))

    content.append(Spacer(1, 40))

    # Signature lines
    sig_data = [
        ['Driver Signature: ______________________________', 'Date: _______________'],
        ['Motor Carrier Signature: ________________________', 'Date: _______________'],
    ]

    sig_table = Table(sig_data, colWidths=[3.5*inch, 2.5*inch])
    sig_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 20),
    ]))

    content.append(sig_table)

    # Build PDF
    doc.build(content)

    return response
