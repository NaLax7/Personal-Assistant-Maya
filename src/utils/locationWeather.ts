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
  source: 'gps' | 'cached' | 'fallback';
}

const LOCATION_KEY = 'maya_tablet_location';
const WEATHER_KEY = 'maya_cached_weather';

function safeParseJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function detectTabletLocation(): Promise<TabletLocation> {
  const cached = safeParseJson<TabletLocation>(
    localStorage.getItem(LOCATION_KEY) || localStorage.getItem('aura_tablet_location')
  );
  const fallbackLocation: TabletLocation =
    cached && typeof cached.latitude === 'number' && typeof cached.longitude === 'number'
      ? cached
      : {
          latitude: 51.51,
          longitude: -0.13,
          city: 'Local Device',
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
        // Round to ~1km precision so exact street coordinates are never persisted or transmitted
        const latitude = Math.round(pos.coords.latitude * 100) / 100;
        const longitude = Math.round(pos.coords.longitude * 100) / 100;
        let detectedCity = 'Local Device';

        try {
          const geoRes = await fetch(`/api/reverse-geocode?lat=${latitude}&lon=${longitude}`);
          if (geoRes.ok) {
            const data = await geoRes.json();
            if (typeof data.city === 'string' && data.city.trim()) {
              detectedCity = data.city.trim();
            }
          } else {
            throw new Error('Reverse geocode fallback');
          }
        } catch {
          try {
            if (navigator.onLine) {
              const osmRes = await fetch(
                `https://nominatim.openstreetmap.org/reverse?lat=${latitude.toFixed(2)}&lon=${longitude.toFixed(2)}&format=json&zoom=10`,
                { headers: { 'Accept-Language': 'en' } }
              );
              if (osmRes.ok) {
                const osmData = await osmRes.json();
                const directCity =
                  osmData.address?.city ||
                  osmData.address?.town ||
                  osmData.address?.municipality ||
                  osmData.address?.village ||
                  osmData.address?.county;
                if (typeof directCity === 'string' && directCity.trim()) {
                  detectedCity = directCity.trim();
                }
              }
            }
            if (detectedCity === 'Local Device') {
              const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
              detectedCity = tz.split('/')[1]?.replace(/_/g, ' ') || 'Local Device';
            }
          } catch {
            // Keep default
          }
        }

        const loc: TabletLocation = {
          latitude,
          longitude,
          city: detectedCity,
          source: 'gps',
        };

        try {
          localStorage.setItem(LOCATION_KEY, JSON.stringify(loc));
        } catch {
          // ignore storage quota
        }
        resolve(loc);
      },
      () => {
        clearTimeout(timeout);
        try {
          const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
          const tzCity = tz.split('/')[1]?.replace(/_/g, ' ') || 'Local Device';
          fallbackLocation.city = tzCity;
        } catch {
          // ignore
        }
        resolve(fallbackLocation);
      },
      { timeout: 5000, enableHighAccuracy: false }
    );
  });
}

export async function fetchLiveWeather(loc: TabletLocation): Promise<WeatherData> {
  try {
    const lat = Number(loc.latitude.toFixed(2));
    const lon = Number(loc.longitude.toFixed(2));
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min&timezone=auto`;
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

    try {
      localStorage.setItem(WEATHER_KEY, JSON.stringify(weatherData));
    } catch {
      // ignore storage quota
    }
    return weatherData;
  } catch {
    const cached = safeParseJson<WeatherData>(
      localStorage.getItem(WEATHER_KEY) || localStorage.getItem('aura_cached_weather')
    );
    if (cached && typeof cached.temp === 'number') {
      return cached;
    }
    return {
      temp: 21,
      condition: 'Partly Sunny',
      high: 24,
      low: 15,
      humidity: 50,
      windSpeed: 10,
      city: loc.city || 'Local Device',
      feelsLike: 21,
    };
  }
}
