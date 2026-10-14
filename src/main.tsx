import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/index.css';
import { App } from './app/App';
import { installGlobalErrorReporting } from './services/telemetry/errorReporter';
import { disableZodEval } from './lib/validation/zodCsp';

installGlobalErrorReporting();
disableZodEval();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
