// src/app/today/today.component.ts

import { Component, OnInit } from '@angular/core';
import { WeatherService } from '../weather.service';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-today',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './today.component.html',
  styleUrl: './today.component.css',
})
export class TodayComponent implements OnInit {

  public readonly Date = Date;

  lat: number | undefined;
  lon: number | undefined;
  weather: any;
  forecast: any;
  cityName: string = '';
  dailyForecast: any[] = [];
  hourlyForecast: any[] = [];
  cityTimestamp: number = Date.now();

  isDarkMode: boolean = true;

  constructor(private weatherService: WeatherService){}

  ngOnInit() {
    this.applyTheme();
    this.getLocation();
  }

  toggleMode() {
    this.isDarkMode = !this.isDarkMode;
    this.applyTheme();
  }

  applyTheme() {
    if (this.isDarkMode) {
        document.body.classList.add('dark-theme');
        document.body.classList.remove('light-theme');
    } else {
        document.body.classList.add('light-theme');
        document.body.classList.remove('dark-theme');
    }
  }

  getLocation() {
    if ("geolocation" in navigator) {
      navigator.geolocation.watchPosition((success) => {
        this.lat = success.coords.latitude;
        this.lon = success.coords.longitude;
        if (this.lat && this.lon) {
          this.fetchWeatherData(this.lat, this.lon);
        }
      });
    } else {
      console.warn("La géolocalisation n'est pas supportée. Veuillez utiliser la barre de recherche.");
    }
  }

  fetchWeatherData(lat: number, lon: number) {
    this.weatherService.getWeatherDataByCoords(lat, lon).subscribe({
      next: (data: any) => {
        this.weather = data;
        this.cityName = data.name;

        // Calcul de l'heure locale de la ville
        const localUtc = Date.now() + (new Date().getTimezoneOffset() * 60000);
        const targetCityMs = localUtc + (data.timezone * 1000);
        this.cityTimestamp = targetCityMs;
      },
      error: (err) => { console.error("Erreur météo actuelle:", err); }
    });

    this.weatherService.getForecastDataByCoords(lat, lon).subscribe({
      next: (data: any) => {
        this.forecast = data;

        this.hourlyForecast = data.list.slice(0, 5);

        const filteredDays: any[] = [];
        for (let i = 0; i < data.list.length; i += 8) {
            filteredDays.push(data.list[i + 4] || data.list[i]);
        }
        this.dailyForecast = filteredDays.slice(0, 5);
      },
      error: (err) => { console.error("Erreur prévisions:", err); }
    });
  }

  getWeatherByCity() {
    if (this.cityName) {
      this.weatherService.getWeatherDataByCityName(this.cityName).subscribe({
        next: (data: any) => {
          this.fetchWeatherData(data.coord.lat, data.coord.lon);
        },
        error: (err) => {
          console.error("Ville non trouvée ou erreur :", err);
          alert("Ville non trouvée ou erreur de connexion.");
          this.weather = null;
          this.forecast = null;
        }
      });
    }
  }
}
