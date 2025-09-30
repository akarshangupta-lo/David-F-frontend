import React, { useEffect, useState } from "react";
import { User } from "lucide-react";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

export const GoogleSignIn: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handle OAuth redirect callback
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const authError = urlParams.get("auth_error");

    if (authError) {
      setError(`Authentication failed: ${authError}`);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const handleSignIn = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${BACKEND_URL}/auth/init`, {
        method: "POST",
      });
      const data = await response.json();
      if (data?.url) {
        window.location.href = data.url; // redirect to backend (Google + Drive flow)
      } else {
        throw new Error("No redirect URL from backend");
      }
    } catch (err: any) {
      console.error(err);
      setError("Failed to start authentication");
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-red-50 to-red-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-900 mx-auto mb-4"></div>
          <p className="text-red-800">Redirecting to Google...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-md">
        <div className="text-center mb-6">
          <div className="mx-auto h-12 w-12 bg-red-900 rounded-full flex items-center justify-center mb-4">
            <User className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Wine Label Processor
          </h1>
          <p className="text-gray-600">
            Sign in with Google to process wine labels
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="flex justify-center">
          <button
            onClick={handleSignIn}
            className="bg-red-900 text-white px-6 py-2 rounded-lg hover:bg-red-800 transition"
          >
            Sign in with Google
          </button>
        </div>
      </div>
    </div>
  );
};
