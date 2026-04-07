import { Configuration, LogLevel } from '@azure/msal-browser';

export async function fetchMsalConfig(): Promise<Configuration> {
  const res = await fetch('/api/auth/config');
  const { clientId, tenantId } = await res.json();

  return {
    auth: {
      clientId,
      authority: `https://login.microsoftonline.com/${tenantId}`,
      redirectUri: window.location.origin,
      postLogoutRedirectUri: window.location.origin,
    },
    cache: {
      cacheLocation: 'sessionStorage',
    },
    system: {
      loggerOptions: {
        logLevel: LogLevel.Warning,
        loggerCallback: (level, message, containsPii) => {
          if (containsPii) return;
          if (level === LogLevel.Error) console.error(message);
          else if (level === LogLevel.Warning) console.warn(message);
        },
      },
    },
  };
}

export const loginRequest = {
  scopes: ['User.Read', 'openid', 'profile', 'email'],
};
