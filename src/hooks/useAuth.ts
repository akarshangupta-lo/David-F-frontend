import { useState, useEffect, useCallback } from "react";
import { User } from "../types";

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const signOut = useCallback(() => {
    setUser(null);
    localStorage.clear();
    window.location.href = "/signin";
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    // Handle OAuth callback
    if (params.get("auth_success") === "true" && params.get("user_id")) {
      const userData: User = {
        id: params.get("user_id")!,
        email: params.get("email") || "",
        name: params.get("name") || "",
        createdAt: new Date().toISOString(),
      };

      // Store full user object
      localStorage.setItem("user", JSON.stringify(userData));
      localStorage.setItem("wine_ocr_user_id", userData.id);

      setUser(userData);

      // ✅ Clean up URL params but stay on the same page
      window.history.replaceState({}, document.title, window.location.pathname);
    } else {
      // Try loading from localStorage
      const savedUser = localStorage.getItem("user");
      if (savedUser) {
        try {
          const parsedUser: User = JSON.parse(savedUser);
          setUser(parsedUser);

          if (parsedUser?.id) {
            localStorage.setItem("wine_ocr_user_id", parsedUser.id);
          }
        } catch {
          localStorage.removeItem("user");
          localStorage.removeItem("wine_ocr_user_id");
        }
      }
    }

    setLoading(false);
  }, []);

  return {
    user,
    loading,
    error: null,
    signOut,
  };
};
