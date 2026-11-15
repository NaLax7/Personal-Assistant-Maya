import { WeatherData } from '../types/assistant';

// WMO Weather code mapper
function mapWmoCode(code: number): string {
  if (code === 0) return 'Clear Sky';
  if (code === 1) return 'Mainly Clear';
  if (code === 2) return 'Partly Cloudy';
  if (code === 3) return 'Overcast';
  if ([45, 48].includes(code)) return 'Foggy';
  if ([51, 53, 55].includes(code)) return 'Light Drizzle';
  if ([61, 63, 65].includes(code)) return 'Rain';
  if ([66, 67].includes(code)) return 'Freezing Rain';
  if ([71, 73, 75, 77].includes(code)) return 'Snow';
  if ([80, 81, 82].includes(code)) return 'Rain Showers';
  if ([95, 96, 99].includes(code)) return 'Thunderstorm';
  return 'Fair Weather';
}

export interface TabletLocation {
  latitude: number;
  longitude: number;
  city: string;
  country?: string;
  source: 'gps' | 'ip' | 'cached' | 'fallback';
}

export async function detectTabletLocation(): Promise<TabletLocation> {
  // Check cached location first
  const cached = localStorage.getItem('aura_tablet_location');
  let fallbackLocation: TabletLocation = cached
    ? JSON.parse(cached)
    : {
        latitude: 51.5074,
        longitude: -0.1278,
        city: 'Local Tablet',
        source: 'fallback',
      };

  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) {
      resolve(fallbackLocation);
      return;
    }

    const timeout = setTimeout(() => {
      resolve(fallbackLocation);
    }, 6000);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        clearTimeout(timeout);
        const { latitude, longitude } = pos.coords;
        let detectedCity = 'Tablet Location';

        try {
          // Reverse geocode via server proxy to avoid browser CORS/403 errors
          const geoRes = await fetch(`/api/reverse-geocode?lat=${latitude}&lon=${longitude}`);
          if (geoRes.ok) {
            const data = await geoRes.json();
            if (data.city && data.city !== 'Local Tablet') {
              detectedCity = data.city;
            }
          }
        } catch {
          // If reverse geocoding is unavailable, use time zone name as city approximation
          try {
            const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
            detectedCity = tz.split('/')[1]?.replace(/_/g, ' ') || 'Local Tablet';
          } catch {
            // Keep generic
          }
        }

        const loc: TabletLocation = {
          latitude,
          longitude,
          city: detectedCity,
          source: 'gps',
        };

        localStorage.setItem('aura_tablet_location', JSON.stringify(loc));
        resolve(loc);
      },
      (err) => {
        clearTimeout(timeout);
        // Fallback silently to Timezone estimation
        try {
          const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
          const tzCity = tz.split('/')[1]?.replace(/_/g, ' ') || 'Local Tablet';
          fallbackLocation.city = tzCity;
        } catch {}
        resolve(fallbackLocation);
      },
      { timeout: 5000, enableHighAccuracy: false }
    );
  });
}

export async function fetchLiveWeather(loc: TabletLocation): Promise<WeatherData> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min&timezone=auto`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Weather API request failed');

    const data = await res.json();
    const current = data.current;
    const daily = data.daily;

    const weatherData: WeatherData = {
      temp: Math.round(current.temperature_2m),
      condition: mapWmoCode(current.weather_code),
      high: Math.round(daily?.temperature_2m_max?.[0] ?? current.temperature_2m + 3),
      low: Math.round(daily?.temperature_2m_min?.[0] ?? current.temperature_2m - 4),
      humidity: Math.round(current.relative_humidity_2m),
      windSpeed: Math.round(current.wind_speed_10m),
      city: loc.city,
      feelsLike: Math.round(current.apparent_temperature),
    };

    localStorage.setItem('aura_cached_weather', JSON.stringify(weatherData));
    return weatherData;
  } catch (e) {
    console.warn('Failed to fetch Open-Meteo live weather, using cached or baseline:', e);
    const cached = localStorage.getItem('aura_cached_weather');
    if (cached) {
      return JSON.parse(cached);
    }
    return {
      temp: 21,
      condition: 'Partly Sunny',
      high: 24,
      low: 15,
      humidity: 50,
      windSpeed: 10,
      city: loc.city || 'Tablet Location',
      feelsLike: 21,
    };
  }
}
