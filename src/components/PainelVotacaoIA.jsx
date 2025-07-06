// src/components/PainelVotacaoIA.jsx
import React, { useEffect, useState, useRef } from "react";
import { doc, onSnapshot, collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import TopoInstitucional from "./TopoInstitucional";
import panelConfig from "../config/panelConfig.json";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from "chart.js";
import "./PainelVotacaoIA.css";

// Registrar os componentes do Chart.js
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function PainelVotacaoIA() {
  const [painel, setPainel] = useState(null);
  const [presentes, setPresentes] = useState([]);
  const [legenda, setLegenda] = useState("");
  const painelRef = useRef(null);

  // Assinar painelAtivo/ativo
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "painelAtivo", "ativo"), snap => {
      if (snap.exists()) setPainel(snap.data());
    });
    return () => unsub();
  }, []);

  // Carregar detalhes dos presentes
  useEffect(() => {
    async function fetchPresentes() {
      if (!painel?.presentes?.length) {
        setPresentes([]);
        return;
      }
      const snap = await getDocs(collection(db, "parlamentares"));
      const todos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const filtros = painel.presentes.map(id => todos.find(p => p.id === id)).filter(Boolean);
      setPresentes(filtros);
    }
    fetchPresentes();
  }, [painel?.presentes]);

  // Mensagem IA dinâmica
  function getMensagemIA() {
    if (!painel) return "Carregando painel...";
    if (painel.tribunaAtual?.nome) return `Tribuna ativa: ${painel.tribunaAtual.nome}`;
    if (painel.votacaoAtual?.status === "em_votacao") return `Votação em andamento: ${painel.votacaoAtual.materia}`;
    if (painel.statusSessao === "Ativa") return "Sessão em andamento.";
    return "Aguardando início da sessão...";
  }

  // Fullscreen automático quando tribuna ou votação
  useEffect(() => {
    const elem = painelRef.current;
    if (!elem) return;
    if (painel?.tribunaAtual?.cronometroAtivo || painel?.votacaoAtual?.status === "em_votacao") {
      if (elem.requestFullscreen) elem.requestFullscreen();
    } else {
      if (document.fullscreenElement) document.exitFullscreen();
    }
  }, [painel?.tribunaAtual, painel?.votacaoAtual]);

  // CSS modo noturno
  const isNoite = new Date().getHours() >= 18;

  // Dados para gráfico
  const votos = painel?.votacaoAtual?.votos || {};
  const totalSim = Object.values(votos).filter(v => v === "Sim").length;
  const totalNao = Object.values(votos).filter(v => v === "Não").length;
  const totalAbs = Object.values(votos).filter(v => v === "Abstenção").length;
  const dataGrafico = {
    labels: ["Sim", "Não", "Abstenção"],
    datasets: [{ label: "Votos", data: [totalSim, totalNao, totalAbs] }]
  };

  return (
    <div ref={painelRef} className={isNoite ? "painel-noite" : "painel-dia"}>
      <TopoInstitucional config={panelConfig} />
      <div className="mensagem-ia">{getMensagemIA()}</div>

      <section className="sessao-info">
        <h2>{painel?.titulo || "Painel Plenária"}</h2>
        <p><b>Data:</b> {painel?.data || '-'} | <b>Hora:</b> {painel?.hora || '-'}</p>
        <p><b>Local:</b> {painel?.local || '—'}</p>
        <p><b>Presidente:</b> {painel?.presidente || '—'} | <b>Secretário:</b> {painel?.secretario || '—'}</p>
        <p><b>Status:</b> {painel?.statusSessao || '—'}</p>
      </section>

      <section className="presentes">
        <h3>Presentes ({presentes.length})</h3>
        <div className="etiquetas">
          {presentes.map(p => (
            <div key={p.id} className="etiqueta">
              <img src={p.foto} alt={p.nome} />
              <span>{p.nome}</span>
              <small>{p.partido}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="tribuna-destaque">
        <h3>Tribuna</h3>
        {painel?.tribunaAtual?.nome ? (
          <div className="destaque">
            <img src={painel.tribunaAtual.fotoURL || '/default.png'} alt={painel.tribunaAtual.nome} />
            <div>
              <h4>{painel.tribunaAtual.nome}</h4>
              <p>{painel.tribunaAtual.partido || '—'}</p>
              <p>Tempo: {painel.tribunaAtual.tempoRestante}s</p>
            </div>
          </div>
        ) : <p>Sem orador na tribuna.</p>}
      </section>

      <section className="votacao">
        <h3>Votação</h3>
        <p><b>Matéria:</b> {painel?.votacaoAtual?.materia || '—'}</p>
        <p><b>Autor:</b> {painel?.votacaoAtual?.autor || '—'}</p>
        {painel?.votacaoAtual?.status === 'em_votacao' ? (
          <Bar data={dataGrafico} />
        ) : <p>Status: {painel?.votacaoAtual?.status || '—'}</p>}
      </section>

    </div>
  );
}
