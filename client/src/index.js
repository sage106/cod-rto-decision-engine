/**
 * Application entry point.
 * Uses React 18's createRoot API for concurrent rendering.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/dashboard.css';

const container = document.getElementById('root');
const root = createRoot(container);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
