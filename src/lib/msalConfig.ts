import { Configuration, LogLevel } from '@azure/msal-browser';

async function getAuthConfig(): Promise<{ clientId: string; tenantId: string }> {
  // 빌드 시 환경변수 우선 (Vercel 등 정적 호스팅)
  const envClientId = import.meta.env.VITE_AZURE_CLIENT_ID;
  const envTenantId = import.meta.env.VITE_AZURE_TENANT_ID;
  if (envClientId && envTenantId) {
    return { clientId: envClientId, tenantId: envTenantId };
  }

  // 런타임 API 조회 (App Runner 등 백엔드 포함 환경)
  try {
    const res = await fetch('/api/auth/config');
    if (res.ok) return await res.json();
  } catch { /* ignore */ }

  return { clientId: '', tenantId: '' };
}

export async function fetchMsalConfig(): Promise<Configuration> {
  const { clientId, tenantId } = await getAuthConfig();

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
