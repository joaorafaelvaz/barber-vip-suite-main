/**
 * Index page - redirects to the main app dashboard
 */

import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export default function Index() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (user) {
        navigate("/app/dashboard", { replace: true });
      } else {
        navigate("/auth", { replace: true });
      }
    }
  }, [user, loading, navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="animate-pulse text-muted-foreground">Carregando...</div>
    </div>
  );
}
