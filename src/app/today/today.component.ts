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
import { map, takeUntil, startWith, switchMap, tap } from 'rxjs/operators'; // <-- AJOUT de 'tap'


interface WeatherData {
  name: string;  // Nom de la ville
  sys: { country: string, sunrise: number, sunset: number };  // Système (pays, lever/coucher du soleil)
  main: { temp: number, feels_like: number, humidity: number, pressure: number };  // Données principales
  weather: [{ icon: string, description: string }];  // Conditions météo
  wind: { speed: number };  // Vitesse du vent
  timezone: number;  // Fuseau horaire en secondes depuis UTC
  coord: { lat: number, lon: number };
}

interface ForecastItem {
  dt: number;
  main: { temp: number, temp_max?: number, temp_min?: number, humidity: number, pressure: number };
  weather: [{ icon: string, description: string }];
  wind: { speed: number };
}

interface ProcessedForecast {
  daily: ForecastItem[];
  hourly: ForecastItem[];
}

interface GraphDataPoint {
    time: number; // dt * 1000
    value: number;
    icon?: string;
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
  gridLines = [0, 1, 2, 3, 4];
  isDarkMode: boolean = true;
  isGraphView: boolean = false;  
 
  // PROPRIÉTÉS POUR LA DYNAMIQUE DES GRAPHIQUES
  selectedDataType: 'temp' | 'humidity' | 'wind' | 'pressure' = 'temp';
  isModalOpen: boolean = false;
  modalTitle: string = '';

  private timerSubscription: Subscription | undefined;
  private weatherSubscription: Subscription | undefined;

  // Observable streams
  weather$: Observable<WeatherData | null>;
  processedForecast$: Observable<ProcessedForecast>;
  cityTimestamp$: Observable<Date>;
  loading$: Observable<boolean>;

  private isDarkModeSubject = new BehaviorSubject<boolean>(true);
  isDarkMode$ = this.isDarkModeSubject.asObservable();

  private destroy$ = new Subject<void>();

  constructor(private weatherService: WeatherService) {
    // Setup reactive data streams
    this.weather$ = this.weatherService.weather$.pipe(
        // Utilise tap pour mettre à jour cityName dans le composant chaque fois que de nouvelles données arrivent
        tap(weather => {
            if (weather) {
                this.cityName = weather.name;
            }
        })
    );
    this.processedForecast$ = combineLatest([
      this.weatherService.forecast$,
      this.weather$
    ]).pipe(
      map(([forecast, weather]) => {
        if (!forecast || !weather) {
          return { daily: [], hourly: [] };
        }
        const processed = this.processForecast(forecast.list);
        this.dailyForecast = processed.daily;
        this.hourlyForecast = processed.hourly;
        return processed;
      })
    );

    this.cityTimestamp$ = combineLatest([
      interval(1000).pipe(startWith(0)),
      this.weather$
    ]).pipe(
      map(([_, weather]) => {
        if (weather && weather.timezone) {
          return this.calculateCityTime(weather.timezone);
        }
        return new Date();
      })
    );

    this.loading$ = this.weatherService.loading$;
  }

  ngOnInit(): void {
    this.applyTheme(this.isDarkModeSubject.getValue());
   
    // Tente de charger la localisation actuelle au démarrage
    // this.getLocation();

    this.timerSubscription = interval(1000)
      .pipe(startWith(0))
      .subscribe(() => {
        if (this.weather) {
          this.cityTimestamp = this.calculateCityTime(this.weather.timezone);
        } else {
          this.cityTimestamp = new Date();
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
    this.destroy$.next();
    this.destroy$.complete();
  }


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
    /**
     * Bascule la vue du graphique horaire entre les différents types de données.
     * Si ce n'est pas la température, ouvre la modal.
     */
    selectDataView(type: 'temp' | 'humidity' | 'wind' | 'pressure'): void {
        this.selectedDataType = type;

        if (type !== 'temp') {
            this.isModalOpen = true;
            if (type === 'humidity') this.modalTitle = 'Humidity predictions hour by hour';
            if (type === 'wind') this.modalTitle = 'Wind predictions hour by hour';
            if (type === 'pressure') this.modalTitle = 'Pressure predictions hour by hour';

        } else {
            // Si l'utilisateur clique sur la température, on ferme la modal (si elle était ouverte)
            this.isModalOpen = false;
        }
    }

    /**
     * Ferme la modal et réinitialise le graphique principal à la température.
     */
    closeModal(): void {
        this.isModalOpen = false;
        // Réinitialiser le graphique principal pour qu'il affiche la température après fermeture
        this.selectedDataType = 'temp';
    }

  // ====== CALCULS POUR LE GRAPHIQUE SVG (Hourly) ======

    /**
     * Prépare les données pour le graphique horaire en fonction du type sélectionné.
     */
    getHourlyDataPoints(): GraphDataPoint[] {
        if (!this.hourlyForecast || this.hourlyForecast.length === 0) return [];

        return this.hourlyForecast.map(item => {
            let value: number;
            let icon: string | undefined = undefined;

            if (this.selectedDataType === 'temp') {
                value = item.main.temp;
                icon = item.weather[0].icon;
            } else if (this.selectedDataType === 'humidity') {
                value = item.main.humidity;
            } else if (this.selectedDataType === 'wind') {
                value = item.wind.speed;
            } else if (this.selectedDataType === 'pressure') {
                value = item.main.pressure;
            } else {
                value = 0;
            }

            return {
                time: item.dt * 1000,
                value: value,
                icon: icon
            };
        });
    }

    /**
     * Calcule le minimum/maximum pour l'échelle du graphique en fonction des données sélectionnées.
     */
    getMinMaxValues(data: GraphDataPoint[]): { min: number, max: number, unit: string, factor: number } {
        if (data.length === 0) {
            return { min: 0, max: 10, unit: '', factor: 1 };
        }

        const values = data.map(p => p.value);
        let min = Math.min(...values);
        let max = Math.max(...values);
        let unit = '';

        const hasRange = max > min;

        if (this.selectedDataType === 'temp') {
            unit = '°C';
            min = min - 1.5;
            max = max + 1.5;
        } else if (this.selectedDataType === 'humidity') {
            unit = '%';
            if (!hasRange) {
                min = Math.max(min - 5, 0);
                max = Math.min(max + 5, 100);
            } else {
                min = Math.max(min - 5, 0);
                max = Math.min(max + 5, 100);
            }
        } else if (this.selectedDataType === 'wind') {
            unit = ' km/h';
            if (!hasRange) {
                min = Math.max(min - 2, 0);
                max = max + 2;
            } else {
                min = Math.max(min - 1, 0);
                max = max + 2;
            }
        } else if (this.selectedDataType === 'pressure') {
            unit = ' hPa';
            if (!hasRange) {
                min = min - 3;
                max = max + 3;
            } else {
                min = min - 3;
                max = max + 3;
            }
        }

        if (max <= min) {
            max = min + 10;
        }

        return { min, max, unit, factor: 1 };
    }

    /**
     * Génère la position Y pour le graphique horaire (fonction générique)
     */
    getHourlyYPosition(value: number): number {
        const { min, max } = this.getMinMaxValues(this.getHourlyDataPoints());
        const range = max - min || 10;

        // Mappe la valeur sur l'axe Y (50-270px)
        return 270 - ((value - min) / range * 220);
    }

    /**
     * Calcule la position X pour un point horaire spécifique
     */
    getHourlyXPosition(index: number): number {
        const pointsCount = this.getHourlyDataPoints().length;
        const totalWidth = 1100; // L'espace total pour la courbe (1200 - 50 de chaque côté)
        const spacing = totalWidth / (pointsCount - 1 || 1);
        return 50 + index * spacing;
    }

    /**
     * Génère les points de la courbe pour le graphique horaire (POLYLINE)
     */
    getHourlyGraphPoints(): string {
        const points = this.getHourlyDataPoints();
        // Le graphique nécessite au moins 2 points pour tracer une ligne
        if (points.length < 2) return '';

        return points.map((point, index) => {
            const x = this.getHourlyXPosition(index);
            const y = this.getHourlyYPosition(point.value);
            return `${x},${y}`;
        }).join(' ');
    }

    /**
     * Génère la chaîne de points pour la zone remplie (POLYGON)
     */
    getHourlyGraphPolygonPoints(): string {
        const linePoints = this.getHourlyGraphPoints();
        const points = this.getHourlyDataPoints();

        if (!linePoints || points.length < 2) return '';

        const allPoints = linePoints.split(' ');

        const firstX = allPoints[0].split(',')[0];
        const lastX = allPoints[allPoints.length - 1].split(',')[0];

        const bottomY = 320; // Coordonnée Y du bas du graphique

        return `${linePoints} ${lastX},${bottomY} ${firstX},${bottomY}`;
    }

    /**
     * Formate la valeur du label pour le graphique (ajoute l'unité)
     */
    formatGraphLabel(value: number): string {
        const { unit } = this.getMinMaxValues(this.getHourlyDataPoints());
        // Arrondir différemment pour le vent
        return `${value.toFixed(this.selectedDataType === 'wind' ? 1 : 0)}${unit}`;
    }


    // ====== CALCULS POUR LE GRAPHIQUE SVG (Daily) ======

  getMaxTemp(): number {
    if (this.dailyForecast.length === 0) return 30;
    return Math.max(...this.dailyForecast.map(item => item.main.temp_max || item.main.temp));
  }

  getMinTemp(): number {
    if (this.dailyForecast.length === 0) return 0;
    return Math.min(...this.dailyForecast.map(item => item.main.temp_min || item.main.temp));
  }

  getYPosition(temp: number): number {
    const maxTemp = this.getMaxTemp();
    const minTemp = this.getMinTemp();
    const range = maxTemp - minTemp || 10;

    return 250 - ((temp - minTemp) / range * 200);
  }

  getGraphPoints(): string {
    if (this.dailyForecast.length === 0) return '';
    const points = this.dailyForecast.map((item, index) => {
      const x = 50 + index * 100;
      const y = this.getYPosition(item.main.temp);
      return `${x},${y}`;
    }).join(' ');

    return points;
  }

  // Nouvelle méthode pour la courbe des températures maximales (rouge)
  getGraphPointsMax(): string {
    if (this.dailyForecast.length === 0) return '';
    const points = this.dailyForecast.map((item, index) => {
      const x = 50 + index * 100;
      const y = this.getYPosition(item.main.temp_max || item.main.temp);
      return `${x},${y}`;
    }).join(' ');
    return points;
  }

  // Nouvelle méthode pour la courbe des températures minimales (bleu)
  getGraphPointsMin(): string {
    if (this.dailyForecast.length === 0) return '';
    const points = this.dailyForecast.map((item, index) => {
      const x = 50 + index * 100;
      const y = this.getYPosition(item.main.temp_min || item.main.temp);
      return `${x},${y}`;
    }).join(' ');
    return points;
  }

  searchCity(): void {
    if (!this.cityName.trim()) return;
    this.weatherService.searchByCity(this.cityName);
  }

  getLocation(): void {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          // Utilise la méthode réactive du service pour lancer la recherche
          this.weatherService.searchByCoords(latitude, longitude);
        },
        (error) => {
          console.error('Geolocation error:', error);
        }
      );
    } else {
      alert('Geolocation is not supported by this browser.');
    }
  }

  private processForecast(list: any[]): ProcessedForecast {
    const dailyMap = new Map<string, any[]>(); // Stocker tous les items par jour
    const hourlyForecast: ForecastItem[] = [];

    const now = new Date();
    let hourlyCount = 0;

    // Grouper tous les éléments par jour
    for (const item of list) {
      const date = new Date(item.dt * 1000);
      const dateString = date.toISOString().split('T')[0];

      if (!dailyMap.has(dateString)) {
        dailyMap.set(dateString, []);
      }
      dailyMap.get(dateString)!.push(item);

      if (date.getTime() > now.getTime() && hourlyCount < 8) {
        hourlyForecast.push(item);
        hourlyCount++;
      }
    }

    // Calculer les min/max pour chaque jour
    this.dailyForecast = Array.from(dailyMap.entries())
      .slice(0, 5)
      .map(([dateString, items]) => {
        const temps = items.map(item => item.main.temp);
        const maxTemp = Math.max(...temps);
        const minTemp = Math.min(...temps);

        // Utiliser le premier item comme base et ajouter les min/max calculés
        const baseItem = items[0];
        return {
          ...baseItem,
          main: {
            ...baseItem.main,
            temp_max: maxTemp,
            temp_min: minTemp
          }
        };
      });

    this.hourlyForecast = hourlyForecast;

    return {
      daily: this.dailyForecast,
      hourly: this.hourlyForecast
    };
  }
  getForecast(lat: number, lon: number): void {
    // Ce bloc n'est plus nécessaire car le service gère le fetchForecast via switchMap dans setupReactiveStreams
    // Cependant, si vous gardez une ancienne implémentation, assurez-vous qu'elle soit réactive.
    // Pour le code actuel, on se base sur la logique du service qui est mieux.
  }

  private calculateCityTime(timezoneOffsetSeconds: number): Date {
    const localTime = new Date();
    const utcTime = localTime.getTime() + (localTime.getTimezoneOffset() * 60000);
    return new Date(utcTime + (timezoneOffsetSeconds * 1000));
  }
}
