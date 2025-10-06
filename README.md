# Spotter - HOS Compliance Management System

A comprehensive Hours of Service (HOS) compliance management system for truck drivers and fleet managers. Built with Django REST Framework backend and React TypeScript frontend.

## 🚀 Features

- **Trip Planning & Management**: Plan routes with multiple stops and waypoints
- **HOS Compliance Tracking**: Real-time monitoring of available driving hours
- **Location Management**: GPS-based location tracking and search
- **Interactive Maps**: Google Maps integration for route visualization
- **Real-time Updates**: Live status updates for drivers and managers
- **Mobile Responsive**: Works seamlessly on desktop and mobile devices

## 🏗️ Architecture

### Backend (Django REST Framework)
- **Models**: Location, RouteStop, Trip with HOS calculations
- **APIs**: RESTful endpoints for trip management and HOS status
- **Authentication**: JWT-based authentication with user management
- **Database**: PostgreSQL for production, SQLite for development
- **Caching**: Redis for performance optimization

### Frontend (React TypeScript)
- **State Management**: Zustand for global state
- **API Integration**: React Query for server state management
- **UI Components**: Radix UI with Tailwind CSS styling
- **Maps Integration**: Google Maps API for location services
- **Real-time Updates**: WebSocket connections for live data

## 📋 Prerequisites

- Docker and Docker Compose
- Node.js 18+ (for development)
- Python 3.10+ (for development)
- PostgreSQL (for production)
- Redis (for production)

## 🚀 Quick Start

### Using Docker (Recommended)

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/spotter.git
   cd spotter
   ```

2. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start the application**
   ```bash
   # Development
   docker-compose up

   # Production
   docker-compose -f docker-compose.prod.yml up -d
   ```

4. **Access the application**
   - Frontend: http://localhost:80
   - Backend API: http://localhost:8000/api

## 👤 Getting Started Guide

### 1. Access the Application

Open your browser and navigate to **http://localhost:80** (or your deployed domain).

### 2. Login with Test Credentials

**Test Driver Account:**
- **Email:** `testdriver@example.com`
- **Password:** `testpass123`

**Admin Account:**
- **Email:** `admin`
- **Password:** `admin`

### 3. Explore the Dashboard

After logging in, you'll see:
- **Current Trip Status** - View active trips and HOS compliance
- **Available Hours** - Check remaining driving time
- **Recent Activity** - See recent log entries and trips
- **Navigation Menu** - Access different sections of the app

### 4. Key Features to Try

#### Trip Management
1. **View Current Trip** - See your active trip details
2. **Start/Stop Trips** - Manage trip lifecycle
3. **View Trip History** - Browse completed trips

#### HOS Compliance
1. **Check Status** - View available driving hours
2. **Log Activities** - Record duty status changes
3. **View Logs** - See detailed activity history

#### Location Services
1. **Search Locations** - Find truck stops, fuel stations, etc.
2. **View on Map** - See locations on interactive map
3. **Get Directions** - Plan routes between locations

#### Reports & PDFs
1. **Generate Daily Logs** - Create official HOS reports
2. **View Route Maps** - See GPS-tracked routes
3. **Export Data** - Download trip and compliance reports

### 5. Mobile Usage

The app is fully responsive and works great on mobile devices:
- **Touch-friendly interface** for logging activities on the go
- **GPS integration** for automatic location tracking
- **Offline support** for areas with poor connectivity

### 6. Demo Data

The application includes sample data for testing:
- **Sample Locations** - Major truck stops and cities
- **Sample Trips** - Pre-configured routes
- **Sample Log Entries** - Example duty status records
- **GPS Coordinates** - Realistic location data for testing maps

### 7. Troubleshooting

#### Common Issues

**Google Maps not loading:**
- Ensure `GOOGLE_MAPS_API_KEY` is set in environment variables
- Check browser console for API errors

**PDF generation fails:**
- Verify all required Python packages are installed
- Check file permissions for PDF output directory

**Login issues:**
- Clear browser cookies and cache
- Ensure backend server is running on port 8000

#### Getting Help

- Check browser developer console for errors
- Review backend logs in Docker containers
- Ensure all environment variables are properly configured

## 🔑 Test Accounts & Sample Data

### Driver Accounts
- **Email:** `testdriver@example.com`
- **Password:** `testpass123`
- **Role:** Truck driver with sample trips and logs

### Admin Accounts
- **Username:** `admin`
- **Password:** `admin`
- **Role:** System administrator

### Sample Locations Included
- New York, NY
- Chicago, IL
- Los Angeles, CA
- Dallas, TX
- Major truck stops and rest areas

### Sample Trip Data
- Multi-city delivery routes
- Various trip distances and durations
- Realistic HOS scenarios for testing

## 📱 Using the Mobile App

### Key Mobile Features
- **One-touch duty status logging**
- **GPS location tracking**
- **Offline log entry support**
- **Push notifications for HOS alerts**

### Mobile Navigation
- **Dashboard** - Overview of current status
- **Trips** - Active and completed trips
- **Logs** - Duty status history
- **Locations** - Find nearby facilities
- **Reports** - Generate compliance reports

### Local Development Setup

#### Backend Setup

1. **Create virtual environment**
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\\Scripts\\activate
   ```

2. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

3. **Run migrations**
   ```bash
   python manage.py migrate
   ```

4. **Create superuser**
   ```bash
   python manage.py createsuperuser
   ```

5. **Start development server**
   ```bash
   python manage.py runserver
   ```

#### Frontend Setup

1. **Install dependencies**
   ```bash
   cd frontend
   npm install
   ```

2. **Start development server**
   ```bash
   npm start
   ```

## 🧪 Testing

### Backend Tests

```bash
cd backend
pytest  # Run all tests
pytest --cov=.  # Run with coverage
```

### Frontend Tests

```bash
cd frontend
npm test
npm run test:coverage
```

### CI/CD Pipeline

The project includes a comprehensive GitHub Actions workflow that:

- Runs backend tests with PostgreSQL
- Runs frontend tests with coverage
- Builds Docker images for both services
- Deploys to production on main branch pushes

## 🔧 Configuration

### Environment Variables

#### Production Environment (`.env.production`)
```env
# Database
POSTGRES_DB=spotter_production
POSTGRES_USER=spotter_user
POSTGRES_PASSWORD=your_secure_password

# Django
DJANGO_SECRET_KEY=your_django_secret_key
DJANGO_ALLOWED_HOSTS=yourdomain.com
DJANGO_DEBUG=0

# Redis
REDIS_URL=redis://redis:6379/0

# Frontend
REACT_APP_API_URL=https://yourdomain.com/api
REACT_APP_GOOGLE_MAPS_API_KEY=your_api_key
```

#### Development Environment
```env
# Database
DATABASE_URL=postgresql://spotter:spotter123@localhost:5432/spotter

# Django
SECRET_KEY=dev-secret-key
DEBUG=1

# Frontend
REACT_APP_API_URL=http://localhost:8000/api
```

## 📡 API Documentation

### Authentication Endpoints

#### Register User
```http
POST /api/auth/register/
Content-Type: application/json

{
  "username": "driver1",
  "email": "driver@example.com",
  "password": "password123",
  "name": "John Driver"
}
```

#### Login
```http
POST /api/auth/login/
Content-Type: application/json

{
  "username": "driver1",
  "password": "password123"
}
```

### Trip Management

#### Create Trip
```http
POST /api/trips/
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Route to NYC",
  "current_location": 1,
  "pickup_location": 2,
  "dropoff_location": 3,
  "total_distance": 150.5
}
```

#### Get User's Trips
```http
GET /api/trips/
Authorization: Bearer {token}
```

#### Start Trip
```http
POST /api/trips/{id}/start/
Authorization: Bearer {token}
```

#### Complete Trip
```http
POST /api/trips/{id}/complete/
Authorization: Bearer {token}
```

#### Check HOS Compliance
```http
GET /api/trips/{id}/compliance/
Authorization: Bearer {token}
```

#### Get Driver HOS Status
```http
GET /api/driver/hos-status/
Authorization: Bearer {token}
```

### Location Management

#### Create Location
```http
POST /api/locations/
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Truck Stop ABC",
  "address": "123 Highway Rd",
  "city": "Springfield",
  "state": "IL",
  "zip_code": "62701",
  "latitude": 39.7817,
  "longitude": -89.6501
}
```

## 🗃️ Database Schema

### Location Model
- `name`: Location name
- `address`: Street address
- `city`: City name
- `state`: State abbreviation
- `zip_code`: ZIP code (optional)
- `latitude`: Latitude coordinate (optional)
- `longitude`: Longitude coordinate (optional)

### RouteStop Model
- `name`: Stop name
- `location`: Foreign key to Location
- `stop_type`: Type of stop (rest, fuel, pickup, dropoff)
- `estimated_duration`: Duration in minutes
- `order`: Order in route sequence

### Trip Model
- `driver`: Foreign key to User
- `name`: Trip name
- `current_location`: Current location
- `pickup_location`: Pickup location
- `dropoff_location`: Drop-off location
- `current_cycle`: HOS cycle (70_8 or 60_7)
- `status`: Trip status (planning, active, completed, cancelled)
- `total_distance`: Distance in miles
- `available_hours`: Available driving hours
- `used_hours`: Used driving hours
- `start_time`: Trip start timestamp
- `end_time`: Trip end timestamp

## 🚢 Deployment

### Production Deployment

1. **Environment Setup**
   - Configure production environment variables
   - Set up PostgreSQL database
   - Configure Redis for caching

2. **Build and Deploy**
   ```bash
   # Build production images
   docker-compose -f docker-compose.prod.yml build

   # Deploy with Docker Compose
   docker-compose -f docker-compose.prod.yml up -d
   ```

3. **Domain Configuration**
   - Set up reverse proxy (nginx recommended)
   - Configure SSL certificates
   - Update DNS settings

### Docker Configuration

#### Backend Dockerfile Optimizations
- Multi-stage build for smaller images
- Non-root user for security
- Proper dependency caching
- Static file collection

#### Frontend Dockerfile Optimizations
- Multi-stage build separating build and runtime
- Nginx for production serving
- Optimized layer caching

## 🔒 Security Features

- JWT authentication with secure token management
- Password hashing with Django's security framework
- CORS configuration for cross-origin requests
- Input validation and sanitization
- SQL injection protection via Django ORM
- XSS protection through React's escaping

## 📊 Monitoring and Logging

- Structured logging with Django's logging framework
- Error tracking and reporting
- Performance monitoring
- Database query optimization

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow PEP 8 for Python code
- Use TypeScript for frontend development
- Write tests for new features
- Update documentation for API changes
- Use conventional commits

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙋‍♂️ Support

For support, email support@yourdomain.com or join our Slack community.

## 🔄 Changelog

See [CHANGELOG.md](CHANGELOG.md) for a list of changes and version history.
