import React, { createContext, useContext, useState } from "react";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  // Aqui, carregue o usuário logado REAL e o tipoUsuario do banco
  const [usuario, setUsuario] = useState(null); // { nome, tipoUsuario }
  return (
    <AuthContext.Provider value={{ usuario, setUsuario }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
