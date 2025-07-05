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
// (seu bloco de imports permanece igual)
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

// ... (labels e arrays de menu iguais ao seu código anterior)

const TELAS_LABEL = { /* ...igual ao seu... */ };
const LEGISLATIVO = [ /* ...igual ao seu... */ ];
const COMUNICACAO = [ /* ...igual ao seu... */ ];
const ARQUIVOS = [ /* ...igual ao seu... */ ];
const PAINEIS = [ /* ...igual ao seu... */ ];
const CONSULTA_PUBLICA = [ /* ...igual ao seu... */ ];

export default function App() {
  const [menuMobile, setMenuMobile] = useState(false);
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

  const pode = (tela) => tipoUsuario === "masteradm" || telasPermitidas.includes(tela);
  const exibeDropdown = (grupo) => grupo.some(item => pode(item.nome));

  // Fecha menu lateral no mobile ao navegar
  function closeMenuMobile() { setMenuMobile(false); setMenuAberto(""); }

  return (
    <Router>
      {/* HEADER */}
      <header className="header">
        <div className="header-logo">
          <img src="/assets/logo-plenario-digital.png" alt="Logo Plenário Digital" />
          <span>PAINEL DIGITAL</span>
        </div>
        <button className="menu-toggle" onClick={() => setMenuMobile(m => !m)}>
          <span />
          <span />
          <span />
        </button>
        <div className="header-user">
          Usuário logado: {nomeUsuario}
        </div>
      </header>

      {/* MENU LATERAL */}
      <nav className={`side-menu ${menuMobile ? "open" : ""}`}>
        <div className="side-menu-scroll">
          {/* Exemplo de links agrupados - adaptar igual ao seu menu */}
          <NavLink to="/" className="side-link" onClick={closeMenuMobile}>Matérias</NavLink>
          {pode("Sessoes") && <NavLink to="/sessao" className="side-link" onClick={closeMenuMobile}>Sessões</NavLink>}
          {pode("SessaoLegislativa") && <NavLink to="/sessao-legislativa" className="side-link" onClick={closeMenuMobile}>Sessão Legislativa</NavLink>}
          {pode("Legislacao") && <NavLink to="/legislacao" className="side-link" onClick={closeMenuMobile}>Legislação</NavLink>}
          {pode("PainelDeControle") && <NavLink to="/votacao" className="side-link" onClick={closeMenuMobile}>Painel de Controle</NavLink>}
          {pode("PainelPublico") && <NavLink to="/painel" className="side-link" onClick={closeMenuMobile}>Painel Público</NavLink>}
          {pode("PainelPublicoIA") && <NavLink to="/painel-ia" className="side-link" onClick={closeMenuMobile}>Painel Público (IA)</NavLink>}
          {pode("Comissoes") && <NavLink to="/comissoes" className="side-link" onClick={closeMenuMobile}>Comissões</NavLink>}
          {pode("Presencas") && <NavLink to="/presenca" className="side-link" onClick={closeMenuMobile}>Presenças</NavLink>}
          {pode("Pauta") && <NavLink to="/pauta" className="side-link" onClick={closeMenuMobile}>Pauta</NavLink>}
          {/* ...adicione todos os outros do seu menu, usando pode("Tela") */}
          <div className="side-link-group">Comunicação</div>
          {pode("Agenda") && <NavLink to="/agenda" className="side-link" onClick={closeMenuMobile}>Agenda</NavLink>}
          {pode("Email") && <NavLink to="/email-chat" className="side-link" onClick={closeMenuMobile}>E-mail</NavLink>}
          {pode("Chat") && <NavLink to="/chat" className="side-link" onClick={closeMenuMobile}>Chat</NavLink>}
          {/* ...e assim por diante */}
          <div className="side-link-group">Arquivos</div>
          {pode("Atas") && <NavLink to="/atas" className="side-link" onClick={closeMenuMobile}>Atas</NavLink>}
          {pode("VisualizarAtas") && <NavLink to="/visualizacao-atas" className="side-link" onClick={closeMenuMobile}>Visualizar Atas</NavLink>}
          {/* ...restante dos menus */}
        </div>
      </nav>

      {/* Sobreposição para fechar o menu no mobile */}
      {menuMobile && <div className="overlay-menu" onClick={closeMenuMobile} />}

      {/* CONTEÚDO PRINCIPAL */}
      <main className="main-content">
        {/* Mantém seu <Routes> completo igual estava */}
        <Routes>
          {/* ...todas as suas rotas... */}
          <Route path="/" element={<RotaPrivada><CadastroProjeto /></RotaPrivada>} />
          <Route path="/sessao" element={<CadastroSessao />} />
          <Route path="/sessao-legislativa" element={<RotaPrivada><CadastroSessaoLegislativa /></RotaPrivada>} />
          <Route path="/parlamentares" element={<RotaPrivada><CadastroParlamentar /></RotaPrivada>} />
          <Route path="/pauta" element={<RotaPrivada><CadastroPauta sessaoId="abcdef123456" /></RotaPrivada>} />
          <Route path="/atas" element={<RotaPrivada><CadastroAta /></RotaPrivada>} />
          <Route path="/legislatura" element={<RotaPrivada><CadastroLegislatura /></RotaPrivada>} />
          <Route path="/vereador" element={<RotaPrivada><CadastroVereador /></RotaPrivada>} />
          <Route path="/tramitacao" element={<RotaPrivada><Tramitacao /></RotaPrivada>} />
          <Route path="/votacao" element={<RotaPrivada><Votacao /></RotaPrivada>} />
          <Route path="/painel" element={<PainelVotacao />} />
          <Route path="/painel-ia" element={<PainelVotacaoIA />} />
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
          <Route path="/relatorios" element={<RelatoriosPlenaria />} />
          <Route path="/central-consulta" element={<RotaPrivada><CentralConsulta /></RotaPrivada>} />
          {/* ...demais rotas do seu app... */}
          <Route path="*" element={<h1>404 - Página não encontrada ❌</h1>} />
        </Routes>
      </main>

      <footer className="footer-institucional">
        Câmara Municipal &copy; {new Date().getFullYear()} — Plenário Digit@L
      </footer>
    </Router>
  );
}
