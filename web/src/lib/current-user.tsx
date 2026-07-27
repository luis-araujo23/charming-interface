import { createContext, useContext } from "react";

export type SessionUser = {
  id: string;
  username: string;
  email: string;
};

const CurrentUserContext = createContext<SessionUser | null>(null);

export function CurrentUserProvider({
  user,
  children,
}: {
  user: SessionUser | null;
  children: React.ReactNode;
}) {
  return <CurrentUserContext.Provider value={user}>{children}</CurrentUserContext.Provider>;
}

export function useCurrentUser() {
  return useContext(CurrentUserContext);
}
