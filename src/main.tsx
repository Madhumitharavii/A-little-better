import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app/App';
import { ensureDefaultSettings } from './db/repositories/settingsRepository';
import './index.css';

// Runs once, in a normal (writable) Dexie transaction — this is
// intentionally NOT inside a liveQuery querier. It creates the
// default settings row only if one doesn't exist yet, so it never
// overwrites settings from a previous launch.
void ensureDefaultSettings();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
