// src/app/weather.service.ts
// This service demonstrates RxJS reactive patterns:
// - BehaviorSubject for reactive state management
// - Operators: map, filter, shareReplay, catchError, takeUntil, finalize
// - Composition of multiple observable streams
// - HTTP request CANCELLATION via unsubscribe() and takeUntil()
// - Loading state management for request progress

import { Injectable, OnDestroy } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject, Subject } from 'rxjs';
import { map, shareReplay, catchError, debounceTime, distinctUntilChanged, switchMap, filter, takeUntil, finalize } from 'rxjs/operators';
import { of } from 'rxjs';

export interface WeatherData {
  name: string;
  sys: { country: string; sunrise: number; sunset: number };
  main: { temp: number; feels_like: number; humidity: number; pressure: number };
  weather: [{ icon: string; description: string }];
  wind: { speed: number };
  timezone: number;
  coord: { lat: number; lon: number };
}

export interface ForecastData {
  list: any[];
}

@Injectable({
  providedIn: 'root',
})
export class WeatherService implements OnDestroy {
  private readonly url = 'https://api.openweathermap.org/data/2.5/weather';
  private readonly forecastUrl = 'https://api.openweathermap.org/data/2.5/forecast';
  private readonly apiKey = 'a6ecc4e3bda67682ff663828ad8521f3';

  // ============ REACTIVE STATE MANAGEMENT ============
  // BehaviorSubject to manage current weather data as reactive state
  private weatherSubject = new BehaviorSubject<WeatherData | null>(null);
  public weather$ = this.weatherSubject.asObservable();

  // BehaviorSubject for forecast data
  private forecastSubject = new BehaviorSubject<ForecastData | null>(null);
  public forecast$ = this.forecastSubject.asObservable();

  // 🔄 LOADING STATE: BehaviorSubject to track HTTP request progress
  private loadingSubject = new BehaviorSubject<boolean>(false);
  public loading$ = this.loadingSubject.asObservable();

  // Subject for city search input (will be used with debounceTime)
  private citySearchSubject = new Subject<string>();
  public citySearch$ = this.citySearchSubject.asObservable().pipe(
    debounceTime(500), // Wait 500ms after user stops typing
    distinctUntilChanged(), // Only process if value actually changed
    filter((city: string) => city.trim().length > 0)
  );

  // Subject for coordinates search
  private coordsSearchSubject = new Subject<{ lat: number; lon: number }>();
  public coordsSearch$ = this.coordsSearchSubject.asObservable().pipe(
    distinctUntilChanged((prev, curr) => prev.lat === curr.lat && prev.lon === curr.lon)
  );

  // 🔪 CANCELLATION: Subject to trigger cleanup of all active subscriptions
  private destroy$ = new Subject<void>();

  constructor(private http: HttpClient) {
    this.setupReactiveStreams();
  }

  // ============ SETUP REACTIVE STREAMS ============
  // This demonstrates:
  // 1. Composition of observables using RxJS operators
  // 2. HTTP request CANCELLATION via takeUntil()
  // 3. Loading state management via finalize()
  private setupReactiveStreams(): void {
    // When city search changes, fetch weather data
    this.citySearch$
      .pipe(
        switchMap((city: string) => {
          this.loadingSubject.next(true); // 🔄 START loading
          return this.getWeatherDataByCityName(city).pipe(
            // finalize: ALWAYS runs (success or error) - perfect for cleanup
            finalize(() => this.loadingSubject.next(false)), // 🔄 STOP loading
            catchError(error => {
              console.error('Error fetching weather for city:', error);
              return of(null);
            })
          );
        }),
        // Only emit non-null weather data
        filter((data: WeatherData | null) => data !== null),
        // 🔪 CANCELLATION: takeUntil will automatically unsubscribe and CANCEL pending HTTP requests
        takeUntil(this.destroy$)
      )
      .subscribe((weather: any) => {
        this.weatherSubject.next(weather as WeatherData);
        // Automatically fetch forecast when weather changes
        if (weather) {
          this.fetchForecast(weather.coord.lat, weather.coord.lon);
        }
      });

    // When coordinates change, fetch weather data
    this.coordsSearch$
      .pipe(
        switchMap(coords => {
          this.loadingSubject.next(true); // 🔄 START loading
          return this.getWeatherDataByCoords(coords.lat, coords.lon).pipe(
            finalize(() => this.loadingSubject.next(false)), // 🔄 STOP loading
            catchError(error => {
              console.error('Error fetching weather for coords:', error);
              return of(null);
            })
          );
        }),
        filter((data: WeatherData | null) => data !== null),
        // 🔪 CANCELLATION: takeUntil will automatically unsubscribe and CANCEL pending HTTP requests
        takeUntil(this.destroy$)
      )
      .subscribe((weather: any) => {
        this.weatherSubject.next(weather as WeatherData);
        // Automatically fetch forecast when weather changes
        if (weather) {
          this.fetchForecast(weather.coord.lat, weather.coord.lon);
        }
      });
  }

  // ============ PUBLIC METHODS - TRIGGER REACTIVE STREAMS ============

  // Trigger city search through Subject
  searchByCity(cityName: string): void {
    this.citySearchSubject.next(cityName);
  }

  // Trigger coordinates search through Subject
  searchByCoords(lat: number, lon: number): void {
    this.coordsSearchSubject.next({ lat, lon });
  }

  // ============ PRIVATE API METHODS ============

  // 1. Search by Coordinates (Current Weather)
  getWeatherDataByCoords(lat: number, lon: number): Observable<WeatherData> {
    let params = new HttpParams()
      .set('lat', lat)
      .set('lon', lon)
      .set('units', 'metric')
      .set('appid', this.apiKey);

    return this.http.get<WeatherData>(this.url, { params }).pipe(
      // Map: transform the response if needed
      map(data => ({
        ...data,
        // Ensure required fields exist
        timezone: data.timezone || 0,
      })),
      // ShareReplay: cache the result and share among multiple subscribers
      shareReplay(1),
      catchError(error => {
        console.error('Weather API error (coords):', error);
        throw error;
      })
    );
  }

  // 2. Search by City Name (Current Weather)
  getWeatherDataByCityName(cityName: string): Observable<WeatherData> {
    let params = new HttpParams()
      .set('q', cityName)
      .set('units', 'metric')
      .set('appid', this.apiKey);

    return this.http.get<WeatherData>(this.url, { params }).pipe(
      map(data => ({
        ...data,
        timezone: data.timezone || 0,
      })),
      shareReplay(1),
      catchError(error => {
        console.error('Weather API error (city):', error);
        throw error;
      })
    );
  }

  // 3. Fetch and update forecast data
  private fetchForecast(lat: number, lon: number): void {
    this.getForecastDataByCoords(lat, lon)
      .pipe(
        catchError(error => {
          console.error('Error fetching forecast:', error);
          return of(null);
        })
      )
      .subscribe(forecast => {
        if (forecast) {
          this.forecastSubject.next(forecast);
        }
      });
  }

  // 4. Retrieves 5-day/3-hour forecast
  getForecastDataByCoords(lat: number, lon: number): Observable<ForecastData> {
    let params = new HttpParams()
      .set('lat', lat)
      .set('lon', lon)
      .set('units', 'metric')
      .set('appid', this.apiKey);

    return this.http.get<ForecastData>(this.forecastUrl, { params }).pipe(
      // Filter: only process if list exists and has data
      filter((data: any) => data && data.list && data.list.length > 0),
      shareReplay(1),
      catchError(error => {
        console.error('Forecast API error:', error);
        throw error;
      })
    );
  }

  // ============ GETTERS FOR STATE ============
  getCurrentWeather(): WeatherData | null {
    return this.weatherSubject.getValue();
  }

  getCurrentForecast(): ForecastData | null {
    return this.forecastSubject.getValue();
  }

  // ============ LIFECYCLE CLEANUP ============
  // 🔪 CANCELLATION PATTERN: Implement OnDestroy to automatically cancel all pending HTTP requests
  // When service is destroyed, destroy$ emits, triggering takeUntil() on all subscriptions
  ngOnDestroy(): void {
    console.log('WeatherService destroyed - cancelling all pending HTTP requests');
    this.destroy$.next();
    this.destroy$.complete();
  }
}
