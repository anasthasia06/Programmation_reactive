// src/main.ts

import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { provideHttpClient } from '@angular/common/http';

bootstrapApplication(AppComponent, {
  // Fournit le client HTTP pour que WeatherService puisse être injecté
  providers: [
    provideHttpClient()
  ]
})
  .catch((err) => console.error(err));
