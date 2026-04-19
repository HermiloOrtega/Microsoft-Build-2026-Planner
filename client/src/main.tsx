import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './App.css';
import App from './App';
import { PasswordProvider } from './context/PasswordContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PasswordProvider>
      <App />
    </PasswordProvider>
  </StrictMode>
);