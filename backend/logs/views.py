from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes
from django.shortcuts import get_object_or_404
from datetime import date, timedelta
from django.utils import timezone as django_timezone
from django.http import HttpResponse
from reportlab.lib.pagesizes import letter, landscape
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.units import inch

from .models import LogEntry, DailyLog, Violation
from .serializers import LogEntrySerializer, DailyLogSerializer, DailyLogListSerializer, ViolationSerializer, LogEntryCreateSerializer


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
    daily_log.certified_at = django_timezone.now()
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
    violation.resolved_at = django_timezone.now()
    violation.resolution_notes = request.data.get('notes', '')
    violation.save()

    serializer = ViolationSerializer(violation)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def get_current_trip(request):
    """Get current trip for the authenticated driver"""
    today = date.today()

    # Get today's most recent driving log entry
    current_trip_entry = LogEntry.objects.filter(
        driver=request.user,
        date=today,
        duty_status='driving'
    ).order_by('-start_time').first()

    if current_trip_entry:
        return Response({
            'id': current_trip_entry.id,
            'name': f"Trip - {current_trip_entry.location or 'Driving'}",
            'status': 'active',
            'start_time': current_trip_entry.start_time.strftime('%H:%M:%S') if current_trip_entry.start_time else None,
            'location': current_trip_entry.location,
            'vehicle_info': current_trip_entry.vehicle_info,
            'odometer_start': current_trip_entry.odometer_start,
            'total_hours': current_trip_entry.total_hours,
        })

    return Response(None)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def update_duty_status_time(request):
    """Update the start time of the current duty status"""
    status = request.data.get('status')
    new_time = request.data.get('time')

    if not status or not new_time:
        return Response(
            {'error': 'Status and time are required'},
            status=status.HTTP_400_BAD_REQUEST
        )

    today = date.today()

    # Find the most recent log entry with the given status
    log_entry = LogEntry.objects.filter(
        driver=request.user,
        date=today,
        duty_status=status
    ).order_by('-start_time').first()

    if not log_entry:
        return Response(
            {'error': f'No {status} entry found for today'},
            status=status.HTTP_404_NOT_FOUND
        )

    # Update the start time
    try:
        from datetime import datetime
        time_obj = datetime.strptime(new_time, '%H:%M:%S').time()
        log_entry.start_time = time_obj
        log_entry.save()

        return Response({
            'message': 'Duty status time updated successfully',
            'entry': LogEntrySerializer(log_entry).data
        })
    except ValueError:
        return Response(
            {'error': 'Invalid time format. Use HH:MM:SS'},
            status=status.HTTP_400_BAD_REQUEST
        )


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

    # Create PDF document - landscape for better grid layout
    from reportlab.lib.pagesizes import letter, landscape
    doc = SimpleDocTemplate(response, pagesize=landscape(letter))
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
    content.append(Paragraph(f"DRIVER'S DAILY LOG - {target_date.strftime('%B %d, %Y')}", title_style))
    content.append(Spacer(1, 20))

    # Driver Information
    content.append(Paragraph("DRIVER INFORMATION", header_style))
    driver_info_data = [
        ['Driver Name:', request.user.name or request.user.username],
        ['Date:', target_date.strftime('%B %d, %Y')],
        ['Company:', getattr(request.user, 'company', 'N/A')],
        ['License Number:', getattr(request.user, 'license_number', 'N/A')],
        ['Co-Driver:', ''],
        ['Vehicle Number:', ''],
        ['Trailer Number:', ''],
        ['Shipping Document:', ''],
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

    # Create the visual 24-hour grid
    if log_entries.exists():
        content.append(Paragraph("DAILY LOG GRID", header_style))
        content.append(Spacer(1, 10))

        # Create the visual grid
        grid_content = create_eld_grid(log_entries, daily_log)
        content.extend(grid_content)
    else:
        content.append(Paragraph("NO LOG ENTRIES FOUND FOR THIS DATE", header_style))
        content.append(Paragraph("No driving activity was recorded for this date.", normal_style))

    content.append(Spacer(1, 30))

    # Daily Summary Table
    content.append(Paragraph("DAILY SUMMARY", header_style))
    summary_data = [
        ['Total Driving Hours:', f"{daily_log.total_driving_hours:.1f}h"],
        ['Total On-Duty Hours:', f"{daily_log.total_on_duty_hours:.1f}h"],
        ['Total Off-Duty Hours:', f"{daily_log.total_off_duty_hours:.1f}h"],
        ['Total Sleeper Berth Hours:', f"{daily_log.total_sleeper_berth_hours:.1f}h"],
        ['HOS Compliant:', 'YES ✓' if daily_log.is_hos_compliant() else 'NO ✗'],
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


def create_eld_grid(log_entries, daily_log):
    """Create a visual 24-hour ELD grid"""
    from reportlab.platypus import Table, TableStyle
    from reportlab.lib import colors

    content = []

    # Create 24-hour header
    hours = []
    for hour in range(24):
        hours.append(f"{hour:02d}:00")

    # Create grid data (25 rows for 24 hours + header, 25 columns for hours + status column)
    grid_data = [['Time'] + hours]

    # Color mapping for duty statuses
    status_colors = {
        'off_duty': colors.lightgrey,
        'sleeper_berth': colors.lightblue,
        'driving': colors.lightgreen,
        'on_duty_not_driving': colors.lightyellow,
    }

    # Create a row for each status type to show visual bars
    status_types = ['off_duty', 'sleeper_berth', 'driving', 'on_duty_not_driving']

    for status in status_types:
        row = [status.replace('_', ' ').title()]

        # Create visual bar for each hour
        for hour in range(24):
            # Check if this status was active during this hour
            hour_start = django_timezone.datetime.combine(daily_log.date, django_timezone.datetime.min.time()) + django_timezone.timedelta(hours=hour)
            hour_end = hour_start + django_timezone.timedelta(hours=1)

            # Find if any log entry overlaps with this hour
            status_active = False
            for entry in log_entries:
                if entry.duty_status == status and entry.start_time:
                    entry_start = django_timezone.datetime.combine(daily_log.date, entry.start_time)

                    # Calculate entry end time
                    if entry.end_time:
                        entry_end = django_timezone.datetime.combine(daily_log.date, entry.end_time)
                    else:
                        # If no end time, assume it runs to the end of the calculated duration
                        entry_end = entry_start + django_timezone.timedelta(hours=float(entry.total_hours or 0))

                    # Check if entry overlaps with this hour (partial overlap counts)
                    if (entry_start < hour_end) and (entry_end > hour_start):
                        status_active = True
                        break

            if status_active:
                # Create a colored rectangle using Unicode block character
                row.append('█')  # Solid block character
            else:
                row.append('')

        grid_data.append(row)

    # Create the visual grid table
    grid_table = Table(grid_data, colWidths=[1.0*inch] + [0.42*inch]*24)

    grid_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.darkgray),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 12),
        ('FONTSIZE', (0, 1), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 1, colors.black),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        # Color the status rows
        ('BACKGROUND', (1, 1), (-1, 1), status_colors['off_duty']),
        ('BACKGROUND', (1, 2), (-1, 2), status_colors['sleeper_berth']),
        ('BACKGROUND', (1, 3), (-1, 3), status_colors['driving']),
        ('BACKGROUND', (1, 4), (-1, 4), status_colors['on_duty_not_driving']),
    ]))

    content.append(grid_table)

    # Add legend
    content.append(Spacer(1, 20))
    legend_data = [
        ['█ Off Duty (Gray)', '█ Sleeper Berth (Blue)', '█ Driving (Green)', '█ On Duty (Yellow)'],
    ]

    legend_table = Table(legend_data, colWidths=[2.5*inch, 2.5*inch, 2*inch, 2*inch])
    legend_table.setStyle(TableStyle([
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
    ]))

    content.append(legend_table)

    return content
