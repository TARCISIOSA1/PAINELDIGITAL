import React, { useEffect, useState, useRef } from "react";
import TopoInstitucional from "./TopoInstitucional";
import { doc, onSnapshot } from "firebase/firestore";
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
import "./PainelVotacaoIA.css";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

function Letreiro({ texto }) {
  if (!texto) return null;
  return (
    <div className="letreiro-marquee">
      <span>{texto}</span>
    </div>
  );
}

function BannerBoasVindas({ frase }) {
  return (
    <div className="banner-boasvindas">
      <h1>{frase || "Bem-vindos à Sessão Plenária"}</h1>
    </div>
  );
}

export default function PainelVotacaoIA() {
  const [dados, setDados] = useState(null);
  const [habilitados, setHabilitados] = useState([]);
  const [presentes, setPresentes] = useState([]);
  const [votos, setVotos] = useState([]);
  const [fullTribuna, setFullTribuna] = useState(false);
  const [fullVotacao, setFullVotacao] = useState(false);
  const containerRef = useRef(null);

  // Painel ativo Firestore
  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, "painelAtivo", "ativo"), (docSnap) => {
      const data = docSnap.data();
      setDados(data);

      // Habilitados (para votar)
      setHabilitados(data?.habilitados || []);

      // Presentes (dados completos)
      setPresentes(data?.parlamentares?.filter(p =>
        (data?.habilitados || []).includes(p.id)
      ) || []);

      // Votos
      const votosObj = data?.votacaoAtual?.votos || {};
      setVotos(
        Object.keys(votosObj).map((vid) => ({
          id: vid,
          voto: votosObj[vid]?.voto || "",
        }))
      );
    });
    return () => unsubscribe();
  }, []);

  // --- FULL TRIBUNA / VOTAÇÃO ---
  useEffect(() => {
    if (dados?.tribunaAtual?.cronometroAtivo && dados?.tribunaAtual?.oradorAtivoIdx >= 0) setFullTribuna(true);
    else setFullTribuna(false);

    if (dados?.votacaoAtual?.status === "Em votação") setFullVotacao(true);
    else setFullVotacao(false);
  }, [dados]);

  if (!dados) {
    return <div className="painel-ia-aguardando">Aguardando início da sessão...</div>;
  }

  // ---- FULL TRIBUNA (quando ativo) ----
  if (fullTribuna && dados.tribunaAtual?.oradores?.length > 0) {
    const idx = dados.tribunaAtual.oradorAtivoIdx;
    const orador = dados.tribunaAtual.oradores[idx];
    const parlamentar = dados.parlamentares?.find(p => p.id === orador.id);

    return (
      <div className="painel-ia-fullscreen" ref={containerRef}>
        <TopoInstitucional />
        <div className="tribuna-full">
          <img
            src={parlamentar?.foto || "/assets/default-parlamentar.png"}
            alt={orador.nome}
            className="foto-orador-full"
          />
          <div className="tribuna-full-info">
            <div className="tribuna-full-nome">{orador.nome}</div>
            <div className="tribuna-full-partido">{orador.partido}</div>
            <div className="tribuna-full-ordem">Ordem #{idx + 1}</div>
          </div>
          <div className="tribuna-full-tempo">
            {dados.tribunaAtual.tempoRestante}s
          </div>
        </div>
        {/* Legenda IA */}
        <div className="legenda-tribuna-full">
          {dados.tribunaAtual.legenda || <span style={{ color: "#ccc" }}>Legenda não disponível</span>}
        </div>
      </div>
    );
  }

  // ---- FULL VOTAÇÃO (quando ativo) ----
  if (fullVotacao) {
    const resultado = dados.votacaoAtual?.resultado || {};
    const chartData = {
      labels: ["Sim", "Não", "Abstenção"],
      datasets: [
        {
          label: "Votos",
          data: [
            resultado.sim || 0,
            resultado.nao || 0,
            resultado.abstencao || 0,
          ],
        },
      ],
    };
    return (
      <div className="painel-ia-fullscreen" ref={containerRef}>
        <TopoInstitucional />
        <div className="votacao-full">
          <h2>Votação em Andamento</h2>
          <Bar data={chartData} />
        </div>
      </div>
    );
  }

  // --- BANNER NOTÍCIAS APÓS ENCERRAR ---
  if (dados.statusSessao === "Encerrada") {
    return (
      <div className="painel-ia-encerrada">
        <TopoInstitucional />
        <BannerBoasVindas frase="Sessão encerrada! Fique atento às notícias e novidades." />
        <Letreiro texto={dados.ataCompleta || dados.ata || "Aguarde informações."} />
      </div>
    );
  }

  // --- LAYOUT NORMAL ---
  return (
    <div className="painel-ia-container" ref={containerRef}>
      <TopoInstitucional />

      {/* Cabeçalho Sessão + Mesa */}
      <div className="painel-ia-header">
        <div className="sessao-info">
          <div>
            <strong>Data:</strong> {dados.data || "-"} <strong>Hora:</strong> {dados.hora || "-"}
          </div>
          <div><strong>Local:</strong> {dados.local || "-"}</div>
          <div>
            <strong>Status:</strong>{" "}
            <span className={`status-tag status-${(dados.statusSessao || "").toLowerCase()}`}>{dados.statusSessao || "-"}</span>
            {" | "}
            <strong>Tipo:</strong> {dados.tipo || "-"}
          </div>
        </div>
        <div className="mesa-diretora">
          <div><strong>Presidente:</strong> {dados.mesaDiretora?.find(x => x.cargo === "Presidente")?.nome || "-"}</div>
          <div><strong>Vice:</strong> {dados.mesaDiretora?.find(x => x.cargo === "Vice-Presidente")?.nome || "-"}</div>
          <div><strong>Secretário:</strong> {dados.mesaDiretora?.find(x => x.cargo === "Secretário")?.nome || "-"}</div>
        </div>
      </div>

      {/* Parlamentares Habilitados */}
      <div className="parlamentares-habilitados">
        <h3>Parlamentares Presentes/Habilitados</h3>
        <div className="parlamentares-lista">
          {presentes.length === 0 ? "Nenhum habilitado." :
            presentes.map(p => (
              <div className="parlamentar-tag" key={p.id}>
                <img src={p.foto || "/assets/default-parlamentar.png"} alt={p.nome} />
                <span className="nome">{p.nome}</span>
                <span className="partido">{p.partido}</span>
              </div>
            ))
          }
        </div>
      </div>

      {/* Tribuna - Lista e orador ativo */}
      <section className="bloco-tribuna-central">
        <h3>Tribuna</h3>
        {dados.tribunaAtual?.oradores?.length > 0 ? (
          <div className="lista-oradores">
            {dados.tribunaAtual.oradores.map((orador, idx) => {
              const parlamentar = dados.parlamentares?.find(p => p.id === orador.id);
              const oradorAtivo = dados.tribunaAtual.oradorAtivoIdx === idx;
              return (
                <div
                  key={orador.id}
                  className={`orador-linha ${oradorAtivo ? "orador-ativo" : ""}`}
                >
                  <img src={parlamentar?.foto || "/assets/default-parlamentar.png"} alt={orador.nome} />
                  <span className="orador-nome">{orador.nome}</span>
                  <span className="partido">{orador.partido}</span>
                  <span className="orador-tempo">{orador.tempoFala}s</span>
                  {oradorAtivo && (
                    <>
                      <span className="orador-ativo-destaque">FALANDO AGORA</span>
                      <span className="tribuna-cronometro">{dados.tribunaAtual.tempoRestante || 0}s</span>
                      <div className="legenda-ia">
                        {dados.tribunaAtual.legenda || <span style={{ color: "#888" }}>Legenda não disponível</span>}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div>Nenhum orador na tribuna.</div>
        )}
      </section>

      {/* Ordem do Dia */}
      <section className="bloco-ordemdia">
        <h3>Ordem do Dia</h3>
        <div className="ordem-lista">
          {(dados.ordemDoDia || []).map((mat, idx) => (
            <div key={mat.id || idx} className="ordem-mat-item">
              <strong>{mat.tipo === "materia" ? "Matéria" : "Ata"}:</strong> {mat.titulo || "-"}
              <span> | <strong>Status:</strong> {mat.status || "-"} </span>
              <span> | <strong>Autor:</strong> {mat.autor || "-"} </span>
            </div>
          ))}
        </div>
      </section>

      {/* Votação */}
      <section className="bloco-votacao-central">
        <h3>Votação</h3>
        <table className="tabela-votos-central">
          <thead>
            <tr><th>Vereador</th><th>Voto</th></tr>
          </thead>
          <tbody>
            {presentes.map(parl => {
              const voto = votos.find(v => v.id === parl.id);
              return (
                <tr key={parl.id}>
                  <td>{parl.nome} <span className="partido">({parl.partido})</span></td>
                  <td>
                    {voto ? (
                      voto.voto === "sim"
                        ? "✅ Sim"
                        : voto.voto === "nao"
                        ? "❌ Não"
                        : voto.voto === "abstencao"
                        ? "⚪ Abstenção"
                        : voto.voto
                    ) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {/* Gráfico Resultado Final */}
        {dados.votacaoAtual?.resultado && (
          <div className="painel-grafico">
            <Bar
              data={{
                labels: ["Sim", "Não", "Abstenção"],
                datasets: [{
                  label: "Votos",
                  data: [
                    dados.votacaoAtual.resultado.sim || 0,
                    dados.votacaoAtual.resultado.nao || 0,
                    dados.votacaoAtual.resultado.abstencao || 0,
                  ],
                  borderWidth: 1,
                }]
              }}
            />
          </div>
        )}
      </section>

      {/* Letreiro/ata/mensagens rápidas */}
      <Letreiro texto={dados.ata || dados.ataCompleta || ""} />
    </div>
  );
}
