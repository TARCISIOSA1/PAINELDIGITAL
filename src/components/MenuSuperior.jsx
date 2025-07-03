import React from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import usePermissoesUsuario from "../hooks/usePermissoesUsuario";
import { checarPermissao } from "../utils/permissoesUtils";

const MENUS = [
  { tela: "Matérias", path: "/materias", label: "Matérias" },
  { tela: "Sessões", path: "/sessoes", label: "Sessões" },
  { tela: "Tramitação", path: "/tramitacao", label: "Tramitação" },
  // ... adicione todos os menus!
];

export default function MenuSuperior() {
  const { usuario } = useAuth();
  const { permissoes, carregando } = usePermissoesUsuario(usuario?.tipoUsuario);

  if (carregando) return <div>Carregando menu...</div>;

  return (
    <nav className="menu-superior">
      {MENUS.map(item =>
        checarPermissao(permissoes, item.tela, "visualizar") ? (
          <NavLink to={item.path} key={item.tela}>{item.label}</NavLink>
        ) : null
      )}
    </nav>
  );
}
