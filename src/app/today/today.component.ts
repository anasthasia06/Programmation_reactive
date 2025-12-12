/**
 * Composant Today - Affichage des données météorologiques
 * Ce composant gère l'affichage de la météo actuelle, des prévisions sur 5 jours
 * et des prévisions horaires avec différents modes de visualisation
 */

// Imports Angular core pour le cycle de vie du composant
import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

// Import du service météo personnalisé
import { WeatherService } from '../weather.service';

// Imports RxJS pour la gestion des observables et des subscriptions
import { Subscription, interval } from 'rxjs';
import { switchMap, startWith } from 'rxjs/operators';

/**
 * Interface pour les données météorologiques actuelles
 * Contient toutes les informations fournies par l'API OpenWeatherMap
 */
interface WeatherData {
  name: string;  // Nom de la ville
  sys: { country: string, sunrise: number, sunset: number };  // Système (pays, lever/coucher du soleil)
  main: { temp: number, feels_like: number, humidity: number, pressure: number };  // Données principales
  weather: [{ icon: string, description: string }];  // Conditions météo
  wind: { speed: number };  // Vitesse du vent
  timezone: number;  // Fuseau horaire en secondes depuis UTC
}

/**
 * Interface pour un élément de prévision
 * Utilisée pour les prévisions horaires et journalières
 */
interface ForecastItem {
  dt: number;  // Timestamp Unix de la prévision
  main: { temp: number };  // Température prévue
  weather: [{ icon: string }];  // Icône météo
  wind: { speed: number };  // Vitesse du vent
}

@Component({
  selector: 'app-today',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './today.component.html',
  styleUrls: ['./today.component.css']
})
export class TodayComponent implements OnInit, OnDestroy {
  // ====== Propriétés de données météo ======
  cityName: string = '';  // Nom de la ville recherchée
  weather: WeatherData | null = null;  // Données météo actuelles
  dailyForecast: ForecastItem[] = [];  // Prévisions sur 5 jours
  hourlyForecast: ForecastItem[] = [];  // Prévisions horaires (8 heures)
  cityTimestamp: Date = new Date();  // Heure actuelle de la ville sélectionnée

  // ====== Propriétés de configuration de l'interface ======
  isDarkMode: boolean = true;  // Mode sombre activé par défaut
  isGraphView: boolean = false;  // Vue par défaut en cartes (false = cartes, true = graphique)

  // ====== Subscriptions RxJS ======
  // Gestion des souscriptions pour éviter les fuites mémoire
  private timerSubscription: Subscription | undefined;  // Subscription pour l'horloge
  private weatherSubscription: Subscription | undefined;  // Subscription pour les appels API météo

  constructor(private weatherService: WeatherService) { }

  /**
   * Initialisation du composant au chargement
   * - Configure le thème
   * - Charge la météo par défaut (Londres)
   * - Démarre l'horloge en temps réel
   */
  ngOnInit(): void {
    // Applique le thème initial (sombre par défaut)
    this.setTheme();

    // Définit une ville par défaut pour l'affichage initial
    this.cityName = 'London';
    this.getWeatherByCity();

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
  }

  /**
   * Nettoyage lors de la destruction du composant
   * Désabonne toutes les subscriptions pour éviter les fuites mémoire
   */
  ngOnDestroy(): void {
    if (this.timerSubscription) {
      this.timerSubscription.unsubscribe();
    }
    if (this.weatherSubscription) {
      this.weatherSubscription.unsubscribe();
    }
  }

  // ====== GESTION DU THÈME ======

  /**
   * Applique le thème actuel (clair ou sombre) au body de la page
   */
  setTheme(): void {
    document.body.className = this.isDarkMode ? 'dark-theme' : 'light-theme';
  }

  /**
   * Bascule entre le mode sombre et le mode clair
   */
  toggleMode(): void {
    this.isDarkMode = !this.isDarkMode;
    this.setTheme();
  }

  /**
   * Bascule entre l'affichage en cartes et l'affichage en graphique
   * pour les prévisions sur 5 jours
   */
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
    return this.dailyForecast.map((item, index) => {
      const x = 50 + index * 100;  // Espacement horizontal de 100px entre chaque jour
      const y = this.getYPosition(item.main.temp);
      return `${x},${y}`;
    }).join(' ');
  }

  // ====== GESTION DU TEMPS ======

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

  // ====== RÉCUPÉRATION DES DONNÉES MÉTÉO ======

  /**
   * Récupère les données météo pour la ville spécifiée
   * Appelé lorsque l'utilisateur recherche une ville ou appuie sur Entrée
   */
  getWeatherByCity(): void {
    if (!this.cityName) return;  // Ne fait rien si le champ est vide

    this.weatherSubscription = this.weatherService.getWeatherDataByCityName(this.cityName)
      .subscribe({
        next: (response) => {
          this.weather = response;
          this.updateCityTime(response.timezone);
          // Récupère les prévisions avec les coordonnées de la ville
          this.getForecast(response.coord.lat, response.coord.lon);
        },
        error: (error) => {
          console.error('Error fetching weather data:', error);
          this.weather = null;  // Efface les données en cas d'erreur
          alert('City not found or API error. Please try again.');
        }
      });
  }

  /**
   * Utilise la géolocalisation du navigateur pour obtenir la position actuelle
   * Appelé lorsque l'utilisateur clique sur "Current Location"
   */
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
   * Traite les données de prévisions brutes de l'API
   * Sépare les prévisions en deux catégories:
   * - Prévisions journalières (5 jours)
   * - Prévisions horaires (8 prochaines heures)
   * @param list - Liste des prévisions brutes de l'API
   */
  processForecast(list: any[]): void {
    const dailyMap = new Map<string, ForecastItem>();  // Map pour éviter les doublons par jour
    this.hourlyForecast = [];

    const now = new Date();
    let hourlyCount = 0;

    for (const item of list) {
      const date = new Date(item.dt * 1000);
      const dateString = date.toISOString().split('T')[0];  // Format YYYY-MM-DD

      // 1. Traitement des prévisions sur 5 jours (une entrée par jour)
      // Prend la première prévision de chaque jour (ou celle proche de midi)
      if (!dailyMap.has(dateString)) {
         dailyMap.set(dateString, item);
      }

      // 2. Traitement des prévisions horaires (pour les prochaines heures)
      // Affiche les 8 prochaines heures de prévisions
      if (date.getTime() > now.getTime() && hourlyCount < 8) {
        this.hourlyForecast.push(item);
        hourlyCount++;
      }
    }

    // Convertit la Map en tableau et limite à 5 jours
    this.dailyForecast = Array.from(dailyMap.values()).slice(0, 5);
  }
}
