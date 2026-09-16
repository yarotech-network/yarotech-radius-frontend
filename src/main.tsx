import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/index.css';
import { App } from './app/App';
import { ThemeProvider } from './app/theme/ThemeProvider';
import { installGlobalErrorReporting } from './services/telemetry/errorReporter';

installGlobalErrorReporting();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider defaultTheme="light" storageKey="yarotech-ui-theme">
      <App />
    </ThemeProvider>
  </StrictMode>,
);
