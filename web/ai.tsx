import React from 'react';
import { createRoot } from 'react-dom/client';
import AiGame from '../components/ai-game';
import { startServiceWorker } from '../lib/service-worker';
import { startTelemetry } from '../lib/telemetry';
import { LocaleProvider } from '../lib/use-locale';
import '../app/globals.css';
import '../app/ai.css';
import '../app/review.css';

startTelemetry('ai');
startServiceWorker();

createRoot(document.getElementById('root')!).render(
  <LocaleProvider page="ai">
    <AiGame />
  </LocaleProvider>,
);
