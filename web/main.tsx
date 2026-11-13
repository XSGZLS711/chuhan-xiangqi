import React from 'react';
import { createRoot } from 'react-dom/client';
import { installInkTouch } from '../lib/ink-touch';
import Home from '../app/page';
import { startServiceWorker } from '../lib/service-worker';
import { startTelemetry } from '../lib/telemetry';
import { LocaleProvider } from '../lib/use-locale';
import '../app/globals.css';
import '../app/patterns.css';
import '../app/polish.css';

startTelemetry('home');
startServiceWorker();

installInkTouch();
createRoot(document.getElementById('root')!).render(
  <LocaleProvider page="home">
    <Home />
  </LocaleProvider>,
);
