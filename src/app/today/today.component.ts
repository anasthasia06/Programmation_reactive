// Assuming this is a component file like today.component.ts

import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WeatherService } from '../weather.service'; // Assuming path
import { Subscription, interval } from 'rxjs';
import { switchMap, startWith } from 'rxjs/operators';

// Interface examples (you would define these more formally in a real project)
interface WeatherData {
  name: string;
  sys: { country: string, sunrise: number, sunset: number };
  main: { temp: number, feels_like: number, humidity: number, pressure: number };
  weather: [{ icon: string, description: string }];
  wind: { speed: number };
  timezone: number;
}

interface ForecastItem {
  dt: number;
  main: { temp: number };
  weather: [{ icon: string }];
  wind: { speed: number };
}

@Component({
  selector: 'app-today',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './today.component.html',
  styleUrls: ['./today.component.css']
})
export class TodayComponent implements OnInit, OnDestroy {
  cityName: string = '';
  weather: WeatherData | null = null;
  dailyForecast: ForecastItem[] = [];
  hourlyForecast: ForecastItem[] = [];
  cityTimestamp: Date = new Date();

  isDarkMode: boolean = true; // Default to dark mode
  isGraphView: boolean = false; // Default to card view for 5-day forecast

  private timerSubscription: Subscription | undefined;
  private weatherSubscription: Subscription | undefined;

  constructor(private weatherService: WeatherService) { }

  ngOnInit(): void {
    // Set initial theme based on default
    this.setTheme();
    // Default to a location (e.g., London or use geolocation)
    this.cityName = 'London';
    this.getWeatherByCity();

    // Start interval to update time every minute
    this.timerSubscription = interval(1000) // Update every second for smooth clock
      .pipe(startWith(0))
      .subscribe(() => {
        if (this.weather) {
          this.updateCityTime(this.weather.timezone);
        } else {
          this.cityTimestamp = new Date(); // Fallback to local time
        }
      });
  }

  ngOnDestroy(): void {
    if (this.timerSubscription) {
      this.timerSubscription.unsubscribe();
    }
    if (this.weatherSubscription) {
      this.weatherSubscription.unsubscribe();
    }
  }

  // --- Theme Management ---
  setTheme(): void {
    document.body.className = this.isDarkMode ? 'dark-theme' : 'light-theme';
  }

  toggleMode(): void {
    this.isDarkMode = !this.isDarkMode;
    this.setTheme();
  }

  toggleForecastView(): void {
    this.isGraphView = !this.isGraphView;
  }

  getMaxTemp(): number {
    if (this.dailyForecast.length === 0) return 30;
    return Math.max(...this.dailyForecast.map(item => item.main.temp));
  }

  getMinTemp(): number {
    if (this.dailyForecast.length === 0) return 0;
    return Math.min(...this.dailyForecast.map(item => item.main.temp));
  }

  getYPosition(temp: number): number {
    const maxTemp = this.getMaxTemp();
    const minTemp = this.getMinTemp();
    const range = maxTemp - minTemp || 10; // Avoid division by zero
    // Map temperature to Y coordinate (50 to 250, inverted because SVG Y grows downward)
    return 250 - ((temp - minTemp) / range * 200);
  }

  getGraphPoints(): string {
    if (this.dailyForecast.length === 0) return '';
    return this.dailyForecast.map((item, index) => {
      const x = 50 + index * 100;
      const y = this.getYPosition(item.main.temp);
      return `${x},${y}`;
    }).join(' ');
  }

  // --- Time Management ---
  updateCityTime(timezoneOffsetSeconds: number): void {
    const localTime = new Date();
    // Calculate UTC time in milliseconds
    const utcTime = localTime.getTime() + (localTime.getTimezoneOffset() * 60000);
    // Apply city's timezone offset
    this.cityTimestamp = new Date(utcTime + (timezoneOffsetSeconds * 1000));
  }

  // --- Weather Retrieval ---
  getWeatherByCity(): void {
    if (!this.cityName) return;

    this.weatherSubscription = this.weatherService.getWeatherDataByCityName(this.cityName)
      .subscribe({
        next: (response) => {
          this.weather = response;
          this.updateCityTime(response.timezone);
          this.getForecast(response.coord.lat, response.coord.lon);
        },
        error: (error) => {
          console.error('Error fetching weather data:', error);
          this.weather = null; // Clear data on error
          alert('City not found or API error. Please try again.');
        }
      });
  }

  getLocation(): void {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lon = position.coords.longitude;
          this.getWeatherByCoords(lat, lon);
        },
        (error) => {
          console.error('Geolocation error:', error);
          alert('Geolocation not supported or denied.');
        }
      );
    } else {
      alert('Geolocation is not supported by this browser.');
    }
  }

  getWeatherByCoords(lat: number, lon: number): void {
    this.weatherSubscription = this.weatherService.getWeatherDataByCoords(lat, lon)
      .subscribe({
        next: (response) => {
          this.weather = response;
          this.cityName = response.name; // Update search bar with city name
          this.updateCityTime(response.timezone);
          this.getForecast(lat, lon);
        },
        error: (error) => {
          console.error('Error fetching weather data by coords:', error);
          this.weather = null;
          alert('Could not fetch weather data for your location.');
        }
      });
  }

  // --- Forecast Processing ---
  getForecast(lat: number, lon: number): void {
    this.weatherService.getForecastDataByCoords(lat, lon)
      .subscribe({
        next: (response: any) => {
          this.processForecast(response.list);
        },
        error: (error) => {
          console.error('Error fetching forecast data:', error);
        }
      });
  }

  processForecast(list: any[]): void {
    const dailyMap = new Map<string, ForecastItem>();
    this.hourlyForecast = [];

    const now = new Date();
    let hourlyCount = 0;

    for (const item of list) {
      const date = new Date(item.dt * 1000);
      const dateString = date.toISOString().split('T')[0];

      // 1. Process 5-Day Forecast (one entry per day, e.g., noon forecast)
      // Check if we already have a forecast for this day.
      // We take the forecast closest to noon (12:00) if possible.
      if (!dailyMap.has(dateString)) {
         dailyMap.set(dateString, item);
      }

      // 2. Process Hourly Forecast (for the current day and upcoming hours)
      // Display the next 8 hourly forecasts
      if (date.getTime() > now.getTime() && hourlyCount < 8) {
        this.hourlyForecast.push(item);
        hourlyCount++;
      }
    }

    // Convert map values to array for the daily forecast
    this.dailyForecast = Array.from(dailyMap.values()).slice(0, 5);
  }
}
