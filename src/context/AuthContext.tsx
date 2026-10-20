import React, { createContext, useContext, useEffect, useState } from 'react';
import { onIdTokenChanged, User } from 'firebase/auth';
import { auth } from '@/config/firebase';

interface AuthContextValue {
  user: User | null;
  isAdmin: boolean;
  isVenue: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isAdmin: false,
  isVenue: false,
  isLoading: true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isVenue, setIsVenue] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    return onIdTokenChanged(auth, async (nextUser) => {
      setUser(nextUser);
      if (nextUser) {
        try {
          const token = await nextUser.getIdTokenResult();
          setIsAdmin(token.claims.admin === true);
          setIsVenue(token.claims.venue === true);
        } catch {
          setIsAdmin(false);
          setIsVenue(false);
        }
      } else {
        setIsAdmin(false);
        setIsVenue(false);
      }
      setIsLoading(false);
    });
  }, []);

  return (
    <AuthContext.Provider value={{ user, isAdmin, isVenue, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}