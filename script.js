// Weather API Configuration
const API_BASE_URL = 'https://api.open-meteo.com/v1/forecast';
const GEOCODING_URL = 'https://api.open-meteo.com/v1/geocoding';

// Global variables
let map = null;
let userMarker = null;
let userLocation = null;
let precipitationLayer = null;
let currentColorScheme = 2; // Fixed to Universal Blue

// Radar playback variables
let radarTimestamps = [];
let currentTimeIndex = 12; // Start at current time
let isPlaying = false;
let playInterval = null;
let availableRadarData = null;
let dbzChartContext = null;
let dbzData = [];


// DOM Elements
const getLocationBtn = document.getElementById('getLocationBtn');
const mapContainer = document.getElementById('mapContainer');
const colorbarContainer = document.getElementById('colorbarContainer');
const chartContainer = document.getElementById('chartContainer');
const weatherContainer = document.getElementById('weatherContainer');
const errorContainer = document.getElementById('errorContainer');
const loadingContainer = document.getElementById('loadingContainer');
const errorMessage = document.getElementById('errorMessage');
const dbzChart = document.getElementById('dbzChart');

// Radar playback elements
const radarControls = document.getElementById('radarControls');
const playBtn = document.getElementById('playBtn');
const timeSlider = document.getElementById('timeSlider');
const timeLabel = document.getElementById('timeLabel');

// Weather data elements
const temperatureEl = document.getElementById('temperature');
const weatherConditionEl = document.getElementById('weatherCondition');
const humidityEl = document.getElementById('humidity');
const windSpeedEl = document.getElementById('windSpeed');
const rainProbabilityEl = document.getElementById('rainProbability');
const rainVolume1hEl = document.getElementById('rainVolume1h');
const rainVolume3hEl = document.getElementById('rainVolume3h');
const cloudsEl = document.getElementById('clouds');
const forecastContainer = document.getElementById('forecastContainer');

// Event Listeners
getLocationBtn.addEventListener('click', getUserLocation);

// Radar playback event listeners
if (playBtn) playBtn.addEventListener('click', togglePlayback);
if (timeSlider) timeSlider.addEventListener('input', onTimeSliderChange);

// Main function to get user location
function getUserLocation() {
    if (!navigator.geolocation) {
        showError('Geolocation is not supported by this browser.');
        return;
    }

    showLoading(true);
    hideError();

    const options = {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000 // 5 minutes
    };

    navigator.geolocation.getCurrentPosition(
        onLocationSuccess,
        onLocationError,
        options
    );
}

// Handle successful location retrieval
function onLocationSuccess(position) {
    const lat = position.coords.latitude;
    const lon = position.coords.longitude;
    
    userLocation = { lat, lon };
    
    // Initialize map
    initializeMap(lat, lon);
    
    // Get weather data
    getWeatherData(lat, lon);
    
    // Initialize radar playback
    initializeRadarPlayback();
}

// Handle location error
function onLocationError(error) {
    showLoading(false);
    
    let message = 'Unable to retrieve your location.';
    
    switch(error.code) {
        case error.PERMISSION_DENIED:
            message = 'Location access denied. Please enable location permissions.';
            break;
        case error.POSITION_UNAVAILABLE:
            message = 'Location information is unavailable.';
            break;
        case error.TIMEOUT:
            message = 'Location request timed out. Please try again.';
            break;
    }
    
    showError(message);
}

// Initialize weather layers with latest data
async function initializeWeatherLayers() {
    try {
        // Get latest RainViewer data
        const rainViewerResponse = await fetch('https://api.rainviewer.com/public/weather-maps.json');
        const rainData = await rainViewerResponse.json();
        
        if (rainData.radar && rainData.radar.past && rainData.radar.past.length > 0) {
            // Get the most recent radar timestamp
            const latestRadar = rainData.radar.past[rainData.radar.past.length - 1];
            const timestamp = latestRadar.time;
            
            // Update precipitation layer with latest timestamp
            precipitationLayer = L.tileLayer(`https://tilecache.rainviewer.com/v2/radar/${timestamp}/512/{z}/{x}/{y}/${currentColorScheme}/1_1.png`, {
                attribution: '&copy; <a href="https://rainviewer.com">RainViewer</a>',
                opacity: 0.7,
                zIndex: 200
            });
        }
        
        // No cloud layer - focusing only on precipitation radar
        cloudsLayer = null;
        
    } catch (error) {
        console.error('Error initializing weather layers:', error);
        // Fallback to basic precipitation layer
        precipitationLayer = L.tileLayer(`https://tilecache.rainviewer.com/v2/radar/0/{z}/{x}/{y}/${currentColorScheme}/1_1.png`, {
            attribution: '&copy; <a href="https://rainviewer.com">RainViewer</a>',
            opacity: 0.7,
            zIndex: 200
        });
    }
}

// Initialize the map
function initializeMap(lat, lon) {
    // Show map container, colorbar, chart, and radar controls
    mapContainer.classList.remove('hidden');
    colorbarContainer.classList.remove('hidden');
    if (chartContainer) chartContainer.classList.remove('hidden');
    if (radarControls) radarControls.classList.remove('hidden');
    
    // Initialize map if not already created
    if (!map) {
        map = L.map('map').setView([lat, lon], 10);
        
        // Add dark base layer
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 20
        }).addTo(map);
        
        // Add precipitation layer using RainViewer (free, no API key needed)
        precipitationLayer = L.tileLayer('https://tilecache.rainviewer.com/v2/radar/0/{z}/{x}/{y}/1/1_1.png', {
            attribution: '&copy; <a href="https://rainviewer.com">RainViewer</a>',
            opacity: 0.7,
            zIndex: 200
        });
        
        // Add clouds layer using OpenWeatherMap (we'll get latest timestamp)
        cloudsLayer = null; // Will be set up after getting timestamp
        
        // Initialize weather layers
        initializeWeatherLayers().then(() => {
            // Add precipitation layer to map
            if (precipitationLayer) {
                precipitationLayer.addTo(map);
            }
        });
        
    } else {
        // Update map view
        map.setView([lat, lon], 10);
    }
    
    // Remove existing marker if any
    if (userMarker) {
        map.removeLayer(userMarker);
    }
    
    // Add user location marker with custom icon
    const userIcon = L.divIcon({
        className: 'user-location-marker',
        html: '<div style="background: #e74c3c; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);"></div>',
        iconSize: [20, 20],
        iconAnchor: [10, 10]
    });
    
    userMarker = L.marker([lat, lon], { icon: userIcon })
        .addTo(map)
        .bindPopup(`
            <div style="text-align: center;">
                <strong>📍 Your Location</strong><br>
                <small>${lat.toFixed(4)}, ${lon.toFixed(4)}</small>
            </div>
        `)
        .openPopup();
}

// Initialize dBZ chart
function initializeChart() {
    if (!dbzChart) return;
    
    dbzChartContext = dbzChart.getContext('2d');
    drawChart();
}

// Draw dBZ chart
function drawChart() {
    if (!dbzChartContext || radarTimestamps.length === 0) return;
    
    const canvas = dbzChart;
    const ctx = dbzChartContext;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Chart dimensions
    const padding = 60;
    const chartWidth = canvas.width - 2 * padding;
    const chartHeight = canvas.height - 2 * padding;
    
    // Background
    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Grid and axes
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1;
    
    // Vertical grid lines (time)
    for (let i = 0; i <= radarTimestamps.length - 1; i++) {
        const x = padding + (i * chartWidth) / (radarTimestamps.length - 1);
        ctx.beginPath();
        ctx.moveTo(x, padding);
        ctx.lineTo(x, padding + chartHeight);
        ctx.stroke();
    }
    
    // Horizontal grid lines (dBZ)
    for (let i = 0; i <= 5; i++) {
        const y = padding + (i * chartHeight) / 5;
        ctx.beginPath();
        ctx.moveTo(padding, y);
        ctx.lineTo(padding + chartWidth, y);
        ctx.stroke();
    }
    
    // Axes
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, padding + chartHeight);
    ctx.lineTo(padding + chartWidth, padding + chartHeight);
    ctx.stroke();
    
    // Y-axis labels (dBZ)
    ctx.fillStyle = '#666';
    ctx.font = '12px Arial';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let i = 0; i <= 5; i++) {
        const y = padding + chartHeight - (i * chartHeight) / 5;
        const dbzValue = i * 10;
        ctx.fillText(dbzValue + ' dBZ', padding - 10, y);
    }
    
    // X-axis labels (time)
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let i = 0; i < radarTimestamps.length; i++) {
        const x = padding + (i * chartWidth) / (radarTimestamps.length - 1);
        const time = new Date(radarTimestamps[i].timestamp * 1000);
        const timeStr = time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        ctx.fillText(timeStr, x, padding + chartHeight + 10);
    }
    
    // Draw dBZ line
    if (dbzData.length > 0) {
        ctx.strokeStyle = '#0984e3';
        ctx.lineWidth = 3;
        ctx.beginPath();
        
        for (let i = 0; i < dbzData.length; i++) {
            const x = padding + (i * chartWidth) / (radarTimestamps.length - 1);
            const y = padding + chartHeight - (dbzData[i] * chartHeight) / 50; // Max 50 dBZ
            
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.stroke();
        
        // Draw points
        ctx.fillStyle = '#0984e3';
        for (let i = 0; i < dbzData.length; i++) {
            const x = padding + (i * chartWidth) / (radarTimestamps.length - 1);
            const y = padding + chartHeight - (dbzData[i] * chartHeight) / 50;
            
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, 2 * Math.PI);
            ctx.fill();
        }
        
        // Highlight current time
        if (currentTimeIndex < dbzData.length) {
            const x = padding + (currentTimeIndex * chartWidth) / (radarTimestamps.length - 1);
            const y = padding + chartHeight - (dbzData[currentTimeIndex] * chartHeight) / 50;
            
            ctx.fillStyle = '#e74c3c';
            ctx.beginPath();
            ctx.arc(x, y, 6, 0, 2 * Math.PI);
            ctx.fill();
        }
    }
    
    // Chart title
    ctx.fillStyle = '#333';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('Precipitation Intensity Timeline', canvas.width / 2, 10);
}

// Update dBZ data with real precipitation data for user location
async function updateDbzData() {
    if (!userLocation || radarTimestamps.length === 0) {
        console.log('Cannot update dBZ data: missing user location or timestamps');
        return;
    }
    
    try {
        // Get historical and forecast precipitation data for the specific timeline
        const startTime = new Date(radarTimestamps[0].timestamp * 1000).toISOString().split('T')[0];
        const endTime = new Date(radarTimestamps[radarTimestamps.length - 1].timestamp * 1000).toISOString().split('T')[0];
        
        const params = new URLSearchParams({
            latitude: userLocation.lat,
            longitude: userLocation.lon,
            hourly: 'precipitation',
            timezone: 'auto',
            start_date: startTime,
            end_date: endTime
        });
        
        const response = await fetch(`${API_BASE_URL}?${params}`);
        const weatherData = await response.json();
        
        if (weatherData.hourly && weatherData.hourly.precipitation) {
            // Map radar timestamps to closest hourly precipitation data
            dbzData = radarTimestamps.map(frame => {
                const frameTime = new Date(frame.timestamp * 1000);
                const frameHour = frameTime.getHours();
                const frameDate = frameTime.toISOString().split('T')[0];
                
                // Find matching hourly data point
                let precipitation = 0;
                for (let i = 0; i < weatherData.hourly.time.length; i++) {
                    const dataTime = new Date(weatherData.hourly.time[i]);
                    const dataHour = dataTime.getHours();
                    const dataDate = dataTime.toISOString().split('T')[0];
                    
                    if (dataDate === frameDate && Math.abs(dataHour - frameHour) <= 1) {
                        precipitation = weatherData.hourly.precipitation[i] || 0;
                        break;
                    }
                }
                
                // Convert precipitation (mm/h) to approximate dBZ values
                // Formula: dBZ ≈ 10 * log10(200 * R^1.6) where R is rain rate in mm/h
                // Simplified conversion for display purposes
                let dbzValue = 0;
                if (precipitation > 0) {
                    // Approximate dBZ calculation
                    dbzValue = Math.max(5, 10 * Math.log10(200 * Math.pow(precipitation, 1.6)));
                    dbzValue = Math.min(50, dbzValue); // Cap at 50 dBZ
                }
                
                return Math.round(dbzValue * 10) / 10; // Round to 1 decimal place
            });
            
            console.log('Updated dBZ data for user location:', userLocation);
            console.log('dBZ values:', dbzData);
            
        } else {
            // Fallback: generate realistic data based on current weather
            console.log('Using fallback precipitation estimation');
            await generateRealisticDbzData();
        }
        
        drawChart();
        
    } catch (error) {
        console.error('Error fetching location-specific precipitation data:', error);
        // Fallback to realistic estimation
        await generateRealisticDbzData();
        drawChart();
    }
}

// Generate realistic dBZ data based on current weather conditions
async function generateRealisticDbzData() {
    try {
        // Get current weather for baseline
        const params = new URLSearchParams({
            latitude: userLocation.lat,
            longitude: userLocation.lon,
            current: 'precipitation,rain,weather_code,cloud_cover',
            timezone: 'auto'
        });
        
        const response = await fetch(`${API_BASE_URL}?${params}`);
        const currentWeather = await response.json();
        
        const currentPrecip = currentWeather.current.precipitation || 0;
        const currentRain = currentWeather.current.rain || 0;
        const cloudCover = currentWeather.current.cloud_cover || 0;
        const weatherCode = currentWeather.current.weather_code || 0;
        
        // Determine base precipitation intensity from weather code
        let baseIntensity = 0;
        if (weatherCode >= 61 && weatherCode <= 65) baseIntensity = currentRain || currentPrecip || (cloudCover * 0.1);
        else if (weatherCode >= 51 && weatherCode <= 57) baseIntensity = Math.max(0.1, currentPrecip);
        else if (weatherCode >= 80 && weatherCode <= 82) baseIntensity = currentRain || (cloudCover * 0.15);
        else if (weatherCode >= 95) baseIntensity = Math.max(5, currentPrecip || currentRain);
        
        // Generate realistic progression over time
        dbzData = radarTimestamps.map((frame, index) => {
            const currentFrameIndex = radarTimestamps.findIndex(f => f.type === 'current');
            const timeFromCurrent = index - currentFrameIndex;
            
            // Base intensity modification based on time progression
            let intensity = baseIntensity;
            
            if (frame.type === 'past') {
                // Past frames: slight variation
                intensity = baseIntensity * (0.7 + Math.random() * 0.6);
            } else if (frame.type === 'current') {
                // Current frame: use actual data
                intensity = baseIntensity;
            } else if (frame.type === 'forecast') {
                // Forecast: simulate weather evolution
                const evolution = Math.sin(timeFromCurrent * 0.5) * 0.3 + 1;
                intensity = baseIntensity * evolution;
            }
            
            // Convert to dBZ
            let dbzValue = 0;
            if (intensity > 0) {
                dbzValue = Math.max(5, 10 * Math.log10(200 * Math.pow(intensity, 1.6)));
                dbzValue = Math.min(50, dbzValue);
            }
            
            return Math.round(dbzValue * 10) / 10;
        });
        
        console.log('Generated realistic dBZ data based on current weather at location');
        
    } catch (error) {
        console.error('Error generating realistic data:', error);
        // Ultimate fallback
        dbzData = radarTimestamps.map(() => 0);
    }
}

// Get weather data from Open-Meteo API
async function getWeatherData(lat, lon) {
    try {
        // Build URL with all required parameters
        const params = new URLSearchParams({
            latitude: lat,
            longitude: lon,
            current: [
                'temperature_2m',
                'relative_humidity_2m',
                'apparent_temperature',
                'is_day',
                'precipitation',
                'rain',
                'weather_code',
                'cloud_cover',
                'wind_speed_10m',
                'wind_direction_10m'
            ].join(','),
            hourly: [
                'temperature_2m',
                'precipitation_probability',
                'precipitation',
                'rain',
                'weather_code',
                'cloud_cover'
            ].join(','),
            daily: [
                'weather_code',
                'temperature_2m_max',
                'temperature_2m_min',
                'precipitation_probability_max',
                'rain_sum'
            ].join(','),
            timezone: 'auto',
            forecast_days: 7
        });
        
        const weatherUrl = `${API_BASE_URL}?${params}`;
        
        const response = await fetch(weatherUrl);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const weatherData = await response.json();
        
        // Update UI with weather data
        updateCurrentWeather(weatherData);
        updateRainForecast(weatherData);
        updateForecast(weatherData);
        
        // Show weather container
        weatherContainer.classList.remove('hidden');
        showLoading(false);
        
        // Update chart with location-specific data after weather data is loaded
        if (radarTimestamps.length > 0) {
            await updateDbzData();
        }
        
        // Refresh weather layers to show current conditions
        if (map && precipitationLayer) {
            setTimeout(() => {
                refreshWeatherLayers();
            }, 1500);
        }
        
    } catch (error) {
        console.error('Error fetching weather data:', error);
        showLoading(false);
        showError('Failed to fetch weather data. Please check your internet connection and try again.');
    }
}

// Update current weather display
function updateCurrentWeather(data) {
    const current = data.current;
    
    temperatureEl.textContent = `${Math.round(current.temperature_2m)}°C`;
    weatherConditionEl.textContent = getWeatherDescription(current.weather_code, current.is_day);
    humidityEl.textContent = `${current.relative_humidity_2m}%`;
    windSpeedEl.textContent = `${current.wind_speed_10m.toFixed(1)} km/h`;
    cloudsEl.textContent = `${current.cloud_cover}%`;
}

// Get weather description from WMO weather code
function getWeatherDescription(code, isDay) {
    const descriptions = {
        0: 'Clear sky',
        1: 'Mainly clear',
        2: 'Partly cloudy',
        3: 'Overcast',
        45: 'Fog',
        48: 'Depositing rime fog',
        51: 'Light drizzle',
        53: 'Moderate drizzle',
        55: 'Dense drizzle',
        56: 'Light freezing drizzle',
        57: 'Dense freezing drizzle',
        61: 'Slight rain',
        63: 'Moderate rain',
        65: 'Heavy rain',
        66: 'Light freezing rain',
        67: 'Heavy freezing rain',
        71: 'Slight snow fall',
        73: 'Moderate snow fall',
        75: 'Heavy snow fall',
        77: 'Snow grains',
        80: 'Slight rain showers',
        81: 'Moderate rain showers',
        82: 'Violent rain showers',
        85: 'Slight snow showers',
        86: 'Heavy snow showers',
        95: 'Thunderstorm',
        96: 'Thunderstorm with slight hail',
        99: 'Thunderstorm with heavy hail'
    };
    
    return descriptions[code] || 'Unknown';
}

// Update rain forecast display
function updateRainForecast(data) {
    const current = data.current;
    const hourly = data.hourly;
    
    // Calculate rain probability from next 12 hours
    let rainProbability = 0;
    if (hourly && hourly.precipitation_probability) {
        const next12Hours = hourly.precipitation_probability.slice(0, 12);
        rainProbability = Math.max(...next12Hours) || 0;
    }
    
    rainProbabilityEl.textContent = `${Math.round(rainProbability)}%`;
    
    // Update rain volumes
    const currentRain = current.rain || 0;
    const currentPrecipitation = current.precipitation || 0;
    
    // For 1h and 3h, we'll use current values and estimates
    rainVolume1hEl.textContent = `${currentRain.toFixed(1)} mm`;
    rainVolume3hEl.textContent = `${(currentPrecipitation * 3).toFixed(1)} mm`;
}

// Update 5-day forecast display
function updateForecast(data) {
    forecastContainer.innerHTML = '';
    
    const daily = data.daily;
    if (!daily) return;
    
    // Display up to 5 days
    const maxDays = Math.min(5, daily.time.length);
    
    for (let i = 0; i < maxDays; i++) {
        const date = new Date(daily.time[i]);
        const maxTemp = daily.temperature_2m_max[i];
        const minTemp = daily.temperature_2m_min[i];
        const rainProb = daily.precipitation_probability_max[i] || 0;
        const rainSum = daily.rain_sum[i] || 0;
        const weatherCode = daily.weather_code[i];
        
        const forecastItem = document.createElement('div');
        forecastItem.className = 'forecast-item';
        
        const dayName = i === 0 ? 'Today' : 
                       i === 1 ? 'Tomorrow' : 
                       date.toLocaleDateString('en-US', { weekday: 'short' });
        
        forecastItem.innerHTML = `
            <div class="forecast-date">${dayName}</div>
            <div class="forecast-rain">${Math.round(rainProb)}%</div>
            <div class="forecast-details">
                <div>${rainSum.toFixed(1)}mm rain</div>
                <div>${Math.round(maxTemp)}°C / ${Math.round(minTemp)}°C</div>
                <div>${getWeatherDescription(weatherCode, 1)}</div>
            </div>
        `;
        
        forecastContainer.appendChild(forecastItem);
    }
}

// Refresh weather layers
async function refreshWeatherLayers() {
    if (!map) return;
    
    try {
        // Show loading notification
        showNotification('Updating weather radar... ⏳');
        
        // Get latest RainViewer data
        const rainViewerResponse = await fetch('https://api.rainviewer.com/public/weather-maps.json');
        const rainData = await rainViewerResponse.json();
        
        if (rainData.radar && rainData.radar.past && rainData.radar.past.length > 0) {
            const latestRadar = rainData.radar.past[rainData.radar.past.length - 1];
            const timestamp = latestRadar.time;
            
            // Remove old precipitation layer
            if (precipitationLayer && map.hasLayer(precipitationLayer)) {
                map.removeLayer(precipitationLayer);
            }
            
            // Create new precipitation layer with latest data
            precipitationLayer = L.tileLayer(`https://tilecache.rainviewer.com/v2/radar/${timestamp}/512/{z}/{x}/{y}/${currentColorScheme}/1_1.png`, {
                attribution: '&copy; <a href="https://rainviewer.com">RainViewer</a>',
                opacity: 0.7,
                zIndex: 200
            });
            
            // Add updated layer to map
            precipitationLayer.addTo(map);
            
            showNotification('Weather radar updated! 🌧️');
        }
        
    } catch (error) {
        console.error('Error refreshing weather layers:', error);
        showNotification('Failed to update weather data ❌');
    }
}

// Show notification
function showNotification(message) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(45deg, #00b894, #00cec9);
        color: white;
        padding: 15px 20px;
        border-radius: 10px;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
        z-index: 10000;
        font-weight: bold;
        transform: translateX(400px);
        transition: transform 0.3s ease;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 100);
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.style.transform = 'translateX(400px)';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}

// Utility functions
function showLoading(show) {
    if (show) {
        loadingContainer.classList.remove('hidden');
    } else {
        loadingContainer.classList.add('hidden');
    }
}

function showError(message) {
    errorMessage.textContent = message;
    errorContainer.classList.remove('hidden');
}

function hideError() {
    errorContainer.classList.add('hidden');
}

// Radar Playback Functions
async function initializeRadarPlayback() {
    try {
        // Fetch available radar timestamps
        const response = await fetch('https://api.rainviewer.com/public/weather-maps.json');
        const data = await response.json();
        
        if (data && data.radar) {
            availableRadarData = data.radar;
            
            // Create focused timeline: 3 past + current (most recent past) + 3 forecast
            radarTimestamps = [];
            
            if (data.radar.past && data.radar.past.length > 0) {
                // Use most recent past frame as "current"
                const mostRecentPast = data.radar.past[data.radar.past.length - 1];
                
                // Add 3 frames before the most recent (if they exist)
                const pastFrames = data.radar.past.slice(-4, -1); // Get 3 frames before the last one
                radarTimestamps.push(...pastFrames.map(frame => ({
                    timestamp: frame.time,
                    type: 'past',
                    path: frame.path
                })));
                
                // Add most recent past frame as current
                radarTimestamps.push({
                    timestamp: mostRecentPast.time,
                    type: 'current',
                    path: mostRecentPast.path
                });
            } else {
                // Fallback: use generated timestamp if no past data
                const currentTime = data.generated || Math.floor(Date.now() / 1000);
                radarTimestamps.push({
                    timestamp: currentTime,
                    type: 'current',
                    path: null
                });
            }
            
            // Add first 3 forecast frames
            if (data.radar.nowcast && data.radar.nowcast.length > 0) {
                const firstThreeForecast = data.radar.nowcast.slice(0, 3);
                radarTimestamps.push(...firstThreeForecast.map(frame => ({
                    timestamp: frame.time,
                    type: 'forecast',
                    path: frame.path
                })));
            }
            
            // Set current time index
            currentTimeIndex = radarTimestamps.findIndex(frame => frame.type === 'current');
            if (currentTimeIndex === -1) currentTimeIndex = Math.floor(radarTimestamps.length / 2);
            
            updateTimeLabel();
            updateTimeSlider();
            
            // Initialize and update chart with real location data
            initializeChart();
            await updateDbzData();
            
            console.log(`Initialized radar playback with ${radarTimestamps.length} frames, current at index ${currentTimeIndex}`);
            console.log('Timeline:', radarTimestamps.map(f => `${f.type}: ${new Date(f.timestamp * 1000).toLocaleTimeString()}`));
        }
    } catch (error) {
        console.error('Failed to initialize radar playback:', error);
    }
}

function togglePlayback() {
    isPlaying = !isPlaying;
    
    if (isPlaying) {
        playBtn.textContent = '⏸️';
        startPlayback();
    } else {
        playBtn.textContent = '▶️';
        stopPlayback();
    }
}

function startPlayback() {
    if (playInterval) clearInterval(playInterval);
    
    playInterval = setInterval(() => {
        currentTimeIndex = (currentTimeIndex + 1) % radarTimestamps.length;
        updateTimeSlider();
        updateTimeLabel();
        updateRadarLayer();
    }, 800); // 800ms between frames
}

function stopPlayback() {
    if (playInterval) {
        clearInterval(playInterval);
        playInterval = null;
    }
}

function onTimeSliderChange(event) {
    if (isPlaying) togglePlayback();
    
    currentTimeIndex = parseInt(event.target.value);
    updateTimeLabel();
    updateRadarLayer();
}

function updateTimeSlider() {
    if (timeSlider) {
        timeSlider.max = radarTimestamps.length - 1;
        timeSlider.value = currentTimeIndex;
    }
}

function updateTimeLabel() {
    if (!timeLabel || !radarTimestamps[currentTimeIndex]) return;
    
    const frame = radarTimestamps[currentTimeIndex];
    // Use the current frame (most recent past) as reference instead of generated
    const currentFrameIndex = radarTimestamps.findIndex(f => f.type === 'current');
    const currentFrameTime = currentFrameIndex !== -1 ? radarTimestamps[currentFrameIndex].timestamp : Math.floor(Date.now() / 1000);
    const diffMinutes = Math.round((frame.timestamp - currentFrameTime) / 60);
    
    let label;
    if (frame.type === 'current' || Math.abs(diffMinutes) < 5) {
        label = 'Now';
    } else if (diffMinutes > 0) {
        const hours = Math.floor(diffMinutes / 60);
        const mins = diffMinutes % 60;
        if (hours > 0) {
            label = `+${hours}h${mins > 0 ? mins + 'm' : ''}`;
        } else {
            label = `+${mins}m`;
        }
    } else {
        const hours = Math.floor(Math.abs(diffMinutes) / 60);
        const mins = Math.abs(diffMinutes) % 60;
        if (hours > 0) {
            label = `-${hours}h${mins > 0 ? mins + 'm' : ''}`;
        } else {
            label = `-${mins}m`;
        }
    }
    
    timeLabel.textContent = label;
}

function updateRadarLayer() {
    if (!map || !radarTimestamps[currentTimeIndex]) return;
    
    // Remove existing precipitation layer
    if (precipitationLayer) {
        map.removeLayer(precipitationLayer);
        precipitationLayer = null;
    }
    
    const frame = radarTimestamps[currentTimeIndex];
    let radarUrl;
    
    if (frame.path) {
        // Use specific timestamp path
        radarUrl = `https://tilecache.rainviewer.com${frame.path}/512/{z}/{x}/{y}/${currentColorScheme}/1_1.png`;
    } else {
        // Use generic timestamp
        radarUrl = `https://tilecache.rainviewer.com/v2/radar/${Math.floor(frame.timestamp)}/512/{z}/{x}/{y}/${currentColorScheme}/1_1.png`;
    }
    
    // Create new precipitation layer
    precipitationLayer = L.tileLayer(radarUrl, {
        attribution: '&copy; <a href="https://rainviewer.com">RainViewer</a>',
        opacity: 0.7,
        zIndex: 200,
        maxZoom: 20
    });
    
    precipitationLayer.addTo(map);
    
    // Update chart highlight
    drawChart();
}



// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    console.log('Weather Location App initialized with Open-Meteo API');
});