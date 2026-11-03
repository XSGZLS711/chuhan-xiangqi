import React from 'react';
import { createRoot } from 'react-dom/client';
import Home from '../app/page';
import { LocaleProvider } from '../lib/use-locale';
import '../app/globals.css';

createRoot(document.getElementById('root')!).render(
  <LocaleProvider page="home">
    <Home />
  </LocaleProvider>,
);
