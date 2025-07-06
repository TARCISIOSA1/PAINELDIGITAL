// src/components/PainelVotacaoIA.jsx
import React, { useEffect, useState, useRef } from "react";
import { db } from "../firebase";
import { doc, onSnapshot } from "firebase/firestore";
import TopoInstitucional from "./TopoInstitucional";
import panelConfig from "../config/panelConfig.json";
import { Bar } from "react-chartjs-2";
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from "chart.js";
import "./PainelVotacaoIA.css";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function PainelVotacaoIA() {
  const [painel, setPainel] = useState(null);
  const [legenda, setLegenda] = useState("");
  const [fullscreen, setFullscreen] = useState(false);
  const videoRef = useRef(null);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "painelAtivo", "ativo"), (docSnap) => {
      setPainel(docSnap.data());
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const elem = document.documentElement;
    if (fullscreen) {
      if (elem.requestFullscreen) elem.requestFullscreen();
    } else {
      if (document.exitFullscreen) document.exitFullscreen();
    }
  }, [fullscreen]);

  // LEGENDAS VIA IA (simulada)
  useEffect(() => {
    const interval = setInterval(() => {
      if (painel?.tribunaAtual?.cronometroAtivo) {
        setLegenda((prev) => prev + ".");
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [painel?.tribunaAtual?.cronometroAtivo]);

  const getMensagemIA = () => {
    if (!painel) return "Carregando...";
    if (painel.statusSessao === "Encerrada") return "Sessão encerrada";
    if (!painel.ordemDoDia?.length) return "Nenhuma matéria vinculada";
    if (painel.votacaoAtual?.status === "em_votacao")
      return `Matéria em votação: ${painel.votacaoAtual?.materia || " - "} – Autor: ${painel.votacaoAtual?.autor || "-"}`;
    if (painel.tribunaAtual?.nome)
      return `Tribuna ativa: ${painel.tribunaAtual.nome}`;
    return "Aguardando início da sessão...";
  };

  const data = {
    labels: ["Sim", "Não", "Abstenção"],
    datasets: [
      {
        label: "Votos",
        data: [
          Object.values(painel?.votacaoAtual?.votos || {}).filter((v) => v === "Sim").length,
          Object.values(painel?.votacaoAtual?.votos || {}).filter((v) => v === "Não").length,
          Object.values(painel?.votacaoAtual?.votos || {}).filter((v) => v === "Abstenção").length,
        ],
        backgroundColor: ["#4caf50", "#f44336", "#ff9800"],
      },
    ],
  };

  const isNoite = new Date().getHours() >= 18;
  const modo = isNoite ? "painel-noite" : "painel-dia";

  return (
    <div className={`painel-container ${modo}`}>
      <TopoInstitucional config={panelConfig} />

      <div className="mensagem-ia">{getMensagemIA()}</div>

      {/* ORADOR DESTACADO */}
      {painel?.tribunaAtual?.nome && (
        <div className="tribuna-destaque">
          <img src={painel.tribunaAtual.foto || "/default-user.png"} alt="Foto" />
          <div>
            <h2>{painel.tribunaAtual.nome}</h2>
            <p>{painel.tribunaAtual.partido}</p>
          </div>
        </div>
      )}

      {/* ETIQUETAS DE PRESENTES */}
      <div className="presentes-etiquetas">
        {painel?.presentes?.map((id) => {
          const vereador = painel.vereadores?.find((v) => v.id === id);
          return vereador ? (
            <div key={id} className="etiqueta">
              <img src={vereador.foto || "/default-user.png"} alt={vereador.nome} />
              <span>{vereador.nome}</span>
              <small>{vereador.partido}</small>
            </div>
          ) : null;
        })}
      </div>

      {/* GRÁFICO DE VOTAÇÃO */}
      {painel?.votacaoAtual?.status === "finalizada" && (
        <div className="grafico-votacao">
          <Bar data={data} />
        </div>
      )}

      {/* LEGENDA IA */}
      {painel?.tribunaAtual?.cronometroAtivo && (
        <div className="legenda-whisper">
          <p>[IA] {legenda || "Captando áudio..."}</p>
        </div>
      )}

      {/* BOTÕES */}
      <div className="botoes-rodape">
        <button onClick={() => setFullscreen((v) => !v)}>Tela Cheia</button>
        <button onClick={() => window.open(window.location.href, "_blank")}>Espelhar</button>
      </div>
    </div>
  );
}
