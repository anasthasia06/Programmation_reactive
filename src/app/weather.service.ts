import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface WeatherData {
  name: string;
  timezone?: number;
  sys: { country: string; sunrise: number; sunset: number };
  main: { temp: number; feels_like?: number; humidity?: number; pressure?: number };
  weather: { icon: string; description?: string }[];
  wind: { speed: number };
}

export interface ForecastData {
  list: Array<{ dt: number; main: { temp: number }; weather: { icon: string }[]; wind: { speed: number } }>;
}

@Injectable({ providedIn: 'root' })
export class WeatherService {
  private weatherSubject = new BehaviorSubject<WeatherData | null>(null);
  weather$ = this.weatherSubject.asObservable();

  private forecastSubject = new BehaviorSubject<ForecastData | null>(null);
  forecast$ = this.forecastSubject.asObservable();

  private loadingSubject = new BehaviorSubject<boolean>(false);
  loading$ = this.loadingSubject.asObservable();

  constructor() {
    // populate with a small mock dataset so the UI can render immediately
    const now = Date.now();
    const sampleWeather: WeatherData = {
      name: 'London',
      timezone: 0,
      sys: { country: 'GB', sunrise: Math.floor(now / 1000) - 3600, sunset: Math.floor(now / 1000) + 3600 },
      main: { temp: 12, feels_like: 11, humidity: 72, pressure: 1012 },
      weather: [{ icon: '10d', description: 'light rain' }],
      wind: { speed: 3 }
    };

    const list = [];
    for (let i = 0; i < 12; i++) {
      list.push({ dt: Math.floor((now + i * 3 * 3600 * 1000) / 1000), main: { temp: 12 - i }, weather: [{ icon: '04n' }], wind: { speed: 2 + i % 3 } });
    }

    this.weatherSubject.next(sampleWeather);
    this.forecastSubject.next({ list });
  }

  searchByCity(name: string) {
    // simple mock search: update city name and rotate temperatures
    const curr = this.weatherSubject.getValue();
    const now = Date.now();
    const newWeather: WeatherData = {
      name,
      timezone: 0,
      sys: { country: curr?.sys.country ?? 'US', sunrise: Math.floor(now / 1000) - 3600, sunset: Math.floor(now / 1000) + 3600 },
      main: { temp: Math.round((Math.random() * 15) + 5), feels_like: 10, humidity: 65, pressure: 1010 },
      weather: [{ icon: '01d', description: 'clear sky' }],
      wind: { speed: Math.round(Math.random() * 5) }
    };
    const list = [];
    for (let i = 0; i < 12; i++) {
      list.push({ dt: Math.floor((now + i * 3600 * 1000) / 1000), main: { temp: newWeather.main.temp - i }, weather: [{ icon: '01d' }], wind: { speed: 2 + i % 4 } });
    }
    this.weatherSubject.next(newWeather);
    this.forecastSubject.next({ list });
  }

  searchByCoords(lat: number, lon: number) {
    // just delegate to searchByCity for the mock
    this.searchByCity(`Lat ${lat.toFixed(2)}, Lon ${lon.toFixed(2)}`);
  }
}
