import React, { useEffect, useState, useRef } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import TopoInstitucional from "./TopoInstitucional";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import "./PainelVotacaoIA.css";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function PainelVotacaoIA() {
  const [dados, setDados] = useState(null);
  const [legenda, setLegenda] = useState("");
  const [fullTribuna, setFullTribuna] = useState(false);
  const [fullVotacao, setFullVotacao] = useState(false);
  const [showNoticia, setShowNoticia] = useState(false);
  const [msgIA, setMsgIA] = useState("Aguarde o início da sessão...");
  const marqueeRef = useRef();

  // Carregar dados do painelAtivo/ativo
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "painelAtivo", "ativo"), (snap) => {
      const data = snap.data();
      setDados(data);

      // Fullscreen automático tribuna
      if (data?.tribunaAtual?.cronometroAtivo && data?.tribunaAtual?.oradorAtivoIdx >= 0) {
        setFullTribuna(true);
      } else {
        setFullTribuna(false);
      }

      // Fullscreen automático votação
      if (data?.votacaoAtual?.status === "Em votação" || data?.votacaoAtual?.status === "Em Votação") {
        setFullVotacao(true);
      } else {
        setFullVotacao(false);
      }

      // Mensagem IA pós-sessão
      if (data?.statusSessao === "Encerrada") {
        setShowNoticia(true);
        setMsgIA("Sessão Encerrada! Veja as principais informações abaixo.");
      } else {
        setShowNoticia(false);
        setMsgIA("");
      }

      // Puxa legenda salva no painelAtivo
      setLegenda(data?.tribunaAtual?.conversas || "");
    });
    return unsub;
  }, []);

  // Dados básicos
  const {
    data: dataSessao,
    hora,
    local,
    tipo,
    numeroSessaoLegislativa,
    numeroSessaoOrdinaria,
    mesaDiretora = [],
    parlamentares = [],
    habilitados = [],
    ordemDoDia = [],
    statusSessao,
    tribunaAtual = {},
    votacaoAtual = {},
    quorumMinimo,
  } = dados || {};

  // Mesa diretora formatada
  const mesaDir = ["Presidente", "Vice-Presidente", "Secretário"].map(cargo => {
    const membro = mesaDiretora.find(m => (m.cargo || "").toLowerCase() === cargo.toLowerCase());
    return membro ? `${cargo}: ${membro.nome}` : null;
  }).filter(Boolean);

  // Parlamentares habilitados para votar (só aparece na lista de habilitados)
  const parlHabilitados = parlamentares.filter(p => habilitados.includes(p.id));
  const quorumAtingido = parlHabilitados.length >= (quorumMinimo || 0);

  // Bloco gráfico votação
  const resultado = votacaoAtual?.votos || {};
  const votoArr = Object.values(resultado);
  const totalSim = votoArr.filter(v => v.voto === "sim" || v.voto === "Sim").length;
  const totalNao = votoArr.filter(v => v.voto === "nao" || v.voto === "Não").length;
  const totalAbst = votoArr.filter(v => v.voto === "abstencao" || v.voto === "Abstenção").length;

  const dataGrafico = {
    labels: ["Sim", "Não", "Abstenção"],
    datasets: [
      {
        label: "Votos",
        data: [totalSim, totalNao, totalAbst],
        backgroundColor: ["#16a34a", "#ef4444", "#fbbf24"],
        borderRadius: 8,
      },
    ],
  };

  // Fullscreen tribuna
  if (fullTribuna && tribunaAtual && tribunaAtual.oradorAtivoIdx >= 0 && tribunaAtual.oradores?.length > 0) {
    const orador = tribunaAtual.oradores[tribunaAtual.oradorAtivoIdx] || {};
    return (
      <div className="painel-fullscreen painel-fullscreen-tribuna">
        <TopoInstitucional />
        <div className="tribuna-full">
          <img
            src={parlamentares.find(p => p.id === orador.id)?.foto || "/assets/default-parlamentar.png"}
            alt={orador.nome}
            className="tribuna-foto-full"
          />
          <div className="tribuna-info-full">
            <div className="tribuna-nome-full">{orador.nome} <span className="tribuna-partido-full">({orador.partido || "--"})</span></div>
            <div className="tribuna-tempo-full">{tribunaAtual.tempoRestante || orador.tempoFala || "--"}s</div>
            <div className="tribuna-legenda-full">
              {legenda ? <span>{legenda}</span> : <span style={{ color: "#888" }}>Legenda aguardando IA...</span>}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Fullscreen votação
  if (fullVotacao) {
    return (
      <div className="painel-fullscreen painel-fullscreen-votacao">
        <TopoInstitucional />
        <div className="votacao-full">
          <h2>Votação em Andamento</h2>
          <Bar data={dataGrafico} />
          <div className="votacao-resumo-full">
            <span>✅ Sim: {totalSim}</span>
            <span>❌ Não: {totalNao}</span>
            <span>⚪ Abst: {totalAbst}</span>
          </div>
        </div>
      </div>
    );
  }

  // Banner de mensagem IA e letreiro
  const noticiaFinal = (
    <div className="banner-ia-final">
      <div className="banner-frase">{msgIA}</div>
      <div className="marquee">
        <span ref={marqueeRef}>
          {`Sessão: ${dataSessao || "--"} | Quórum: ${parlHabilitados.length} habilitados. ${ordemDoDia.map(o => `Pauta: ${o.titulo || o.tipo}`).join(" | ")}.`}
        </span>
      </div>
    </div>
  );

  // Painel normal
  return (
    <div className="painel-ia-container">
      <TopoInstitucional />
      <div className="painel-cabecalho">
        <div>
          <h2>
            {numeroSessaoLegislativa && numeroSessaoOrdinaria
              ? `${numeroSessaoLegislativa}ª Legislatura - ${numeroSessaoOrdinaria}ª Sessão`
              : "Sessão Plenária"
            }
          </h2>
          <span className={`status-sessao ${statusSessao === "Ativa" ? "ativa" : "encerrada"}`}>{statusSessao || "--"}</span>
        </div>
        <div>
          <span>{dataSessao} {hora} - {local}</span>
        </div>
      </div>
      <div className="painel-mesa-parl">
        <div className="painel-mesa">
          <b>Mesa Diretora</b>
          <ul>
            {mesaDir.map((m, i) => <li key={i}>{m}</li>)}
          </ul>
        </div>
        <div className="painel-parlamentares">
          <b>Parlamentares Habilitados</b>
          <div className="painel-parl-lista">
            {parlHabilitados.map(p => (
              <div key={p.id} className="parl-tag">
                <img src={p.foto} alt={p.nome} className="parl-foto" />
                <span className="parl-nome">{p.nome}</span>
                <span className="parl-partido">{p.partido}</span>
              </div>
            ))}
          </div>
          <div className={`quorum-info${quorumAtingido ? "" : " quorum-alert"}`}>
            Quórum: {parlHabilitados.length}/{quorumMinimo || "--"}
          </div>
        </div>
      </div>
      <div className="painel-ordem-tribuna">
        <div className="painel-ordem-dia">
          <b>Ordem do Dia</b>
          {ordemDoDia.map((o, i) => (
            <div key={i} className="ordem-item">
              <div>{o.tipo === "materia" ? "Matéria" : "Ata"}: <b>{o.titulo || "--"}</b></div>
              <div>Status: {o.status || "--"} | Autor: {o.autor || "--"}</div>
            </div>
          ))}
        </div>
        <div className="painel-tribuna">
          <b>Tribuna</b>
          {tribunaAtual.oradorAtivoIdx >= 0 && tribunaAtual.oradores?.length > 0 ? (
            (() => {
              const orador = tribunaAtual.oradores[tribunaAtual.oradorAtivoIdx] || {};
              const parl = parlamentares.find(p => p.id === orador.id) || {};
              return (
                <div className="tribuna-orador">
                  <img src={parl.foto || "/assets/default-parlamentar.png"} alt={orador.nome} className="tribuna-foto" />
                  <div>
                    <div className="tribuna-nome">{orador.nome} <span className="tribuna-partido">({orador.partido || "--"})</span></div>
                    <div className="tribuna-tempo">{tribunaAtual.tempoRestante || orador.tempoFala || "--"}s</div>
                    <div className="tribuna-legenda">{legenda || <span style={{ color: "#aaa" }}>Legenda aguardando IA...</span>}</div>
                  </div>
                </div>
              );
            })()
          ) : (
            <div style={{ color: "#888" }}>Nenhum orador na tribuna</div>
          )}
        </div>
      </div>
      <div className="painel-votacao">
        <b>Votação</b>
        <div className="painel-votos-lista">
          <table>
            <thead>
              <tr>
                <th>Vereador</th>
                <th>Voto</th>
              </tr>
            </thead>
            <tbody>
              {parlHabilitados.map(p => {
                const voto = Object.values(resultado).find(v => v.vereador_id === p.id || v.id === p.id) || {};
                let txt = "Aguardando";
                if (voto.voto === "sim" || voto.voto === "Sim") txt = "✅ Sim";
                else if (voto.voto === "nao" || voto.voto === "Não") txt = "❌ Não";
                else if (voto.voto === "abstencao" || voto.voto === "Abstenção") txt = "⚪ Abstenção";
                return (
                  <tr key={p.id}>
                    <td>{p.nome} <span className="parl-partido">({p.partido || "--"})</span></td>
                    <td>{txt}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="votacao-grafico">
            <Bar data={dataGrafico} />
          </div>
        </div>
      </div>
      {/* Banner IA e Letreiro Final pós sessão */}
      {showNoticia && noticiaFinal}
    </div>
  );
}
