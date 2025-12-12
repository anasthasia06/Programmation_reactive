// src/app/today/today.component.ts
// This component demonstrates reactive programming with RxJS:
// - Using async pipe for automatic subscription management
// - Observables and reactive state via BehaviorSubject
// - Composition of multiple streams with combineLatest
// - OnDestroy cleanup (fallback for non-observable resources)

import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WeatherService, ForecastData } from '../weather.service';
import { Observable, BehaviorSubject, combineLatest, Subject, interval, Subscription } from 'rxjs';
import { map, takeUntil, startWith, switchMap } from 'rxjs/operators';


interface WeatherData {
  name: string;  // Nom de la ville
  sys: { country: string, sunrise: number, sunset: number };  // Système (pays, lever/coucher du soleil)
  main: { temp: number, feels_like: number, humidity: number, pressure: number };  // Données principales
  weather: [{ icon: string, description: string }];  // Conditions météo
  wind: { speed: number };  // Vitesse du vent
  timezone: number;  // Fuseau horaire en secondes depuis UTC
}

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
  gridLines = [0, 1, 2, 3, 4];
  isDarkMode: boolean = true; // Default to dark mode
  isGraphView: boolean = false;  // Vue par défaut en cartes (false = cartes, true = graphique)

  private timerSubscription: Subscription | undefined;
  private weatherSubscription: Subscription | undefined;

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

    this.weatherService.forecast$.subscribe(forecast => {
      console.log('Forecast data:', forecast);
    });

    this.weatherService.weather$.subscribe(weather => {
      console.log('Weather data:', weather);
    });
  }

  ngOnInit(): void {
    // Set initial theme
    this.applyTheme(this.isDarkModeSubject.getValue());

    // Default to London
    this.cityName = 'London';
    this.getWeatherByCity();
    this.searchCity();

    // Démarre une horloge qui se met à jour chaque seconde
    this.timerSubscription = interval(1000)
      .pipe(startWith(0))  // Démarre immédiatement
      .subscribe(() => {
        if (this.weather) {
          // Met à jour l'heure selon le fuseau horaire de la ville
          this.updateCityTime(this.weather.timezone);
        } else {
          // Utilise l'heure locale si pas de données météo
          this.cityTimestamp = new Date();
        }
      });

      console.log('Initial dailyForecast:', this.dailyForecast);
  }

  ngOnDestroy(): void {
    // Complete the destroy subject to unsubscribe all observables using takeUntil
    if (this.timerSubscription) {
      this.timerSubscription.unsubscribe();
    }
    if (this.weatherSubscription) {
      this.weatherSubscription.unsubscribe();
    }
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

  toggleForecastView(): void {
    this.isGraphView = !this.isGraphView;
  }
    // ====== CALCULS POUR LE GRAPHIQUE SVG ======

  /**
   * Calcule la température maximale parmi les prévisions sur 5 jours
   * @returns La température maximale ou 30 par défaut
   */
  getMaxTemp(): number {
    if (this.dailyForecast.length === 0) return 30;
    return Math.max(...this.dailyForecast.map(item => item.main.temp));
  }

  /**
   * Calcule la température minimale parmi les prévisions sur 5 jours
   * @returns La température minimale ou 0 par défaut
   */
  getMinTemp(): number {
    if (this.dailyForecast.length === 0) return 0;
    return Math.min(...this.dailyForecast.map(item => item.main.temp));
  }

  /**
   * Convertit une température en position Y sur le graphique SVG
   * @param temp - La température à convertir
   * @returns Position Y entre 50 et 250 (inversé car Y SVG croît vers le bas)
   */
  getYPosition(temp: number): number {
    const maxTemp = this.getMaxTemp();
    const minTemp = this.getMinTemp();
    const range = maxTemp - minTemp || 10;  // Évite la division par zéro

    // Mappe la température sur l'axe Y (50-250px)
    // Soustraction car en SVG, Y=0 est en haut et Y augmente vers le bas
    return 250 - ((temp - minTemp) / range * 200);
  }

  /**
   * Génère les points de la courbe pour le graphique SVG
   * @returns Chaîne de coordonnées "x1,y1 x2,y2 x3,y3..." pour l'élément polyline
   */
  getGraphPoints(): string {
    if (this.dailyForecast.length === 0) return '';
    const points = this.dailyForecast.map((item, index) => {
      const x = 50 + index * 100; // Espacement horizontal
      const y = this.getYPosition(item.main.temp); // Position Y
      return `${x},${y}`;
    }).join(' ');
  
    console.log('Graph points:', points);
    return points;
  }

    // --- Time Management ---

   /**
   * Met à jour l'heure affichée selon le fuseau horaire de la ville
   * @param timezoneOffsetSeconds - Décalage horaire en secondes depuis UTC
   */
   updateCityTime(timezoneOffsetSeconds: number): void {
    const localTime = new Date();
    // Calcule l'heure UTC en millisecondes
    const utcTime = localTime.getTime() + (localTime.getTimezoneOffset() * 60000);
    // Applique le décalage horaire de la ville
    this.cityTimestamp = new Date(utcTime + (timezoneOffsetSeconds * 1000));
  }

  getWeatherByCity(): void {
    if (!this.cityName) return;
  // ============ REACTIVE SEARCH METHODS ============
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

    this.dailyForecast = Array.from(dailyMap.values()).slice(0, 5);
    return {
      daily: Array.from(dailyMap.values()).slice(0, 5),
      hourly: hourlyForecast
    };
  }

  /**
   * Récupère les données météo à partir de coordonnées GPS
   * @param lat - Latitude
   * @param lon - Longitude
   */
  getWeatherByCoords(lat: number, lon: number): void {
    this.weatherSubscription = this.weatherService.getWeatherDataByCoords(lat, lon)
      .subscribe({
        next: (response) => {
          this.weather = response;
          this.cityName = response.name;  // Met à jour le champ de recherche avec le nom de la ville
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

  // ====== TRAITEMENT DES PRÉVISIONS ======

  /**
   * Récupère les données de prévisions à partir de coordonnées
   * @param lat - Latitude
   * @param lon - Longitude
   */
  getForecast(lat: number, lon: number): void {
    this.weatherService.getForecastDataByCoords(lat, lon)
      .subscribe({
        next: (response: any) => {
          this.processForecast(response.list);  // Traite les données brutes
        },
        error: (error) => {
          console.error('Error fetching forecast data:', error);
        }
      });
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

