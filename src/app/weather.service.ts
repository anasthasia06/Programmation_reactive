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

  // 1. Search by Coordinates (Current Weather)
  getWeatherDataByCoords(lat: number, lon: number): Observable<any> {
    let params = new HttpParams()
      .set('lat', lat)
      .set('lon', lon)
      .set('units', 'metric') // <-- CHANGE HERE (metric = Celsius)
      .set('appid', this.apiKey);

    return this.http.get(this.url, { params });
  }

  // 2. Search by City Name (Current Weather)
  getWeatherDataByCityName(cityName: string): Observable<any> {
    let params = new HttpParams()
      .set('q', cityName)
      .set('units', 'metric') // <-- CHANGE HERE (metric = Celsius)
      .set('appid', this.apiKey);

    return this.http.get(this.url, { params });
  }

  // 3. Retrieves 5-day/3-hour forecast
  getForecastDataByCoords(lat: number, lon: number): Observable<any> {
    let params = new HttpParams()
      .set('lat', lat)
      .set('lon', lon)
      .set('units', 'metric') // <-- CHANGE HERE (metric = Celsius)
      .set('appid', this.apiKey);

    // Endpoint for forecast
    return this.http.get('https://api.openweathermap.org/data/2.5/forecast', { params });
  }
}
