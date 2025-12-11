// src/app/weather.service.ts

import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class WeatherService {
  url = 'https://api.openweathermap.org/data/2.5/weather';
  apiKey = 'a6ecc4e3bda67682ff663828ad8521f3';

  constructor(private http: HttpClient) {}

  // 1. Recherche par coordonnées (Météo actuelle)
  getWeatherDataByCoords(lat: number, lon: number): Observable<any> {
    let params = new HttpParams()
      .set('lat', lat)
      .set('lon', lon)
      .set('units', 'metric') // <-- CHANGEMENT ICI (metric = Celsius)
      .set('appid', this.apiKey);

    return this.http.get(this.url, { params });
  }

  // 2. Recherche par nom de ville (Météo actuelle)
  getWeatherDataByCityName(cityName: string): Observable<any> {
    let params = new HttpParams()
      .set('q', cityName)
      .set('units', 'metric') // <-- CHANGEMENT ICI (metric = Celsius)
      .set('appid', this.apiKey);

    return this.http.get(this.url, { params });
  }

  // 3. Récupère la prévision pour 5 jours/3 heures
  getForecastDataByCoords(lat: number, lon: number): Observable<any> {
    let params = new HttpParams()
      .set('lat', lat)
      .set('lon', lon)
      .set('units', 'metric') // <-- CHANGEMENT ICI (metric = Celsius)
      .set('appid', this.apiKey);

    // Endpoint pour les prévisions
    return this.http.get('https://api.openweathermap.org/data/2.5/forecast', { params });
  }
}
