import React, { createContext, useState } from "react";

export const SessoesContext = createContext();

export function SessoesProvider({ children }) {
  const [sessoes, setSessoes] = useState([]);

  return (
    <SessoesContext.Provider value={{ sessoes, setSessoes }}>
      {children}
    </SessoesContext.Provider>
  );
}
