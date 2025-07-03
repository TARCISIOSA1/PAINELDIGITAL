// LayoutBase.jsx
import React, { useState } from "react";
import "./LayoutBase.css";

export default function LayoutBase({ children, pageTitle }) {
  const [menuAberto, setMenuAberto] = useState(false);

  const toggleMenu = () => setMenuAberto(!menuAberto);

  return (
    <div className="layout-container">
      <header className="layout-header">
        <button className="btn-menu" onClick={toggleMenu} aria-label="Abrir menu">
          ☰
        </button>
        <div className="logo">🏛️ Meu Sistema</div>
      </header>

      <nav className={`layout-sidebar ${menuAberto ? "aberto" : ""}`}>
        <ul>
          <li><a href="#"><span className="icon">📊</span> Dashboard</a></li>
          <li><a href="#"><span className="icon">👥</span> Usuários</a></li>
          <li><a href="#"><span className="icon">⚙️</span> Configurações</a></li>
          <li><a href="#"><span className="icon">📋</span> Lista</a></li>
        </ul>
      </nav>

      <main className="layout-content" onClick={() => menuAberto && setMenuAberto(false)}>
        <h1>{pageTitle}</h1>
        {children}
      </main>

      <footer className="layout-footer">
        © 2025 Minha Empresa
      </footer>
    </div>
  );
}
