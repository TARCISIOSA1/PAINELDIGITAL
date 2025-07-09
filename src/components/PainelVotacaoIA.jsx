import React, { useEffect, useState, useRef } from "react";
import TopoInstitucional from "./TopoInstitucional";
import panelConfig from "../config/panelConfig.json";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend,
} from "chart.js";
import "./PainelVotacaoIA.css";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function PainelVotacaoIA() {
  const [dados, setDados] = useState(null);
  const [legenda, setLegenda] = useState("");
  const [banner, setBanner] = useState("Aguardando início da sessão...");
  const [fullTribuna, setFullTribuna] = useState(false);
  const [fullVotacao, setFullVotacao] = useState(false);
  const [telaAuxiliar, setTelaAuxiliar] = useState(false);

  // OUVIR painelAtivo/ativo
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "painelAtivo", "ativo"), (snap) => {
      if (!snap.exists()) return setDados(null);
      setDados(snap.data());
    });
    return () => unsub();
  }, []);

  // MENSAGENS E ANIMAÇÕES IA
  useEffect(() => {
    if (!dados) {
      setBanner("Aguardando início da sessão...");
    } else if (dados.statusSessao === "Ativa" && dados.tribunaAtual?.oradorAtivoIdx >= 0) {
      setBanner("Tribuna ativa. Fala em andamento...");
    } else if (dados.statusSessao === "Ativa" && dados.votacaoAtual?.status === "em_votacao") {
      setBanner("Votação em andamento...");
    } else if (dados.statusSessao === "Encerrada") {
      setBanner("Sessão encerrada! Veja o resumo e resultados.");
    } else if (dados.statusSessao === "Suspensa") {
      setBanner("Sessão suspensa. Aguarde orientações da Mesa.");
    } else if (dados.statusSessao === "Pausada") {
      setBanner("Sessão pausada. Retomaremos em breve!");
    } else {
      setBanner("Aguardando início da sessão...");
    }
  }, [dados]);

  // LEGENDAS IA (aqui, simula recebendo do campo tribunaAtual.legenda)
  useEffect(() => {
    setLegenda(dados?.tribunaAtual?.legenda || "");
  }, [dados?.tribunaAtual?.legenda, dados?.tribunaAtual?.oradorAtivoIdx]);

  // ====== DADOS DE TELA
  if (!dados) {
    return (
      <div className="painel-ia-container painel-bg" style={{ minHeight: "100vh" }}>
        <TopoInstitucional />
        <div className="painel-ia-banner">{banner}</div>
      </div>
    );
  }
  // Parlamentares presentes
  const parlamentaresPresentes = (dados.parlamentares || []).filter(p => p.presente);

  // Info tribuna
  const oradores = dados.tribunaAtual?.oradores || [];
  const oradorIdx = dados.tribunaAtual?.oradorAtivoIdx ?? -1;
  const orador = oradores[oradorIdx] || null;

  // Cronômetro tribuna
  const tempoRestante = dados.tribunaAtual?.tempoRestante || 0;

  // Votação e gráfico
  const votosObj = dados.votacaoAtual?.votos || {};
  const votosList = Object.entries(votosObj).map(([id, voto]) => ({
    id, voto
  }));
  const totalSim = votosList.filter(v => v.voto === "sim").length;
  const totalNao = votosList.filter(v => v.voto === "nao").length;
  const totalAbst = votosList.filter(v => v.voto === "abstencao").length;
  const chartData = {
    labels: ["Sim", "Não", "Abstenção"],
    datasets: [{
      label: "Votos",
      data: [totalSim, totalNao, totalAbst],
      backgroundColor: ["#13c37b", "#ff5555", "#ffd600"],
      borderRadius: 8,
      barThickness: 38,
    }],
  };

  // ========= FULLSCREEN TRIBUNA
  if (fullTribuna && orador) {
    return (
      <div className="painel-full" onClick={() => setFullTribuna(false)}>
        <TopoInstitucional />
        <div className="full-tribuna-bloco">
          <img src={orador.foto || "/assets/default-parlamentar.png"} alt={orador.nome} className="full-tribuna-foto" />
          <div className="full-tribuna-info">
            <span className="full-tribuna-nome">{orador.nome}</span>
            <span className="full-tribuna-partido">{orador.partido?.toUpperCase() || ""}</span>
            <span className="full-tribuna-crono">{tempoRestante}s</span>
            <div className="full-legenda">{legenda}</div>
          </div>
        </div>
        <div className="full-msg">{banner}</div>
      </div>
    );
  }

  // ========= FULLSCREEN VOTAÇÃO
  if (fullVotacao) {
    return (
      <div className="painel-full" onClick={() => setFullVotacao(false)}>
        <TopoInstitucional />
        <div className="full-votacao-bloco">
          <h2>Resultado da Votação</h2>
          <Bar data={chartData} />
          <div className="full-resultados">
            <b>✅ Sim:</b> {totalSim} &nbsp; <b>❌ Não:</b> {totalNao} &nbsp; <b>⚪ Abstenções:</b> {totalAbst}
          </div>
          <div className="full-msg">{banner}</div>
        </div>
      </div>
    );
  }

  // =========== PAINEL PÚBLICO NORMAL ===========
  return (
    <div className="painel-ia-container painel-bg">
      <TopoInstitucional />
      <div className="painel-ia-banner">{banner}</div>

      {/* Presentes */}
      <section className="sessao-presentes-bloco">
        <h3>Presentes</h3>
        <div className="tags-presentes">
          {parlamentaresPresentes.map((p, idx) => (
            <div className="tag-present" key={idx}>
              <img src={p.foto || "/assets/default-parlamentar.png"} alt={p.nome} className="tag-foto" />
              <div className="tag-info">
                <span className="tag-nome">{p.nome}</span>
                {p.partido && <span className="tag-partido">{p.partido.toUpperCase()}</span>}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Tribuna */}
      <section className="bloco-tribuna">
        <h3>Tribuna</h3>
        {orador ? (
          <div className="tribuna-stand">
            <img src={orador.foto || "/assets/default-parlamentar.png"} alt={orador.nome} className="foto-orador-destaque" />
            <div className="tribuna-info">
              <b>{orador.nome}</b>
              <span>{orador.partido?.toUpperCase() || ""}</span>
              <span className="tribuna-crono">{tempoRestante}s</span>
              <div className="legenda-tribuna">{legenda || <span style={{ color: "#aaa" }}>Legenda automática aparecerá aqui...</span>}</div>
            </div>
            <div className="tribuna-full-btn">
              <button onClick={() => setFullTribuna(true)}>Expandir em Tela Cheia</button>
              <button onClick={() => setTelaAuxiliar(true)}>Tela Auxiliar</button>
            </div>
          </div>
        ) : <p style={{ color: "#777" }}>Nenhum orador na tribuna.</p>}
      </section>

      {/* Ordem do Dia + Votação */}
      <section className="bloco-votacao">
        <h3>Ordem do Dia</h3>
        {(dados.ordemDoDia || []).map((mat, idx) => (
          <div className="materia-pauta" key={idx}>
            <b>{mat.titulo}</b> &nbsp;
            <span className="mat-tipo">{mat.tipo}</span> &nbsp;
            <span className="mat-autor">Autor: {mat.autor || "-"}</span> &nbsp;
            <span className="mat-status">Status: {mat.status}</span>
          </div>
        ))}

        <h3>Votação</h3>
        <div className="resultados-votacao">
          <div className="res-votos">
            <Bar data={chartData} />
            <div className="btns-full-votacao">
              <button onClick={() => setFullVotacao(true)}>Expandir em Tela Cheia</button>
              <button onClick={() => setTelaAuxiliar(true)}>Tela Auxiliar</button>
            </div>
          </div>
          <table className="tabela-votos-central">
            <thead><tr><th>Vereador</th><th>Voto</th></tr></thead>
            <tbody>
              {votosList.map((item, i) => {
                const p = (dados.parlamentares || []).find(x => x.id === item.id) || {};
                return (
                  <tr key={item.id}>
                    <td>{p.nome || "-"}</td>
                    <td>
                      {item.voto === "sim" ? "✅ Sim"
                        : item.voto === "nao" ? "❌ Não"
                        : item.voto === "abstencao" ? "⚪ Abstenção"
                        : item.voto || "Ainda não votou"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
