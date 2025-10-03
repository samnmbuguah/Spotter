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

    # Create PDF document - use legal size for traditional log format (8.5" x 14")
    from reportlab.lib.pagesizes import legal, landscape
    doc = SimpleDocTemplate(response, pagesize=landscape(legal))
    styles = getSampleStyleSheet()

    # Custom styles for traditional form
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=16,
        spaceAfter=15,
        textColor=colors.darkblue,
        alignment=1  # Center alignment
    )

    header_style = ParagraphStyle(
        'Header',
        parent=styles['Heading2'],
        fontSize=12,
        spaceAfter=8,
        textColor=colors.darkgreen
    )

    normal_style = styles['Normal']
    normal_style.fontSize = 9

    # PDF content
    content = []

    # Title
    content.append(Paragraph(f"DRIVER'S DAILY LOG - {target_date.strftime('%B %d, %Y')}", title_style))
    content.append(Spacer(1, 20))

    # Driver Information - Traditional format layout
    content.append(Paragraph("DRIVER INFORMATION", header_style))

    # Create a more compact driver info layout
    driver_info_data = [
        ['Date:', target_date.strftime('%m / %d / %Y'), 'Total Miles Driving Today:', '________'],
        ['Name of Carrier or Carriers:', request.user.name or request.user.username, 'Total Mileage Today:', '________'],
        ['Main Office Address:', getattr(request.user, 'company', 'N/A'), 'From:', '____________________'],
        ['Truck/Tractor and Trailer Numbers or License Plate(s)/State (show each unit):', '____________________', 'To:', '____________________'],
        ['Home Terminal Address:', '____________________', 'Co-Driver:', '____________________'],
    ]

    driver_table = Table(driver_info_data, colWidths=[2.2*inch, 2.3*inch, 1.8*inch, 1.7*inch])
    driver_table.setStyle(TableStyle([
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.black),
        ('FONTNAME', (0, 0), (0, 0), 'Helvetica-Bold'),
    ]))
    content.append(driver_table)
    content.append(Spacer(1, 15))

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
    """Create a visual 24-hour ELD grid in traditional paper log format"""
    from reportlab.platypus import Table, TableStyle, Spacer
    from reportlab.lib import colors
    from reportlab.lib.units import inch
    import django.utils.timezone as django_timezone

    content = []

    # Create the main 24-hour grid with proper time scale
    # Time scale: 24 hours with 15-minute increments (4 ticks per hour)

    # Header with time scale
    time_headers = ['Duty Status']
    for hour in range(24):
        # Add hour marker
        time_headers.append(str(hour))
        # Add 3 quarter-hour markers (15min, 30min, 45min)
        for quarter in range(3):
            time_headers.append('')

    # Create status rows (Off Duty, Sleeper Berth, Driving, On Duty)
    status_rows = []
    status_types = [
        ('Off Duty', 'off_duty', colors.lightgrey),
        ('Sleeper Berth', 'sleeper_berth', colors.lightblue),
        ('Driving', 'driving', colors.lightgreen),
        ('On Duty (not driving)', 'on_duty_not_driving', colors.lightyellow),
    ]

    for status_name, status_key, color in status_types:
        # Create row for this status with continuous line representation
        row = [status_name]

        # Create visual representation for each time period
        for hour in range(24):
            hour_start = django_timezone.datetime.combine(daily_log.date, django_timezone.datetime.min.time()) + django_timezone.timedelta(hours=hour)
            hour_end = hour_start + django_timezone.timedelta(hours=1)

            # Check if this status was active during this hour
            status_active = False
            active_entry = None

            for entry in log_entries:
                if entry.duty_status == status_key and entry.start_time:
                    entry_start = django_timezone.datetime.combine(daily_log.date, entry.start_time)

                    # Calculate entry end time
                    if entry.end_time:
                        entry_end = django_timezone.datetime.combine(daily_log.date, entry.end_time)
                    else:
                        entry_end = entry_start + django_timezone.timedelta(hours=float(entry.total_hours or 0))

                    # Check if entry overlaps with this hour
                    if (entry_start < hour_end) and (entry_end > hour_start):
                        status_active = True
                        active_entry = entry
                        break

            if status_active:
                # Create a visual line/bar for the active period
                # For traditional form, we'll use a solid line across the time period
                if active_entry and active_entry.start_time and active_entry.end_time:
                    # Calculate the duration within this hour
                    period_start = max(hour_start, django_timezone.datetime.combine(daily_log.date, active_entry.start_time))
                    period_end = min(hour_end, django_timezone.datetime.combine(daily_log.date, active_entry.end_time))

                    duration_minutes = (period_end - period_start).total_seconds() / 60

                    if duration_minutes >= 60:  # Full hour
                        row.extend(['━━━', '━━━', '━━━', '━━━'])  # Full hour with quarter divisions
                    elif duration_minutes >= 45:  # 45+ minutes
                        row.extend(['━━━', '━━━', '━━━', '━━━'])
                    elif duration_minutes >= 30:  # 30+ minutes
                        row.extend(['━━━', '━━━', '━━━', '───'])
                    elif duration_minutes >= 15:  # 15+ minutes
                        row.extend(['━━━', '━━━', '───', '───'])
                    else:  # Less than 15 minutes
                        row.extend(['━━━', '───', '───', '───'])
                else:
                    # Continuous status without specific end time
                    row.extend(['━━━', '━━━', '━━━', '━━━'])
            else:
                # No activity in this hour
                row.extend(['', '', '', ''])

        # Add total hours column
        total_hours = sum(float(entry.total_hours or 0) for entry in log_entries if entry.duty_status == status_key)
        row.append(f"{total_hours:.1f}h")

        status_rows.append(row)

    # Create the main grid table
    grid_data = [time_headers] + status_rows

    # Set column widths - much more compact for traditional form
    col_widths = [1.2*inch]  # Status column
    col_widths.extend([0.15*inch] * 96)  # 24 hours × 4 quarters = 96 columns
    col_widths.append(0.5*inch)  # Total hours column

    grid_table = Table(grid_data, colWidths=col_widths)
    grid_table.setStyle(TableStyle([
        # Header styling
        ('BACKGROUND', (0, 0), (-1, 0), colors.darkgray),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),

        # Body styling
        ('FONTSIZE', (0, 1), (-1, -1), 8),
        ('ALIGN', (0, 1), (0, -1), 'LEFT'),
        ('ALIGN', (-1, 1), (-1, -1), 'CENTER'),  # Total hours column

        # Grid lines
        ('GRID', (0, 0), (-1, -1), 0.5, colors.black),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),

        # Status row background colors (subtle)
        ('BACKGROUND', (1, 1), (-2, 1), colors.lightgrey),  # Off Duty row
        ('BACKGROUND', (1, 2), (-2, 2), colors.lightblue),  # Sleeper Berth row
        ('BACKGROUND', (1, 3), (-2, 3), colors.lightgreen),  # Driving row
        ('BACKGROUND', (1, 4), (-2, 4), colors.lightyellow),  # On Duty row
    ]))

    content.append(grid_table)

    # Add Remarks section
    content.append(Spacer(1, 15))
    remarks_data = [
        ['Remarks:', ''],
    ]
    remarks_table = Table(remarks_data, colWidths=[1*inch, 5*inch])
    remarks_table.setStyle(TableStyle([
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('ALIGN', (0, 0), (0, 0), 'LEFT'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
    ]))
    content.append(remarks_table)

    # Add Shipping Documents section
    content.append(Spacer(1, 10))
    shipping_data = [
        ['Shipping Documents:', '', 'B/L or Manifest No. or:', ''],
        ['Shipper & Commodity:', '', 'Location Entry:', ''],
    ]
    shipping_table = Table(shipping_data, colWidths=[1.5*inch, 2*inch, 1.5*inch, 2*inch])
    shipping_table.setStyle(TableStyle([
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.black),
    ]))
    content.append(shipping_table)

    # Add Recap section (70 Hour / 8 Day and 60 Hour / 7 Day)
    content.append(Spacer(1, 15))

    # Calculate recap values
    total_hours_today = sum(float(entry.total_hours or 0) for entry in log_entries)

    recap_data = [
        ['RECAP - Complete at end of day', '', '70 Hour / 8 Day Drivers', '', '60 Hour / 7 Day Drivers', ''],
        ['On duty hours today (lines 3 & 4):', f'{total_hours_today:.1f}h', 'A. Total hours on duty last 7 days including today:', '___', 'A. Total hours on duty last 6 days including today:', '___'],
        ['', '', 'B. Total hours available tomorrow (70 hr. minus A):', '___', 'B. Total hours available tomorrow (60 hr. minus A):', '___'],
        ['', '', 'C. Total hours on duty last 8 days including today:', '___', 'C. Total hours on duty last 7 days including today:', '___'],
    ]

    recap_table = Table(recap_data, colWidths=[2*inch, 0.8*inch, 2.5*inch, 0.8*inch, 2.5*inch, 0.8*inch])
    recap_table.setStyle(TableStyle([
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.black),
        ('BACKGROUND', (2, 0), (3, 0), colors.lightgrey),  # 70 Hour header
        ('BACKGROUND', (4, 0), (5, 0), colors.lightblue),   # 60 Hour header
    ]))

    content.append(recap_table)

    # Add the 34-hour reset note
    content.append(Spacer(1, 10))
    reset_data = [
        ['If you took 34 consecutive hours off duty you have 60/70 hours available: _____']
    ]
    reset_table = Table(reset_data, colWidths=[7*inch])
    reset_table.setStyle(TableStyle([
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
    ]))
    content.append(reset_table)

    return content
