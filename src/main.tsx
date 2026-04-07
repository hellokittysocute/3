import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { PublicClientApplication } from '@azure/msal-browser';
import { MsalProvider } from '@azure/msal-react';
import { fetchMsalConfig } from './lib/msalConfig';
import App from './App.tsx';
import { AuthProvider } from './contexts/AuthContext';
import './index.css';

(async () => {
  const msalConfig = await fetchMsalConfig();
  const msalInstance = new PublicClientApplication(msalConfig);
  await msalInstance.initialize();
  await msalInstance.handleRedirectPromise();

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <MsalProvider instance={msalInstance}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MsalProvider>
    </StrictMode>,
  );
})();
