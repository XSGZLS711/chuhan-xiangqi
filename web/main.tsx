import React from 'react';
import { createRoot } from 'react-dom/client';
import Home from '../app/page';
import { startTelemetry } from '../lib/telemetry';
import { LocaleProvider } from '../lib/use-locale';
import '../app/globals.css';

startTelemetry('home');

createRoot(document.getElementById('root')!).render(
  <LocaleProvider page="home">
    <Home />
  </LocaleProvider>,
);
