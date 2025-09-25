declare global {
  interface Window {
    google: any;
  }
}

export async function getDriveToken(clientId: string): Promise<string> {
  if (!clientId) {
    throw new Error("Google Client ID missing (VITE_GOOGLE_CLIENT_ID)");
  }

  if (!window.google?.accounts?.oauth2) {
    await new Promise<void>((resolve) => {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.onload = () => resolve();
      document.head.appendChild(script);
    });
  }

  return await new Promise<string>((resolve, reject) => {
    const tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: "https://www.googleapis.com/auth/drive",
      prompt: "",
      callback: (resp: any) => {
        if (resp?.access_token) {
          resolve(resp.access_token);
        } else {
          reject(new Error("Failed to acquire Drive access token"));
        }
      },
    });
    tokenClient.requestAccessToken();
  });
}
