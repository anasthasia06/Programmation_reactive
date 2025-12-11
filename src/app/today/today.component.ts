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

  // Observable stream of current weather data (managed by service)
  weather$: Observable<WeatherData | null>;

  // Observable stream of processed forecast data (daily + hourly)
  processedForecast$: Observable<ProcessedForecast>;

  // Observable for current time (updates every second)
  cityTimestamp$: Observable<Date>;

  // 🔄 Loading state: Observable for HTTP request progress
  loading$: Observable<boolean>;

  // BehaviorSubject to manage theme state reactively
  private isDarkModeSubject = new BehaviorSubject<boolean>(true);
  isDarkMode$ = this.isDarkModeSubject.asObservable();

  // Subject for cleanup on component destroy
  private destroy$ = new Subject<void>();

  constructor(private weatherService: WeatherService) {
    // ============ COMPOSE MULTIPLE OBSERVABLE STREAMS ============

    // 1. Get weather data from service
    this.weather$ = this.weatherService.weather$;

    // 2. Create forecast processing stream
    // Combine forecast data with weather timezone to compute daily/hourly
    this.processedForecast$ = combineLatest([
      this.weatherService.forecast$,
      this.weather$
    ]).pipe(
      map(([forecast, weather]) => {
        if (!forecast || !weather) {
          return { daily: [], hourly: [] };
        }
        return this.processForecast(forecast.list);
      })
    );

    // 3. Create time update stream
    // Use interval and combineLatest to update time reactively based on timezone
    this.cityTimestamp$ = combineLatest([
      interval(1000).pipe(startWith(0)), // Update every second
      this.weather$
    ]).pipe(
      map(([_, weather]) => {
        if (weather && weather.timezone) {
          return this.calculateCityTime(weather.timezone);
        }
        return new Date();
      })
    );

    // 🔄 4. Get loading state from service
    this.loading$ = this.weatherService.loading$;
  }

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
    const newMode = !this.isDarkModeSubject.getValue();
    this.isDarkModeSubject.next(newMode);
    this.applyTheme(newMode);
  }

  // ============ REACTIVE SEARCH METHODS ============

  // Search by city name - delegates to service which handles it reactively
  searchCity(): void {
    if (!this.cityName.trim()) return;
    this.weatherService.searchByCity(this.cityName);
  }

  // Get geolocation and search by coordinates - delegates to service
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

