import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Diagnostic: surface any uncaught error visibly instead of leaving a silent blank window.
// This is critical for debugging the packaged (production) build on Windows where
// devtools console output is not visible to the end user.
function renderFatalError(title: string, detail: string) {
  const root = document.getElementById('root');
  if (!root) return;
  root.innerHTML = '';
  const container = document.createElement('div');
  container.style.cssText =
    'position:fixed;inset:0;background:rgba(127,29,29,0.92);color:#fff;font-family:monospace;' +
    'font-size:12px;padding:12px;overflow:auto;white-space:pre-wrap;z-index:999999;';
  container.textContent = `[FATAL] ${title}\n\n${detail}`;
  root.appendChild(container);
}

window.addEventListener('error', (event) => {
  renderFatalError('window.onerror', String(event.error?.stack || event.message || event));
});

window.addEventListener('unhandledrejection', (event) => {
  renderFatalError(
    'unhandledrejection',
    String((event.reason && event.reason.stack) || event.reason)
  );
});

try {
  ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} catch (err) {
  renderFatalError('ReactDOM.createRoot/render threw synchronously', String((err as Error)?.stack || err));
}
