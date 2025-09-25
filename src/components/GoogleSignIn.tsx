import React, { useEffect, useRef, useState } from "react";
import { User, LogIn } from "lucide-react";
import { useAuth } from "../hooks/useAuth";

declare global {
  interface Window {
    google: any;
  }
}

export const GoogleSignIn: React.FC = () => {
  const { user, loading, error, signIn, signOut } = useAuth();
  const googleButtonRef = useRef<HTMLDivElement>(null);
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  // Initialize Google login button
  useEffect(() => {
    if (!clientId) return;
    if (window.google && !user && !loading) {
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (response: any) => {
          await signIn(response.credential);
        },
      });

      if (googleButtonRef.current) {
        window.google.accounts.id.renderButton(googleButtonRef.current, {
          theme: "outline",
          size: "large",
          width: 250,
        });
      }
    }
  }, [user, loading, signIn, clientId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-red-50 to-red-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-900 mx-auto mb-4"></div>
          <p className="text-red-800">Loading...</p>
        </div>
      </div>
    );
  }

  if (user) {
    // Don't redirect if we're already on the homepage
    if (window.location.pathname !== '/') {
      window.location.href = '/';
    }
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-md">
        <div className="text-center mb-6">
          <div className="mx-auto h-12 w-12 bg-red-900 rounded-full flex items-center justify-center mb-4">
            <User className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Wine Label Processor</h1>
          <p className="text-gray-600">Sign in with Google to process wine labels</p>
        </div>

        {(!clientId || error) && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg text-sm">
            {!clientId
              ? "Google Client ID missing. Set VITE_GOOGLE_CLIENT_ID and restart the dev server."
              : error}
          </div>
        )}

        <div className="flex justify-center">
          <div ref={googleButtonRef}></div>
        </div>

        <div className="mt-6 text-center">
          <div className="flex items-center space-x-2 text-sm text-gray-500">
            {/* <LogIn className="h-4 w-4" />
            <span>Secure authentication with Google integration</span> */}
          </div>
        </div>
      </div>
    </div>
  );
};
