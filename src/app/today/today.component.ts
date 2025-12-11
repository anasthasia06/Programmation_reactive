// src/app/today/today.component.ts
// This component demonstrates reactive programming with RxJS:
// - Using async pipe for automatic subscription management
// - Observables and reactive state via BehaviorSubject
// - Composition of multiple streams with combineLatest
// - OnDestroy cleanup (fallback for non-observable resources)

import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WeatherService, WeatherData, ForecastData } from '../weather.service';
import { Observable, BehaviorSubject, combineLatest, Subject, interval } from 'rxjs';
import { map, takeUntil, startWith } from 'rxjs/operators';

interface ForecastItem {
  dt: number;
  main: { temp: number };
  weather: [{ icon: string }];
  wind: { speed: number };
}

interface ProcessedForecast {
  daily: ForecastItem[];
  hourly: ForecastItem[];
}

@Component({
  selector: 'app-today',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './today.component.html',
  styleUrls: ['./today.component.css']
})
export class TodayComponent implements OnInit, OnDestroy {
  // ============ REACTIVE STATE WITH OBSERVABLES ============

  // Current city name for the search input
  cityName: string = '';
  weather: WeatherData | null = null;
  dailyForecast: ForecastItem[] = [];
  hourlyForecast: ForecastItem[] = [];
  cityTimestamp: Date = new Date();

  isDarkMode: boolean = true; // Default to dark mode

  private timerSubscription: Subscription | undefined;
  private weatherSubscription: Subscription | undefined;

  constructor(private weatherService: WeatherService) { }

  ngOnInit(): void {
    // Set initial theme
    this.applyTheme(this.isDarkModeSubject.getValue());

    // Default to London
    this.cityName = 'London';
    this.searchCity();
  }

  ngOnDestroy(): void {
    // Complete the destroy subject to unsubscribe all observables using takeUntil
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ============ THEME MANAGEMENT (REACTIVE) ============

  private applyTheme(isDark: boolean): void {
    document.body.className = isDark ? 'dark-theme' : 'light-theme';
  }

  toggleMode(): void {
    this.isDarkMode = !this.isDarkMode;
    this.setTheme();
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
          const { latitude, longitude } = position.coords;
          this.weatherService.searchByCoords(latitude, longitude);
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

  // ============ DATA PROCESSING METHODS ============

  /**
   * Process forecast list into daily (5-day) and hourly (next 8 hours)
   * This demonstrates data transformation within observable streams
   */
  private processForecast(list: any[]): ProcessedForecast {
    const dailyMap = new Map<string, ForecastItem>();
    const hourlyForecast: ForecastItem[] = [];

    const now = new Date();
    let hourlyCount = 0;

    for (const item of list) {
      const date = new Date(item.dt * 1000);
      const dateString = date.toISOString().split('T')[0];

      // Daily forecast: one entry per day (first occurrence for that day)
      if (!dailyMap.has(dateString)) {
        dailyMap.set(dateString, item);
      }

      // Hourly forecast: next 8 hours after now
      if (date.getTime() > now.getTime() && hourlyCount < 8) {
        hourlyForecast.push(item);
        hourlyCount++;
      }
    }

    return {
      daily: Array.from(dailyMap.values()).slice(0, 5),
      hourly: hourlyForecast
    };
  }

  /**
   * Calculate current time in a given timezone
   */
  private calculateCityTime(timezoneOffsetSeconds: number): Date {
    const localTime = new Date();
    const utcTime = localTime.getTime() + (localTime.getTimezoneOffset() * 60000);
    return new Date(utcTime + (timezoneOffsetSeconds * 1000));
  }
}

