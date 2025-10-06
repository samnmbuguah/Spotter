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

    # Calculate total mileage for the day
    total_mileage = 0
    driving_locations = []
    for entry in log_entries:
        if entry.duty_status == 'driving' and entry.odometer_start and entry.odometer_end:
            total_mileage += entry.odometer_end - entry.odometer_start
        if entry.duty_status == 'driving' and entry.location:
            if entry.location not in driving_locations:
                driving_locations.append(entry.location)

    # Create a more compact driver info layout
    driver_info_data = [
        ['Date:', target_date.strftime('%m / %d / %Y'), 'Total Miles Driving Today:', f"{total_mileage:.1f}"],
        ['Name of Carrier or Carriers:', request.user.name or 'Truck Driver Company', 'Total Mileage Today:', f"{total_mileage:.1f}"],
        ['Main Office Address:', '123 Main St, City, State', 'From:', driving_locations[0] if driving_locations else 'Starting Point'],
        ['Vehicle/Trailer Info:', 'Truck ABC-123 / Trailer XYZ-789', 'To:', driving_locations[-1] if driving_locations else 'Destination'],
        ['Home Terminal Address:', '456 Terminal Ave, City, State', 'Co-Driver:', 'None'],
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

    # Add Google Maps Route Visualization
    content.append(Spacer(1, 15))
    content.append(Paragraph("ROUTE MAP", header_style))

    # Create a simple route map using coordinates
    map_content = create_route_map(log_entries)
    content.extend(map_content)

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
    from reportlab.platypus import Table, TableStyle, Spacer, Paragraph
    from reportlab.lib import colors
    from reportlab.lib.units import inch
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    import django.utils.timezone as django_timezone

    # Get styles
    styles = getSampleStyleSheet()
    header_style = ParagraphStyle(
        'Header',
        parent=styles['Heading2'],
        fontSize=12,
        spaceAfter=8,
        textColor=colors.darkgreen
    )
    normal_style = styles['Normal']
    normal_style.fontSize = 9

    content = []

    # Create a simplified 24-hour grid showing duty status periods
    # Use a more manageable 1-hour increment grid (24 columns instead of 96)

    # Header with time scale (every hour)
    time_headers = ['Duty Status']
    for hour in range(24):
        time_headers.append(f'{hour:02d}:00')

    # Create status rows
    status_rows = []
    status_types = [
        ('Off Duty', 'off_duty', colors.lightgrey),
        ('Sleeper Berth', 'sleeper_berth', colors.lightblue),
        ('Driving', 'driving', colors.lightgreen),
        ('On Duty (not driving)', 'on_duty_not_driving', colors.lightyellow),
    ]

    for status_name, status_key, color in status_types:
        row = [status_name]

        # Create visual representation for each hour
        for hour in range(24):
            hour_start = django_timezone.datetime.combine(daily_log.date, django_timezone.datetime.min.time()) + django_timezone.timedelta(hours=hour)
            hour_end = hour_start + django_timezone.timedelta(hours=1)

            # Check if this status was active during this hour
            status_active = False

            for entry in log_entries:
                if entry.duty_status == status_key and entry.start_time:
                    entry_start = django_timezone.datetime.combine(daily_log.date, entry.start_time)

                    # Calculate entry end time
                    if entry.end_time:
                        entry_end = django_timezone.datetime.combine(daily_log.date, entry.end_time)
                    else:
                        # For ongoing entries, assume they continue to end of day or calculate based on total_hours
                        if entry.total_hours:
                            entry_end = entry_start + django_timezone.timedelta(hours=float(entry.total_hours or 0))
                        else:
                            entry_end = entry_start + django_timezone.timedelta(hours=1)  # Default 1 hour

                    # Check if entry overlaps with this hour
                    if (entry_start < hour_end) and (entry_end > hour_start):
                        status_active = True
                        break

            if status_active:
                row.append('█████')  # Full block for active hour
            else:
                row.append('')

        # Add total hours column
        total_hours = sum(float(entry.total_hours or 0) for entry in log_entries if entry.duty_status == status_key)
        row.append(f"{total_hours:.1f}h")

        status_rows.append(row)

    # Create the main grid table
    grid_data = [time_headers] + status_rows

    # Set column widths - uniform width for all hour columns
    col_widths = [1.5*inch]  # Status column

    # Create uniform widths for the 24 hour columns (0.5 inches each)
    hour_width = 0.5*inch
    for i in range(24):
        col_widths.append(hour_width)

    col_widths.append(0.6*inch)  # Total hours column

    grid_table = Table(grid_data, colWidths=col_widths)
    grid_table.setStyle(TableStyle([
        # Header styling
        ('BACKGROUND', (0, 0), (-1, 0), colors.darkgray),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),

        # Body styling
        ('FONTSIZE', (0, 1), (-1, -1), 7),
        ('ALIGN', (0, 1), (0, -1), 'LEFT'),
        ('ALIGN', (-1, 1), (-1, -1), 'CENTER'),  # Total hours column
        ('ALIGN', (1, 1), (-2, -1), 'CENTER'),   # Hour columns

        # Grid lines
        ('GRID', (0, 0), (-1, -1), 0.5, colors.black),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),

        # Status row background colors
        ('BACKGROUND', (1, 1), (-2, 1), colors.lightgrey),  # Off Duty row
        ('BACKGROUND', (1, 2), (-2, 2), colors.lightblue),  # Sleeper Berth row
        ('BACKGROUND', (1, 3), (-2, 3), colors.lightgreen),  # Driving row
        ('BACKGROUND', (1, 4), (-2, 4), colors.lightyellow),  # On Duty row
    ]))

    content.append(grid_table)

    # Add Odometer and Location Summary section
    content.append(Paragraph("ODOMETER AND LOCATION SUMMARY", header_style))

    # Calculate odometer readings for the day
    starting_odometer = None
    ending_odometer = None

    # Find first and last odometer readings from driving entries
    driving_entries_with_odometer = [entry for entry in log_entries if entry.duty_status == 'driving' and entry.odometer_start and entry.odometer_end]

    if driving_entries_with_odometer:
        # Sort by start time to get chronological order
        sorted_entries = sorted(driving_entries_with_odometer, key=lambda x: x.start_time)
        starting_odometer = sorted_entries[0].odometer_start
        ending_odometer = sorted_entries[-1].odometer_end

    odometer_data = [
        ['Starting Odometer:', f"{starting_odometer:.1f}" if starting_odometer else '________', 'Ending Odometer:', f"{ending_odometer:.1f}" if ending_odometer else '________'],
        ['Total Miles Driven Today:', f"{ending_odometer - starting_odometer:.1f}" if starting_odometer and ending_odometer else '________', 'Vehicle ID:', 'Truck ABC-123'],
        ['Trailer ID:', 'Trailer XYZ-789', 'Route Summary:', 'Multi-city route'],
    ]

    odometer_table = Table(odometer_data, colWidths=[1.5*inch, 1.5*inch, 1.5*inch, 1.5*inch])
    odometer_table.setStyle(TableStyle([
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.black),
        ('FONTNAME', (0, 0), (0, 0), 'Helvetica-Bold'),
    ]))
    content.append(odometer_table)

    # Add location summary
    location_summary = "LOCATIONS VISITED:\n"
    unique_locations = []
    for entry in log_entries:
        if entry.location and entry.location not in unique_locations:
            unique_locations.append(entry.location)

    for location in unique_locations:
        location_summary += f"• {location}\n"

    content.append(Paragraph(location_summary, normal_style))

    # Add Shipping Documents section
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

def create_route_map(log_entries):
    """Create a visual route map showing the path taken using Google Maps"""
    from reportlab.platypus import Table, TableStyle, Spacer, Image
    from reportlab.lib import colors
    from reportlab.lib.units import inch
    from reportlab.lib.styles import getSampleStyleSheet
    import math
    import os
    import requests
    from io import BytesIO

    # Get styles
    styles = getSampleStyleSheet()
    normal_style = styles['Normal']
    normal_style.fontSize = 9

    content = []

    # Get all entries with coordinates (not just driving entries)
    entries_with_coordinates = [entry for entry in log_entries if entry.latitude and entry.longitude]

    if len(entries_with_coordinates) < 2:
        content.append(Paragraph("ROUTE MAP: Insufficient GPS data for route visualization", normal_style))
        return content

    try:
        # Get Google Maps API key from environment
        google_maps_key = os.getenv('GOOGLE_MAPS_API_KEY', '')

        if not google_maps_key:
            # Fallback to text-based map if no API key
            content.append(Paragraph("ROUTE MAP: Google Maps API key not configured", normal_style))
            return create_text_route_map(entries_with_coordinates, normal_style)

        # Create Google Maps Static API URL for route visualization
        # Use path parameter to show the route between points
        markers = []
        path_points = []

        for i, entry in enumerate(entries_with_coordinates):
            lat = float(entry.latitude)
            lng = float(entry.longitude)
            # Add marker for each stop
            markers.append(f"markers=color:red%7Clabel:{i+1}%7C{lat},{lng}")
            # Add point to path
            path_points.append(f"{lat},{lng}")

        # Join path points with pipe (|) for the path parameter
        path_str = '|'.join(path_points)

        # Build the Google Maps Static API URL
        base_url = "https://maps.googleapis.com/maps/api/staticmap"
        markers_str = '&'.join(markers)
        path_param = f"path=color:0x0000ff|weight:5|{path_str}"

        map_url = f"{base_url}?size=600x400&{markers_str}&{path_param}&key={google_maps_key}"

        # Fetch the map image
        response = requests.get(map_url)
        if response.status_code == 200:
            # Create an Image element from the response content
            map_image = Image(BytesIO(response.content))
            map_image._width = 6 * inch  # Set width to 6 inches
            map_image._height = 4 * inch  # Set height to 4 inches
            content.append(map_image)

            # Add location details below the map
            content.append(Spacer(1, 10))

            # Create location details table
            location_details = []
            for i, entry in enumerate(entries_with_coordinates):
                location_details.append([
                    f"Point {i+1}",
                    entry.location,
                    f"{float(entry.latitude):.4f}, {float(entry.longitude):.4f}"
                ])

            location_table = Table(location_details, colWidths=[1*inch, 3*inch, 2*inch])
            location_table.setStyle(TableStyle([
                ('FONTSIZE', (0, 0), (-1, -1), 8),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.black),
                ('BACKGROUND', (0, 0), (-1, 0), colors.darkgray),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ]))

            content.append(location_table)
        else:
            # Fallback to text-based map if API call fails
            content.append(Paragraph("ROUTE MAP: Failed to load Google Maps", normal_style))
            return create_text_route_map(entries_with_coordinates, normal_style)

    except Exception as e:
        # Fallback to text-based map if any error occurs
        content.append(Paragraph(f"ROUTE MAP: Error loading map ({str(e)})", normal_style))
        return create_text_route_map(entries_with_coordinates, normal_style)

    return content


def create_text_route_map(entries_with_coordinates, normal_style):
    """Fallback text-based route visualization"""
    from reportlab.platypus import Table, TableStyle, Spacer
    from reportlab.lib import colors
    from reportlab.lib.units import inch
    import math

    content = []

    # Create route map data
    map_data = []

    # Header row with location names
    header_row = ['Route Segment']
    for i, entry in enumerate(entries_with_coordinates):
        header_row.append(f"Point {i+1}")
    map_data.append(header_row)

    # Location row
    location_row = ['Locations']
    for entry in entries_with_coordinates:
        location_row.append(entry.location[:15] + '...' if len(entry.location) > 15 else entry.location)
    map_data.append(location_row)

    # Coordinates row
    coord_row = ['Coordinates']
    for entry in entries_with_coordinates:
        if entry.latitude is not None and entry.longitude is not None:
            coord_row.append(f"{float(entry.latitude):.3f}, {float(entry.longitude):.3f}")
        else:
            coord_row.append("No GPS data")
    map_data.append(coord_row)

    # Distance row (simplified calculation)
    distance_row = ['Distance (mi)']
    total_distance = 0
    for i in range(len(entries_with_coordinates) - 1):
        current = entries_with_coordinates[i]
        next_entry = entries_with_coordinates[i + 1]

        # Check if both entries have valid coordinates
        if (current.latitude and current.longitude and
            next_entry.latitude and next_entry.longitude):
            # Simple distance calculation (Haversine formula approximation)
            # Convert decimal to float for calculations
            current_lat = float(current.latitude)
            current_lng = float(current.longitude)
            next_lat = float(next_entry.latitude)
            next_lng = float(next_entry.longitude)

            distance = math.sqrt(
                (next_lat - current_lat) ** 2 +
                (next_lng - current_lng) ** 2
            ) * 69  # Rough miles conversion

            distance_row.append(f"{distance:.1f}")
            total_distance += distance
        else:
            distance_row.append("N/A")
            total_distance += 0  # Can't calculate distance without coordinates

    distance_row.append(f"Total: {total_distance:.1f}")
    map_data.append(distance_row)

    # Create the route map table
    col_widths = [1.5*inch] + [1.2*inch] * len(entries_with_coordinates)
    route_table = Table(map_data, colWidths=col_widths)

    route_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.darkblue),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),

        ('FONTSIZE', (0, 1), (-1, -1), 8),
        ('ALIGN', (0, 1), (0, -1), 'LEFT'),
        ('ALIGN', (1, 1), (-1, -1), 'CENTER'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.black),
        ('BACKGROUND', (0, 1), (0, -1), colors.lightgrey),
    ]))

    content.append(route_table)

    # Add a simple route diagram
    content.append(Spacer(1, 10))

    # Create ASCII-style route diagram
    route_diagram = "ROUTE DIAGRAM:\n\n"
    for i, entry in enumerate(entries_with_coordinates):
        location_name = entry.location or "Unknown Location"
        if i == 0:
            route_diagram += f"START: {location_name}\n"
            route_diagram += "       |\n"
        else:
            prev_entry = entries_with_coordinates[i-1]
            prev_location = prev_entry.location or "Unknown Location"
            route_diagram += f"       ↓ ({prev_location[:10]}... → {location_name[:10]}...)\n"
        route_diagram += f"POINT {i+1}: {location_name}\n"
        if i < len(entries_with_coordinates) - 1:
            route_diagram += "       |\n"
        else:
            route_diagram += "       END\n"

    content.append(Paragraph(route_diagram, normal_style))

    return content
