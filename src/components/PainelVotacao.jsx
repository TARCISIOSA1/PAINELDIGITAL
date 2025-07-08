import React, { useEffect, useState, useRef } from "react";
import "./PainelVotacao.css";
import {
  doc,
  onSnapshot,
  getDoc,
  getDocs,
  collection,
  query,
  where,
} from "firebase/firestore";
import { db } from "../firebase";
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

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function PainelVotacaoIA() {
  const containerRef = useRef(null);
  const [dadosPainel, setDadosPainel] = useState(null);
  const [presentes, setPresentes] = useState([]);
  const [votosRegistrados, setVotosRegistrados] = useState([]);
  const [timerRed, setTimerRed] = useState(false);

  // Carrega painelAtivo/ativo em tempo real
  useEffect(() => {
    const painelRef = doc(db, "painelAtivo", "ativo");
    const unsubscribe = onSnapshot(painelRef, async (snap) => {
      if (!snap.exists()) {
        setDadosPainel(null);
        setPresentes([]);
        return;
      }
      const data = snap.data();
      setDadosPainel(data);

      // PARLAMENTARES PRESENTES (usando painelAtivo.parlamentares)
      if (Array.isArray(data.parlamentares)) {
        setPresentes(data.parlamentares.filter((v) => v.presente));
      } else {
        setPresentes([]);
      }

      // Votos
      if (data?.votos && typeof data.votos === "object") {
        // Novo modelo (painelAtivo.votos)
        const arr = Object.entries(data.votos).map(([id, voto]) => ({
          id,
          voto,
        }));
        setVotosRegistrados(arr);
      } else if (data?.votacaoAtual?.votos && typeof data.votacaoAtual.votos === "object") {
        // Compatível com modelo anterior
        const votosObj = data.votacaoAtual.votos;
        const arr = Object.values(votosObj).map((item) => ({
          id: item.vereador_id,
          voto: item.voto || "",
        }));
        setVotosRegistrados(arr);
      } else {
        setVotosRegistrados([]);
      }

      // Alerta cronômetro tribuna
      if (data?.tribuna?.tempoRestante <= 20 && data?.tribuna?.tempoRestante > 0) setTimerRed(true);
      else setTimerRed(false);
    });
    return () => unsubscribe();
  }, []);

  // Dados principais da sessão
  const dados = dadosPainel || {};
  const sessaoData = dados.data || "-";
  const sessaoHora = dados.hora || "-";
  const sessaoLocal = dados.local || "-";
  const sessaoPresidente = dados.presidente || "-";
  const sessaoTipo = dados.tipo || "-";
  const statusSessao = dados.statusSessao || "-";
  const mesaDiretora = dados.mesaDiretora || [];
  const ordemDoDia = dados.ordemDoDia || [];
  const pauta = dados.pauta || "";
  const tribuna = dados.tribuna || {};
  const oradores = tribuna.oradores || [];
  const oradorAtivoIdx = tribuna.oradorAtivoIdx ?? -1;
  const oradorAtivo = oradorAtivoIdx >= 0 ? oradores[oradorAtivoIdx] : null;
  const tempoRestante = tribuna.tempoRestante ?? 0;

  // Gráfico de votos (exemplo simples)
  const votosSim = votosRegistrados.filter((v) => v.voto === "Sim").length;
  const votosNao = votosRegistrados.filter((v) => v.voto === "Não").length;
  const votosAbst = votosRegistrados.filter((v) => v.voto === "Abstenção").length;

  const graficoVotacao = {
    labels: ["Sim", "Não", "Abstenção"],
    datasets: [
      {
        label: "Votos",
        data: [votosSim, votosNao, votosAbst],
        backgroundColor: ["#2ecc71", "#e74c3c", "#f1c40f"],
      },
    ],
  };

  if (!dadosPainel) {
    return (
      <div className="painel-ia-aguardando">
        Aguardando início da sessão...
      </div>
    );
  }

  return (
    <div className="painel-ia-container" ref={containerRef}>
      {/* Informações da Sessão */}
      <section className="sessao-info-presentes">
        <div className="info-gerais">
          <h2>Informações da Sessão</h2>
          <p><strong>Data:</strong> {sessaoData} | <strong>Hora:</strong> {sessaoHora}</p>
          <p><strong>Local:</strong> {sessaoLocal}</p>
          <p><strong>Presidente:</strong> {sessaoPresidente}</p>
          <p><strong>Status:</strong> {statusSessao} | <strong>Tipo:</strong> {sessaoTipo}</p>
          <p><strong>Pauta:</strong> {pauta || "—"}</p>
        </div>

        {/* Mesa Diretora */}
        <div className="mesa-diretora-box">
          <h3>Mesa Diretora</h3>
          {Array.isArray(mesaDiretora) && mesaDiretora.length > 0 ? (
            <ul>
              {mesaDiretora.map((m, idx) => (
                <li key={idx}>
                  <b>{m.cargo}:</b> {m.nome}
                </li>
              ))}
            </ul>
          ) : <span>—</span>}
        </div>

        {/* Parlamentares Presentes */}
        <div className="presentes-box">
          <h2>Parlamentares Presentes</h2>
          <div className="tags-presentes">
            {presentes.length > 0 ? (
              presentes.map((p) => (
                <div key={p.id} className="tag-present">
                  {p.foto && p.foto.trim() !== "" ? (
                    <img src={p.foto} alt={p.nome} className="tag-foto" />
                  ) : (
                    <div className="tag-foto-placeholder" />
                  )}
                  <span className="tag-nome">{p.nome}</span>
                  {p.partido && <span className="tag-partido">{p.partido.toUpperCase()}</span>}
                </div>
              ))
            ) : (
              <p>Nenhum parlamentar habilitado</p>
            )}
          </div>
        </div>
      </section>

      {/* Ordem do Dia (matérias) */}
      <section className="bloco-materias-central">
        <h2>Ordem do Dia</h2>
        {ordemDoDia.length > 0 ? (
          <table className="tabela-materias-central">
            <thead>
              <tr>
                <th>Título</th>
                <th>Tipo</th>
                <th>Autor</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {ordemDoDia.map((mat, idx) => (
                <tr key={mat.id || idx}>
                  <td>{mat.titulo || "-"}</td>
                  <td>{mat.tipo || "-"}</td>
                  <td>{mat.autor || "-"}</td>
                  <td>{mat.status || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <span>Nenhuma matéria cadastrada.</span>}
      </section>

      {/* Tribuna */}
      <section className="bloco-tribuna-central">
        <h2>Tribuna</h2>
        {oradorAtivo ? (
          <div className="conteudo-tribuna">
            <div className="tribuna-topo">
              {oradorAtivo.foto && oradorAtivo.foto.trim() !== "" ? (
                <img src={oradorAtivo.foto} alt={oradorAtivo.nome} className="foto-orador-destaque" />
              ) : (
                <div className="foto-orador-destaque foto-parlamentar-placeholder" />
              )}
              <div className="info-orador">
                <p><strong>Orador:</strong> {oradorAtivo.nome}</p>
                <p><strong>Partido:</strong> {oradorAtivo.partido || "—"}</p>
              </div>
              <div className={`timer-tribuna ${timerRed ? "timer-alert" : ""}`}>
                <span>{tempoRestante || 0}s</span>
              </div>
            </div>
            <div className="fala-resumida">
              <b>Resumo da fala:</b> {oradorAtivo.fala || "—"}
            </div>
          </div>
        ) : (
          <p>Sem orador na tribuna.</p>
        )}
      </section>

      {/* Bloco Votação e Gráfico */}
      <section className="bloco-votacao-central">
        <h2>Votação (Resultado Parcial)</h2>
        <div className="resultado-final">
          <p><strong>✅ Sim:</strong> {votosSim} | <strong>❌ Não:</strong> {votosNao} | <strong>⚪ Abstenções:</strong> {votosAbst}</p>
        </div>
        <div className="painel-grafico">
          <Bar data={graficoVotacao} />
        </div>
      </section>
    </div>
  );
}
