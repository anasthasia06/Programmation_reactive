import { bootstrapApplication } from '@angular/platform-browser';
import { enableProdMode } from '@angular/core';
import { TodayComponent } from './app/today/today.component';

// Basic prod check (works in many toolchains) - safe fallback
try {
  // @ts-ignore
  if ((import.meta as any).env && (import.meta as any).env.PROD) {
    enableProdMode();
  }
} catch (e) {
  /* ignore */
}

bootstrapApplication(TodayComponent).catch(err => console.error(err));
