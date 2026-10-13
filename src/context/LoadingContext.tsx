"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { usePathname } from "next/navigation";

interface LoadingContextType {
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  loadingMessage: string;
  setLoadingMessage: (message: string) => void;
}

const LoadingContext = createContext<LoadingContextType>({
  isLoading: false,
  setIsLoading: () => {},
  loadingMessage: "Loading Resources...",
  setLoadingMessage: () => {},
});

export function LoadingProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("Loading Resources...");
  const pathname = usePathname();

  // Show a smooth top loader whenever the user navigates between routes
  useEffect(() => {
    setIsLoading(true);
    setLoadingMessage("Navigating workspace...");
    const timer = setTimeout(() => {
      setIsLoading(false);
      setLoadingMessage("Loading Resources...");
    }, 450);
    return () => clearTimeout(timer);
  }, [pathname]);

  return (
    <LoadingContext.Provider
      value={{
        isLoading,
        setIsLoading,
        loadingMessage,
        setLoadingMessage,
      }}
    >
      {/* Upper viewport progress bar - highly visible across the very top edge */}
      {isLoading && (
        <div
          role="progressbar"
          aria-label={loadingMessage}
          className="fixed top-0 left-0 right-0 z-[9999] h-1 bg-blue-100 overflow-hidden shadow-sm"
        >
          <div className="h-full bg-[#1D4ED8] shadow-[0_0_12px_#1D4ED8] animate-top-indeterminate" />
        </div>
      )}
      {children}
    </LoadingContext.Provider>
  );
}

export function useLoading() {
  return useContext(LoadingContext);
}
