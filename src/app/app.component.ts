// src/app/app.component.ts

import { Component, signal } from '@angular/core';
import { TodayComponent } from './today/today.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [TodayComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  protected readonly title = signal('openWeather');
}
