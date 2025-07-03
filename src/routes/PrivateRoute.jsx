import React from "react";
import { useAuth } from "../context/AuthContext";
import usePermissoesUsuario from "../hooks/usePermissoesUsuario";
import { checarPermissao } from "../utils/permissoesUtils";
import { Navigate } from "react-router-dom";

export default function PrivateRoute({ tela, acao, children }) {
  const { usuario } = useAuth();
  const { permissoes, carregando } = usePermissoesUsuario(usuario?.tipoUsuario);

  if (carregando) return <div>Verificando permissão...</div>;

  if (!checarPermissao(permissoes, tela, acao)) {
    return <div>Acesso negado</div>;
    // Ou redirecione: return <Navigate to="/acesso-negado" />;
  }
  return children;
}
