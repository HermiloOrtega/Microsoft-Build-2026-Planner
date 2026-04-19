import { createContext, useContext, useState, ReactNode } from 'react';

interface PasswordContextType {
  password: string;
  setPassword: (p: string) => void;
  isAdmin: boolean;
  setIsAdmin: (v: boolean) => void;
}

const PasswordContext = createContext<PasswordContextType>({
  password: '',
  setPassword: () => {},
  isAdmin: false,
  setIsAdmin: () => {},
});

export function PasswordProvider({ children }: { children: ReactNode }) {
  const [password, setPasswordState] = useState('');
  const [isAdmin, setIsAdminState] = useState(false);

  function setPassword(p: string) {
    setPasswordState(p);
    if (!p) setIsAdminState(false);
  }

  function setIsAdmin(v: boolean) {
    setIsAdminState(v);
    if (!v) setPasswordState('');
  }

  return (
    <PasswordContext.Provider value={{ password, setPassword, isAdmin, setIsAdmin }}>
      {children}
    </PasswordContext.Provider>
  );
}

export function usePassword() {
  return useContext(PasswordContext);
}
