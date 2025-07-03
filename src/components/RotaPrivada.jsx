import React from "react";
import { Navigate } from "react-router-dom";

export default function RotaPrivada({ children }) {
  const usuarioLogado = localStorage.getItem("usuarioLogado");
  if (!usuarioLogado) {
    return <Navigate to="/login" replace />;
  }
  return children;
}
