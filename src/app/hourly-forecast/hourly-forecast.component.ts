import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

interface ForecastItem {
  dt: number;
  main: { temp: number, temp_max?: number, temp_min?: number, humidity: number, pressure: number };
  weather: [{ icon: string, description: string }];
  wind: { speed: number };
}

interface GraphDataPoint {
  time: number;
  value: number;
  icon?: string;
}

@Component({
  selector: 'app-hourly-forecast',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './hourly-forecast.component.html',
  styleUrls: ['./hourly-forecast.component.css']
})
export class HourlyForecastComponent {
  @Input() hourlyForecast: ForecastItem[] = [];
  @Input() selectedDataType: 'temp' | 'humidity' | 'wind' | 'pressure' = 'temp';

  // Toggle between table (default) and graph view
  isGraphView: boolean = false;

  toggleView(): void {
    this.isGraphView = !this.isGraphView;
  }

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

  getHourlyYPosition(value: number): number {
    const { min, max } = this.getMinMaxValues(this.getHourlyDataPoints());
    const range = max - min || 10;
    return 270 - ((value - min) / range * 220);
  }

  getHourlyXPosition(index: number): number {
    const pointsCount = this.getHourlyDataPoints().length;
    const totalWidth = 1100;
    const spacing = totalWidth / (pointsCount - 1 || 1);
    return 50 + index * spacing;
  }

  getHourlyGraphPoints(): string {
    const points = this.getHourlyDataPoints();
    if (points.length < 2) return '';

    return points.map((point, index) => {
      const x = this.getHourlyXPosition(index);
      const y = this.getHourlyYPosition(point.value);
      return `${x},${y}`;
    }).join(' ');
  }

  getHourlyGraphPolygonPoints(): string {
    const linePoints = this.getHourlyGraphPoints();
    const points = this.getHourlyDataPoints();

    if (!linePoints || points.length < 2) return '';

    const allPoints = linePoints.split(' ');
    const firstX = allPoints[0].split(',')[0];
    const lastX = allPoints[allPoints.length - 1].split(',')[0];
    const bottomY = 320;

    return `${linePoints} ${lastX},${bottomY} ${firstX},${bottomY}`;
  }

  formatGraphLabel(value: number): string {
    const { unit } = this.getMinMaxValues(this.getHourlyDataPoints());
    return `${value.toFixed(this.selectedDataType === 'wind' ? 1 : 0)}${unit}`;
  }
}
