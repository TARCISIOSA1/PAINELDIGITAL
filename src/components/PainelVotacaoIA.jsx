import React, { useEffect, useRef, useState } from "react";
import "./PainelVotacaoUltra.css";
import TopoInstitucional from "./TopoInstitucional";
import panelConfig from "../config/panelConfig.json";
import { doc, onSnapshot, getDocs, collection, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { Bar } from "react-chartjs-2";
import QRCode from "qrcode.react";
import jsPDF from "jspdf";
import "jspdf-autotable";

// Chart.js config
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend,
} from "chart.js";
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

// VLibras Widget
const VLibras = () => {
  useEffect(() => {
    if (!window.VLibras) {
      const s = document.createElement("script");
      s.src = "https://vlibras.gov.br/app/vlibras-plugin.js";
      s.onload = () => window.VLibras && new window.VLibras.Widget("https://vlibras.gov.br/app");
      document.body.appendChild(s);
    }
  }, []);
  return <div id="vlibras" style={{ position: "fixed", bottom: 0, right: 0, zIndex: 999 }} />;
};

// Função de Audiodescrição
function usarTTS(texto) {
  if ("speechSynthesis" in window && texto) {
    const utter = new window.SpeechSynthesisUtterance(texto);
    utter.lang = "pt-BR";
    window.speechSynthesis.speak(utter);
  }
}

// Função para filtrar linguagem imprópria (exemplo simples)
const filtroLinguagem = (txt) => txt.replace(/(porra|merda|puta|caralho)/gi, "⚠️");

export default function PainelVotacaoUltra() {
  const [dados, setDados] = useState(null);
  const [presentes, setPresentes] = useState([]);
  const [votos, setVotos] = useState([]);
  const [legenda, setLegenda] = useState("");
  const [historico, setHistorico] = useState([]);
  const [banners, setBanners] = useState([
    "Bem-vindos à sessão plenária!",
    "Transparência, participação e democracia.",
    "Acompanhe as notícias no site da Câmara.",
  ]);
  const [idioma, setIdioma] = useState("PT");
  const [modoNoite, setModoNoite] = useState(false);
  const [showTelaAuxiliar, setShowTelaAuxiliar] = useState(false);
  const containerRef = useRef(null);

  // Modo TV automático
  useEffect(() => {
    const hora = new Date().getHours();
    setModoNoite(hora >= 18 || hora < 6);
  }, []);

  // Dados painelAtivo/ativo e históricos
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "painelAtivo", "ativo"), async (snap) => {
      if (!snap.exists()) { setDados(null); return; }
      const data = snap.data();
      setDados(data);

      // Presentes
      const hab = data.votacaoAtual?.habilitados || data.habilitados || [];
      let docs = [];
      if (hab.length > 0) {
        if (hab.length <= 10) {
          const q = query(collection(db, 'parlamentares'), where('__name__', 'in', hab));
          docs = (await getDocs(q)).docs.map(d => ({ id: d.id, ...d.data() }));
        } else {
          const all = (await getDocs(collection(db, 'parlamentares'))).docs.map(d => ({ id: d.id, ...d.data() }));
          docs = all.filter(v => hab.includes(v.id));
        }
      }
      setPresentes(docs);

      // Votos
      const v = data.votacaoAtual?.votos;
      setVotos(v ? Object.entries(v).map(([id, voto]) => ({ id, voto })) : []);

      // Histórico (últimas 5 sessões)
      const histSnap = await getDocs(collection(db, "atas"));
      const ult = histSnap.docs.map(d => d.data()).slice(-5);
      setHistorico(ult);
    });
    return () => unsub();
  }, []);

  // Legenda IA via Whisper
  useEffect(() => {
    let stop = false;
    async function getLegenda() {
      if (!dados?.tribunaAtual?.cronometroAtivo) { setLegenda(""); return; }
      // Pega transcrição do backend Whisper (ajuste seu endpoint local/IA)
      try {
        const r = await fetch("http://localhost:3333/api/last-legend");
        const d = await r.json();
        let texto = d.text || "";
        texto = filtroLinguagem(texto);
        setLegenda(texto);
        // Salva na ata no backend (opcional)
        if (dados.tribunaAtual?.nome && texto) {
          await fetch("http://localhost:3333/api/save-legenda", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              fala: texto,
              orador: dados.tribunaAtual.nome,
              partido: dados.tribunaAtual.partido,
              data: dados.data,
              hora: dados.hora,
            })
          });
        }
      } catch { setLegenda(""); }
      if (!stop && dados?.tribunaAtual?.cronometroAtivo) setTimeout(getLegenda, 3500);
    }
    if (dados?.tribunaAtual?.cronometroAtivo) getLegenda();
    return () => { stop = true; };
    // eslint-disable-next-line
  }, [dados?.tribunaAtual?.cronometroAtivo, dados?.tribunaAtual?.nome]);

  // Rotação de banners
  useEffect(() => {
    if (!dados) return;
    let bannersAtual = banners.slice();
    if (dados.statusSessao === "Encerrada") bannersAtual = [
      "Sessão encerrada! Acompanhe o resumo abaixo.",
      ...(panelConfig.mensagensFinais || []),
    ];
    let idx = 0;
    const interval = setInterval(() => {
      idx = (idx + 1) % bannersAtual.length;
      setBanners(bannersAtual);
    }, 10000);
    return () => clearInterval(interval);
    // eslint-disable-next-line
  }, [dados?.statusSessao]);

  // TTS de audiodescrição automática ao iniciar fala na tribuna
  useEffect(() => {
    if (dados?.tribunaAtual?.nome && dados.tribunaAtual.tempoRestante > 0 && legenda) {
      usarTTS(`${dados.tribunaAtual.nome} (${dados.tribunaAtual.partido || ""}): ${legenda}`);
    }
  }, [legenda, dados]);

  // QRCode do portal/transparência
  const qrValue = panelConfig.urlTransparencia || "https://seusite-camara.com/transparencia";

  // Modo Full automático (Tribuna ou Votação)
  const emFull = dados?.tribunaAtual?.tempoRestante > 0 || dados?.votacaoAtual?.status === "em_votacao";

  // Renderização
  if (!dados) {
    return (
      <div className={`painel-ultra-container${modoNoite ? " noite" : ""}`}>
        <VLibras />
        <TopoInstitucional config={panelConfig} />
        <div className="painel-banner">{banners[0]}</div>
        <div className="aguardando-sessao">Aguardando início da sessão...</div>
      </div>
    );
  }

  // Render Fullscreen (Tribuna)
  if (dados.tribunaAtual?.tempoRestante > 0) {
    return (
      <div className={`painel-ultra-container full tribuna${modoNoite ? " noite" : ""}`} ref={containerRef}>
        <VLibras />
        <TopoInstitucional config={panelConfig} />
        <div className="tribuna-full">
          <div className="tribuna-foto">
            <img src={dados.tribunaAtual.fotoURL || "/assets/default-parlamentar.png"} alt="Orador" />
          </div>
          <div className="tribuna-info">
            <h1>{dados.tribunaAtual.nome}</h1>
            <span className="tribuna-partido">{dados.tribunaAtual.partido}</span>
          </div>
          <div className={`tribuna-tempo${dados.tribunaAtual.tempoRestante < 20 ? " alerta" : ""}`}>
            {dados.tribunaAtual.tempoRestante}s
          </div>
          <div className="tribuna-legenda">{legenda || <span>Legenda IA em processamento...</span>}</div>
        </div>
        <div className="banner-rotativo">{banners[0]}</div>
        <QRCode value={qrValue} size={64} style={{ position: "absolute", bottom: 16, right: 16 }} />
      </div>
    );
  }

  // Render Fullscreen (Votação)
  if (dados.votacaoAtual?.status === "em_votacao") {
    const labels = ["Sim", "Não", "Abstenção"];
    const counts = [
      votos.filter(v => v.voto === "sim").length,
      votos.filter(v => v.voto === "nao").length,
      votos.filter(v => v.voto === "abstencao").length,
    ];
    return (
      <div className={`painel-ultra-container full votacao${modoNoite ? " noite" : ""}`}>
        <VLibras />
        <TopoInstitucional config={panelConfig} />
        <div className="votacao-full">
          <h1>Votação em Andamento</h1>
          <Bar data={{ labels, datasets: [{ label: "Votos", data: counts }] }} />
          <div className="resultado-final">
            <span>Sim: {counts[0]} | Não: {counts[1]} | Abstenção: {counts[2]}</span>
          </div>
          <div className="banner-rotativo">{banners[0]}</div>
          <QRCode value={qrValue} size={64} style={{ position: "absolute", bottom: 16, right: 16 }} />
        </div>
      </div>
    );
  }

  // Render normal
  return (
    <div className={`painel-ultra-container${modoNoite ? " noite" : ""}`} ref={containerRef}>
      <VLibras />
      <TopoInstitucional config={panelConfig} idioma={idioma} />
      <div className="painel-banner">{banners[0]}</div>
      <div className="painel-info-rapida">
        <div><strong>Data:</strong> {dados.data} {dados.hora && <span>| <strong>Hora:</strong> {dados.hora}</span>}</div>
        <div><strong>Local:</strong> {dados.local}</div>
        <div><strong>Presidente:</strong> {dados.presidente}</div>
        <div><strong>Secretário:</strong> {dados.secretario || "—"}</div>
        <div><strong>Status:</strong> <span className={`status-session status-${(dados.statusSessao || '').toLowerCase()}`}>{dados.statusSessao}</span></div>
        <div><strong>Tipo:</strong> {dados.tipo}</div>
      </div>

      <div className="presentes-box-ultra">
        <h2>Parlamentares Presentes</h2>
        <div className="presentes-ultra-tags">
          {presentes.map(p => (
            <div key={p.id} className="tag-present-ultra">
              <img src={p.foto || "/assets/default-parlamentar.png"} alt={p.nome} className="tag-foto" />
              <span className="tag-nome">{p.nome}</span>
              <span className="tag-partido">{p.partido}</span>
            </div>
          ))}
        </div>
      </div>

      {dados.tribunaAtual?.nome &&
        <div className="bloco-tribuna-ultra">
          <h2>Tribuna</h2>
          <div className="tribuna-ultra">
            <img src={dados.tribunaAtual.fotoURL || "/assets/default-parlamentar.png"} alt="Orador" className="tribuna-img" />
            <div>
              <b>Orador:</b> {dados.tribunaAtual.nome} <span style={{ color: "#888" }}>({dados.tribunaAtual.partido})</span><br />
              <b>Tempo Restante:</b> {dados.tribunaAtual.tempoRestante}s
              <div className="legenda-tribuna-ultra">{legenda || <span>Legenda IA em processamento...</span>}</div>
            </div>
          </div>
        </div>
      }

      {dados.votacaoAtual?.materias && dados.votacaoAtual.materias.length > 0 &&
        <div className="bloco-votacao-ultra">
          <h2>Ordem do Dia</h2>
          {dados.votacaoAtual.materias.map((m, i) => (
            <div key={i} className="votacao-ultra-materia">
              <b>{m.titulo}</b> ({m.tipo})<br />
              <span>Autor: {m.autor} | Status: {m.status}</span>
            </div>
          ))}
          <div className="painel-grafico-ultra">
            <Bar data={{
              labels: ["Sim", "Não", "Abstenção"],
              datasets: [{
                label: "Votos",
                data: [
                  votos.filter(v => v.voto === "sim").length,
                  votos.filter(v => v.voto === "nao").length,
                  votos.filter(v => v.voto === "abstencao").length,
                ]
              }]
            }} />
          </div>
        </div>
      }

      {/* Placar histórico */}
      <div className="historico-placar-ultra">
        <h2>Últimas Sessões e Placar</h2>
        <ul>
          {historico.map((ata, i) => (
            <li key={i}>
              {ata.data} - {ata.titulo || ata.idSessao || "Sessão"}:
              <span> {ata.presentes?.length || 0} presentes | {ata.votosSim || 0} Sim, {ata.votosNao || 0} Não, {ata.votosAbstencao || 0} Abstenção</span>
            </li>
          ))}
        </ul>
      </div>

      {/* QRCode portal transparência */}
      <div className="painel-qrcode">
        <span>Portal da Transparência</span>
        <QRCode value={qrValue} size={72} />
      </div>

      {/* Exportar para tela auxiliar */}
      <button
        className="btn-tela-auxiliar"
        style={{ position: "fixed", bottom: 24, right: 24, zIndex: 99 }}
        onClick={() => setShowTelaAuxiliar(true)}
        title="Exportar para Tela Auxiliar"
      >
        Exportar Tela Auxiliar
      </button>

      {/* Multi idioma */}
      <div className="multi-idioma-barra">
        <button className={idioma === "PT" ? "idioma-ativo" : ""} onClick={() => setIdioma("PT")}>🇧🇷 PT</button>
        <button className={idioma === "EN" ? "idioma-ativo" : ""} onClick={() => setIdioma("EN")}>🇺🇸 EN</button>
        <button className={idioma === "ES" ? "idioma-ativo" : ""} onClick={() => setIdioma("ES")}>🇪🇸 ES</button>
      </div>
    </div>
  );
}
