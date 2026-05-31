"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

const UserSessionContext = createContext(false);

export function UserSessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    fetch("/api/user", { method: "POST" })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  return (
    <UserSessionContext.Provider value={ready}>
      {children}
    </UserSessionContext.Provider>
  );
}

export function useUserSessionReady(): boolean {
  return useContext(UserSessionContext);
}
