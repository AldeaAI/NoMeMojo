# Weather Location App 🌧️

A web application that gets your current location, displays it on a map, and shows detailed weather information including rain forecasts and probability using the free Open-Meteo API.

## Features

- 📍 **Get User Location**: Uses browser's geolocation API to get your coordinates
- 🗺️ **Interactive Map**: Shows your position on a Leaflet map with OpenStreetMap tiles
- �️ **Live Rain Visualization**: Real-time rain clouds and precipitation overlay on the map
- ☁️ **Cloud Cover Display**: Shows current cloud formations with transparency controls
- 🌦️ **Weather Data**: Displays current weather conditions including temperature, humidity, and wind
- ☔ **Rain Forecast**: Shows rain probability and volume for current and upcoming periods
- 📅 **5-Day Forecast**: Provides detailed weather outlook for the next 5 days
- 🔄 **Real-time Updates**: Refresh button to update weather layers with latest data
- 📱 **Responsive Design**: Works on desktop, tablet, and mobile devices
- 🆓 **No API Key Required**: Uses the free Open-Meteo API with no registration needed

## Setup Instructions

### Quick Start - No API Key Needed! 🎉

This app now uses the Open-Meteo API which is completely free and requires no registration or API key!

### Run the App

#### Option 1: Simple HTTP Server (Recommended)
```bash
# Navigate to the project directory
cd /home/sebastian/Documents/NoMeMojo

# Python 3
python3 -m http.server 8000

# Node.js (if you have it installed)
npx serve .

# PHP (if you have it installed)
php -S localhost:8000
```

Then open your browser and go to `http://localhost:8000`

#### Option 2: Live Server Extension
If you're using VS Code, install the "Live Server" extension and right-click on `index.html` → "Open with Live Server"

### Enable Location Access

When you click "Get My Location", your browser will ask for permission to access your location. Make sure to allow it for the app to work properly.

## How It Works

1. **Location Detection**: Uses the browser's `navigator.geolocation` API
2. **Map Display**: Integrates Leaflet.js for interactive maps
3. **Weather API**: Fetches data from Open-Meteo API (free, no API key required!)
4. **Rain Calculation**: Processes forecast data to calculate rain probability
5. **Responsive UI**: Modern CSS with gradients and animations

## File Structure

```
NoMeMojo/
├── index.html          # Main HTML structure
├── styles.css          # CSS styling and animations
├── script.js           # JavaScript functionality
└── README.md           # This file
```

## API Endpoints Used

- **Weather Forecast**: `https://api.open-meteo.com/v1/forecast`
- **Reverse Geocoding**: `https://geocoding-api.open-meteo.com/v1/reverse`

## Browser Compatibility

- Chrome 50+
- Firefox 55+
- Safari 10+
- Edge 79+

**Note**: Geolocation requires HTTPS in production environments.

## Troubleshooting

### Common Issues

1. **Location not working**
   - Check if location services are enabled in your browser
   - Make sure you're serving the app over HTTP/HTTPS (not opening as a file)
   - Try refreshing and allowing location access again

2. **Map not loading**
   - Check your internet connection
   - Verify the Leaflet CSS and JS are loading properly

3. **Weather data not loading**
   - Check your internet connection
   - Look at the browser console for error messages
   - The Open-Meteo API is free and has generous rate limits

## Features Overview

### Current Weather Display
- Temperature in Celsius
- Weather condition description
- Humidity percentage
- Wind speed in km/h
- Cloud coverage

### Rain Information
- Probability percentage for next few hours
- Rain volume for 1 hour and 3 hours
- Cloud coverage analysis

### 5-Day Forecast
- Daily rain probability
- Expected rain volume
- Temperature and conditions
- Day-by-day breakdown

## Customization

You can easily customize the app by modifying:

- **Colors**: Update the CSS gradient colors in `styles.css`
- **Map Style**: Change the tile layer URL in `script.js` for different map styles
- **Units**: Modify the API calls to use imperial units instead of metric
- **Forecast Days**: Change the number of forecast days displayed

## License

This project is open source and available under the MIT License.