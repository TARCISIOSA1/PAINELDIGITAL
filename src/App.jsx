import React, { useState, useEffect, useRef } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  NavLink,
} from "react-router-dom";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "./firebase";

// IMPORTS DOS COMPONENTES
import CadastroProjeto from "./components/CadastroProjeto";
import CadastroSessao from "./components/CadastroSessao";
import CadastroParlamentar from "./components/CadastroParlamentar";
import CadastroVereador from "./components/CadastroVereador";
import CadastroPresenca from "./components/CadastroPresenca";
import CadastroLegislatura from "./components/CadastroLegislatura";
import CadastroSessaoLegislativa from "./components/CadastroSessaoLegislativa";
import Tramitacao from "./components/Tramitacao";
import Votacao from "./components/Votacao";
import PainelVotacao from "./components/PainelVotacao";
import PainelVotacaoIA from "./components/PainelVotacaoIA";
import VotacaoVereador from "./components/VotacaoVereador";
import Login from "./components/Login";
import PedidosIA from "./components/PedidosIA";
import CadastroPauta from "./components/CadastroPauta";
import CadastroAta from "./components/CadastroAta";
import VisualizacaoAtas from "./components/VisualizacaoAtas";
import CadastroProtocolo from "./components/CadastroProtocolo";
import PainelProtocolosAdmin from "./components/PainelProtocolosAdmin";
import PainelJuridico from "./components/PainelJuridico";
import PainelComissao from "./components/PainelComissao";
import GerenciarReuniao from "./components/GerenciarReuniao";
import ResumoReuniao from "./components/ResumoReuniao";
import EmailChat from "./components/email/EmailChat";
import Chat from "./components/email/Chat";
import RelatoriosPlenaria from "./components/RelatoriosPlenaria";
import GerenciarPermissoes from "./components/GerenciarPermissoes";
import AlterarSenha from "./components/AlterarSenha";
import RotaPrivada from "./components/RotaPrivada";
import AgendaParlamentar from "./components/AgendaParlamentar";
import Comissoes from "./components/Comissoes";
import CadastroConteudoLegislacao from "./components/CadastroConteudoLegislacao";
import CentralConsulta from "./components/CentralConsulta";
import ConsultaPublicaMateria from "./components/ConsultaPublicaMateria";
import GerenciarConsultaPublica from "./components/GerenciarConsultaPublica";

import "./App.css";

// LABELS
const TELAS_LABEL = {
  Materias: "Matérias",
  Sessoes: "Sessões",
  SessaoLegislativa: "Sessão Legislativa",
  Legislacao: "Legislações",
  PainelDeControle: "Painel de Controle",
  PainelPublico: "Painel Público",
  PainelPublicoIA: "Painel Público (IA)",
  Comissoes: "Comissões",
  Presencas: "Presenças",
  Usuarios: "Usuários",
  Parlamentares: "Parlamentares",
  Tramitacao: "Tramitação",
  Pauta: "Pauta",
  Atas: "Atas",
  VisualizarAtas: "Visualizar Atas",
  Relatorios: "Relatórios",
  Legislatura: "Legislatura",
  NovoProtocolo: "Novo Protocolo",
  ProtocolosAdmin: "Protocolos (Admin)",
  PainelJuridico: "Painel Jurídico",
  PainelComissao: "Painel Comissão",
  PedidosIA: "Fale Comigo",
  Email: "Email",
  Chat: "Chat",
  Permissoes: "Permissões",
  Agenda: "Agenda",
  Login: "Login",
  AlterarSenha: "Alterar Senha",
  CentralConsulta: "Central de Consulta",
  ConsultaPublica: "Consulta Pública",
  GerenciarConsultaPublica: "Gerenciar Consulta Pública"
};

// MENUS
const LEGISLATIVO = [
  { nome: "Materias", path: "/" },
  { nome: "Sessoes", path: "/sessao" },
  { nome: "SessaoLegislativa", path: "/sessao-legislativa" },
  { nome: "Legislacao", path: "/legislacao" },
  { nome: "PainelDeControle", path: "/votacao" },
  { nome: "PainelPublico", path: "/painel" },
  { nome: "PainelPublicoIA", path: "/painel-ia" },
  { nome: "Comissoes", path: "/comissoes" },
  { nome: "Presencas", path: "/presenca" },
  { nome: "Pauta", path: "/pauta" },
];
const COMUNICACAO = [
  { nome: "Agenda", path: "/agenda" },
  { nome: "Email", path: "/email-chat" },
  { nome: "Chat", path: "/chat" },
  { nome: "NovoProtocolo", path: "/protocolos" },
];
const ARQUIVOS = [
  { nome: "Atas", path: "/atas" },
  { nome: "VisualizarAtas", path: "/visualizacao-atas" },
];
const PAINEIS = [
  { nome: "PainelJuridico", path: "/painel-juridico" },
  { nome: "PainelComissao", path: "/painel-comissao" },
];
const CONSULTA_PUBLICA = [
  { nome: "ConsultaPublica", path: "/consulta-publica" },
  { nome: "GerenciarConsultaPublica", path: "/gerenciar-consulta-publica" }
];

export default function App() {
  const [menuAberto, setMenuAberto] = useState("");
  const menuRefs = {
    leg: useRef(),
    com: useRef(),
    arq: useRef(),
    pain: useRef(),
    cpub: useRef(),
    acc: useRef(),
  };
  const [telasPermitidas, setTelasPermitidas] = useState([]);

  const usuarioLogado = localStorage.getItem("usuarioLogado");
  let tipoUsuario = "vereador";
  let nomeUsuario = "";
  if (usuarioLogado) {
    const userData = JSON.parse(usuarioLogado);
    tipoUsuario = String(userData.tipoUsuario || "vereador").toLowerCase();
    nomeUsuario = userData.nome || "";
  }

  useEffect(() => {
    async function carregarPermissoes() {
      if (tipoUsuario === "masteradm") {
        setTelasPermitidas([
          ...LEGISLATIVO.map(t => t.nome),
          ...COMUNICACAO.map(t => t.nome),
          ...ARQUIVOS.map(t => t.nome),
          ...PAINEIS.map(t => t.nome),
          ...CONSULTA_PUBLICA.map(t => t.nome),
          "Usuarios", "Parlamentares", "Tramitacao", "Relatorios",
          "Legislatura", "ProtocolosAdmin", "PedidosIA", "Permissoes",
          "Login", "AlterarSenha", "CentralConsulta"
        ]);
        return;
      }
      const q = query(
        collection(db, "permissoes"),
        where("tipoUsuario", "==", tipoUsuario.charAt(0).toUpperCase() + tipoUsuario.slice(1))
      );
      const snap = await getDocs(q);
      const telas = [];
      snap.forEach(doc => {
        const d = doc.data();
        if (d.permissoes && d.permissoes.visualizar) {
          telas.push(d.tela);
        }
      });
      setTelasPermitidas(telas);
    }
    carregarPermissoes();
  }, [tipoUsuario]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (
        menuAberto &&
        menuRefs[menuAberto] &&
        menuRefs[menuAberto].current &&
        !menuRefs[menuAberto].current.contains(event.target)
      ) {
        setMenuAberto("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuAberto, menuRefs]);

  const pode = (tela) => tipoUsuario === "masteradm" || telasPermitidas.includes(tela);

  const exibeDropdown = (grupo) => grupo.some(item => pode(item.nome));

  return (
    <Router>
      <header className="header" style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "#f6f7fa",
        borderBottom: "1px solid #ddd",
        padding: "10px 18px 6px 18px"
      }}>
        <div style={{ display: "flex", alignItems: "center" }}>
          <img src="/assets/logo-plenario-digital.png" alt="Logo Plenário Digital" className="logo" style={{ height: 38, marginRight: 16 }} />
          <span style={{ fontWeight: "bold", fontSize: 18 }}>PAINEL DIGITAL</span>
        </div>
        <div style={{
          fontWeight: "bold",
          fontSize: 15,
          color: "#333"
        }}>
          Usuário logado: {nomeUsuario}
        </div>
      </header>

      <nav className="nav-wrapper">
        <div className="nav-bar">
          {/* Central de Consulta - menu fixo */}
          {pode("CentralConsulta") && (
            <NavLink to="/central-consulta" className="nav-link">{TELAS_LABEL.CentralConsulta}</NavLink>
          )}
          {/* Consulta Pública */}
          <div className="menu-item" ref={menuRefs.cpub}>
            <div
              className="dropdown-toggle"
              role="button"
              tabIndex={0}
              onClick={() => setMenuAberto(menuAberto === "cpub" ? "" : "cpub")}
              style={{ userSelect: "none", cursor: "pointer" }}
            >
              Consulta Pública ▾
            </div>
            {menuAberto === "cpub" && (
              <div className="dropdown-menu">
                <NavLink
                  to="/consulta-publica"
                  className="dropdown-link"
                  onClick={() => setMenuAberto("")}
                >
                  Consulta Pública (Votação)
                </NavLink>
                {pode("GerenciarConsultaPublica") && (
                  <NavLink
                    to="/gerenciar-consulta-publica"
                    className="dropdown-link"
                    onClick={() => setMenuAberto("")}
                  >
                    Gerenciar Consulta Pública
                  </NavLink>
                )}
              </div>
            )}
          </div>
          {/* Legislativo */}
          {exibeDropdown(LEGISLATIVO) && (
            <div className="menu-item" ref={menuRefs.leg}>
              <div
                className="dropdown-toggle"
                role="button"
                tabIndex={0}
                onClick={() => setMenuAberto(menuAberto === "leg" ? "" : "leg")}
                style={{ userSelect: "none", cursor: "pointer" }}
              >
                Legislativo ▾
              </div>
              {menuAberto === "leg" && (
                <div className="dropdown-menu">
                  {LEGISLATIVO.map(item =>
                    pode(item.nome) && (
                      <NavLink
                        key={item.nome}
                        to={item.path}
                        className="dropdown-link"
                        onClick={() => setMenuAberto("")}
                      >
                        {TELAS_LABEL[item.nome]}
                      </NavLink>
                    )
                  )}
                </div>
              )}
            </div>
          )}
          {/* Comunicação */}
          {exibeDropdown(COMUNICACAO) && (
            <div className="menu-item" ref={menuRefs.com}>
              <div
                className="dropdown-toggle"
                role="button"
                tabIndex={0}
                onClick={() => setMenuAberto(menuAberto === "com" ? "" : "com")}
                style={{ userSelect: "none", cursor: "pointer" }}
              >
                Comunicação ▾
              </div>
              {menuAberto === "com" && (
                <div className="dropdown-menu">
                  {COMUNICACAO.map(item =>
                    pode(item.nome) && (
                      <NavLink
                        key={item.nome}
                        to={item.path}
                        className="dropdown-link"
                        onClick={() => setMenuAberto("")}
                      >
                        {TELAS_LABEL[item.nome]}
                      </NavLink>
                    )
                  )}
                </div>
              )}
            </div>
          )}
          {/* Arquivos */}
          {exibeDropdown(ARQUIVOS) && (
            <div className="menu-item" ref={menuRefs.arq}>
              <div
                className="dropdown-toggle"
                role="button"
                tabIndex={0}
                onClick={() => setMenuAberto(menuAberto === "arq" ? "" : "arq")}
                style={{ userSelect: "none", cursor: "pointer" }}
              >
                Arquivos ▾
              </div>
              {menuAberto === "arq" && (
                <div className="dropdown-menu">
                  {ARQUIVOS.map(item =>
                    pode(item.nome) && (
                      <NavLink
                        key={item.nome}
                        to={item.path}
                        className="dropdown-link"
                        onClick={() => setMenuAberto("")}
                      >
                        {TELAS_LABEL[item.nome]}
                      </NavLink>
                    )
                  )}
                </div>
              )}
            </div>
          )}
          {/* Paineis de Trabalho */}
          {exibeDropdown(PAINEIS) && (
            <div className="menu-item" ref={menuRefs.pain}>
              <div
                className="dropdown-toggle"
                role="button"
                tabIndex={0}
                onClick={() => setMenuAberto(menuAberto === "pain" ? "" : "pain")}
                style={{ userSelect: "none", cursor: "pointer" }}
              >
                Painéis de Trabalho ▾
              </div>
              {menuAberto === "pain" && (
                <div className="dropdown-menu">
                  {PAINEIS.map(item =>
                    pode(item.nome) && (
                      <NavLink
                        key={item.nome}
                        to={item.path}
                        className="dropdown-link"
                        onClick={() => setMenuAberto("")}
                      >
                        {TELAS_LABEL[item.nome]}
                      </NavLink>
                    )
                  )}
                </div>
              )}
            </div>
          )}
          {/* Itens no menu principal */}
          {pode("Usuarios") && <NavLink to="/vereador" className="nav-link">{TELAS_LABEL.Usuarios}</NavLink>}
          {pode("Parlamentares") && <NavLink to="/parlamentares" className="nav-link">{TELAS_LABEL.Parlamentares}</NavLink>}
          {pode("Tramitacao") && <NavLink to="/tramitacao" className="nav-link">{TELAS_LABEL.Tramitacao}</NavLink>}
          {pode("Relatorios") && <NavLink to="/relatorios" className="nav-link">{TELAS_LABEL.Relatorios}</NavLink>}
          {pode("Legislatura") && <NavLink to="/legislatura" className="nav-link">{TELAS_LABEL.Legislatura}</NavLink>}
          {pode("ProtocolosAdmin") && <NavLink to="/painel-protocolos" className="nav-link">{TELAS_LABEL.ProtocolosAdmin}</NavLink>}
          {pode("PedidosIA") && <NavLink to="/pedidos-ia" className="nav-link">{TELAS_LABEL.PedidosIA}</NavLink>}
          {pode("Permissoes") && <NavLink to="/permissoes" className="nav-link">{TELAS_LABEL.Permissoes}</NavLink>}

          {/* Menu Acesso */}
          <div className="menu-item" ref={menuRefs.acc}>
            <div
              className="dropdown-toggle"
              role="button"
              tabIndex={0}
              onClick={() => setMenuAberto(menuAberto === "acc" ? "" : "acc")}
              style={{ userSelect: "none", cursor: "pointer" }}
            >
              Acesso ▾
            </div>
            {menuAberto === "acc" && (
              <div className="dropdown-menu">
                <NavLink to="/login" className="dropdown-link" onClick={() => setMenuAberto("")}>{TELAS_LABEL.Login}</NavLink>
                {usuarioLogado && <NavLink to="/alterar-senha" className="dropdown-link" onClick={() => setMenuAberto("")}>{TELAS_LABEL.AlterarSenha}</NavLink>}
              </div>
            )}
          </div>
        </div>
      </nav>

      <main className="page" style={{ paddingBottom: 64 }}>
        <Routes>
          {/* NOVA ROTA - Central de Consulta */}
          <Route path="/central-consulta" element={<RotaPrivada><CentralConsulta /></RotaPrivada>} />

          {/* Consulta Pública */}
          <Route path="/consulta-publica" element={<ConsultaPublicaMateria />} />
          <Route path="/gerenciar-consulta-publica" element={
            <RotaPrivada>
              <GerenciarConsultaPublica />
            </RotaPrivada>
          } />

          {/* Demais rotas */}
          <Route path="/painel" element={<PainelVotacao />} />
          <Route path="/painel-ia" element={<PainelVotacaoIA />} />
          <Route path="/visualizacao-atas" element={<VisualizacaoAtas />} />
          <Route path="/relatorios" element={<RelatoriosPlenaria />} />
          <Route path="/sessao" element={<CadastroSessao />} />
          <Route path="/presenca" element={<CadastroPresenca />} />
          <Route path="/login" element={<Login />} />
          <Route path="/agenda" element={<AgendaParlamentar />} />
          <Route path="/" element={<RotaPrivada><CadastroProjeto /></RotaPrivada>} />
          <Route path="/sessao-legislativa" element={<RotaPrivada><CadastroSessaoLegislativa /></RotaPrivada>} />
          <Route path="/parlamentares" element={<RotaPrivada><CadastroParlamentar /></RotaPrivada>} />
          <Route path="/pauta" element={<RotaPrivada><CadastroPauta sessaoId="abcdef123456" /></RotaPrivada>} />
          <Route path="/atas" element={<RotaPrivada><CadastroAta /></RotaPrivada>} />
          <Route path="/legislatura" element={<RotaPrivada><CadastroLegislatura /></RotaPrivada>} />
          <Route path="/vereador" element={<RotaPrivada><CadastroVereador /></RotaPrivada>} />
          <Route path="/tramitacao" element={<RotaPrivada><Tramitacao /></RotaPrivada>} />
          <Route path="/votacao" element={<RotaPrivada><Votacao /></RotaPrivada>} />
          <Route path="/votar/:id" element={<RotaPrivada><VotacaoVereador /></RotaPrivada>} />
          <Route path="/pedidos-ia" element={<RotaPrivada><PedidosIA /></RotaPrivada>} />
          <Route path="/protocolos" element={<RotaPrivada><CadastroProtocolo usuario={nomeUsuario} /></RotaPrivada>} />
          <Route path="/painel-protocolos" element={<RotaPrivada><PainelProtocolosAdmin /></RotaPrivada>} />
          <Route path="/painel-juridico" element={<RotaPrivada><PainelJuridico /></RotaPrivada>} />
          <Route path="/painel-comissao" element={<RotaPrivada><PainelComissao /></RotaPrivada>} />
          <Route path="/comissoes" element={<RotaPrivada><Comissoes /></RotaPrivada>} />
          <Route path="/legislacao" element={<RotaPrivada><CadastroConteudoLegislacao /></RotaPrivada>} />
          <Route path="/gerenciar-reuniao/:reuniaoId" element={<RotaPrivada><GerenciarReuniao usuarioLogado={nomeUsuario} /></RotaPrivada>} />
          <Route path="/resumo-reuniao/:reuniaoId" element={<RotaPrivada><ResumoReuniao /></RotaPrivada>} />
          <Route path="/email-chat" element={<RotaPrivada><EmailChat usuarioLogado={usuarioLogado ? JSON.parse(usuarioLogado) : {}} /></RotaPrivada>} />
          <Route path="/chat" element={<RotaPrivada><Chat usuarioLogado={usuarioLogado ? JSON.parse(usuarioLogado) : {}} /></RotaPrivada>} />
          <Route path="/permissoes" element={<RotaPrivada><GerenciarPermissoes /></RotaPrivada>} />
          <Route path="/alterar-senha" element={<RotaPrivada><AlterarSenha /></RotaPrivada>} />
          <Route path="*" element={<h1>404 - Página não encontrada ❌</h1>} />
        </Routes>
      </main>
      <footer className="footer-institucional">
        Câmara Municipal &copy; {new Date().getFullYear()} — Plenário Digit@L
      </footer>
    </Router>
  );
}
