// Test script to check Google Maps API key
const API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

console.log('🔍 Checking Google Maps API Key...');
console.log('API Key configured:', !!API_KEY);

if (API_KEY && API_KEY !== 'YOUR_GOOGLE_MAPS_API_KEY_HERE') {
  console.log('✅ Google Maps API Key is configured');
  console.log('🔧 Testing API connectivity...');

  // Test Google Maps API
  fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=1600+Amphitheatre+Parkway,+Mountain+View,+CA&key=${API_KEY}`)
    .then(response => response.json())
    .then(data => {
      if (data.status === 'OK') {
        console.log('✅ Google Maps API is working correctly');
        console.log('📍 Geocoding test successful');
      } else {
        console.log('❌ Google Maps API error:', data.error_message);
      }
    })
    .catch(error => {
      console.log('❌ Network error:', error.message);
    });
} else {
  console.log('❌ Google Maps API Key not configured or using placeholder');
}
