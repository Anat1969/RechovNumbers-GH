import { createRoot } from 'react-dom/client';
import App from './App';
import './base.css';
import './app.css';

createRoot(document.getElementById('root')!).render(<App />);

// service worker רק כשהבסיס הוא השורש (ב-raw.githack הבסיס יחסי)
if ('serviceWorker' in navigator && location.pathname === '/') {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
