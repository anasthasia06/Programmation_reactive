import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

interface ForecastItem {
  dt: number;
  main: { temp: number, temp_max?: number, temp_min?: number, humidity: number, pressure: number };
  weather: [{ icon: string, description: string }];
  wind: { speed: number };
}

@Component({
  selector: 'app-daily-forecast',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './daily-forecast.component.html',
  styleUrls: ['./daily-forecast.component.css']
})
export class DailyForecastComponent {
  @Input() dailyForecast: ForecastItem[] = [];
  isGraphView: boolean = false;

  toggleForecastView(): void {
    this.isGraphView = !this.isGraphView;
  }

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

  getGraphPointsMax(): string {
    if (this.dailyForecast.length === 0) return '';
    const points = this.dailyForecast.map((item, index) => {
      const x = 50 + index * 100;
      const y = this.getYPosition(item.main.temp_max || item.main.temp);
      return `${x},${y}`;
    }).join(' ');
    return points;
  }

  getGraphPointsMin(): string {
    if (this.dailyForecast.length === 0) return '';
    const points = this.dailyForecast.map((item, index) => {
      const x = 50 + index * 100;
      const y = this.getYPosition(item.main.temp_min || item.main.temp);
      return `${x},${y}`;
    }).join(' ');
    return points;
  }
}
