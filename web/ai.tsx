import React from 'react';
import { createRoot } from 'react-dom/client';
import AiGame from '../components/ai-game';
import '../app/globals.css';
import '../app/ai.css';
import '../app/review.css';

createRoot(document.getElementById('root')!).render(<AiGame />);
