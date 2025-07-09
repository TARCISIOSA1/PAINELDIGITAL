import React, { useEffect, useState } from "react";
import TopoInstitucional from "./TopoInstitucional";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend,
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

// Banner simples institucional
function BannerBoasVindas({ frase }) {
  return (
    <div className="banner-boasvindas">
      <h1>{frase || "Bem-vindos à Sessão Plenária"}</h1>
    </div>
  );
}

export default function PainelVotacaoIA() {
  const [dados, setDados] = useState(null);
  const [presentes, setPresentes] = useState([]);
  const [votos, setVotos] = useState([]);
  const [width, setWidth] = useState(window.innerWidth);

  // Atualiza tamanho para responsividade adaptada
  useEffect(() => {
    const handleResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, "painelAtivo", "ativo"), (docSnap) => {
      const data = docSnap.data();
      setDados(data || {});
      setPresentes(
        (data?.parlamentares || []).filter(p =>
          (data?.habilitados || []).includes(p.id)
        )
      );
      // Protege votos: só processa se existir
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

  if (!dados) {
    return <div className="painel-ia-aguardando">Aguardando início da sessão...</div>;
  }

  // ---- FULLSCREEN TRIBUNA, quando há orador ativo ----
  if (dados?.tribunaAtual?.cronometroAtivo && dados?.tribunaAtual?.oradorAtivoIdx >= 0 && dados?.tribunaAtual?.oradores?.length > 0) {
    const idx = dados.tribunaAtual.oradorAtivoIdx;
    const orador = dados.tribunaAtual.oradores[idx];
    const parlamentar = (dados?.parlamentares || []).find(p => p.id === orador.id);
    return (
      <div className="painel-ia-fullscreen">
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
            <div className="tribuna-full-cronometro">{dados.tribunaAtual.tempoRestante}s</div>
          </div>
          <div className="legenda-tribuna-full">
            {dados.tribunaAtual.legenda || <span style={{color:"#ccc"}}>Legenda não disponível</span>}
          </div>
        </div>
      </div>
    );
  }

  // ---- FULLSCREEN VOTAÇÃO, quando votação estiver "Em votação" ----
  if (dados?.votacaoAtual?.status === "Em votação") {
    const resultado = dados?.votacaoAtual?.resultado || {};
    const chartData = {
      labels: ["Sim", "Não", "Abstenção"],
      datasets: [
        {
          label: "Votos",
          data: [resultado.sim || 0, resultado.nao || 0, resultado.abstencao || 0],
          borderWidth: 1,
        },
      ],
    };
    return (
      <div className="painel-ia-fullscreen">
        <TopoInstitucional />
        <div className="votacao-full">
          <h2>Votação em Andamento</h2>
          <Bar data={chartData} options={{responsive: true, maintainAspectRatio: false, plugins:{legend:{display:false}}}} />
        </div>
      </div>
    );
  }

  // ---- APÓS ENCERRAR, exibe letreiro/ata/mensagens ----
  if (dados?.statusSessao === "Encerrada") {
    return (
      <div className="painel-ia-encerrada">
        <TopoInstitucional />
        <BannerBoasVindas frase="Sessão encerrada! Fique atento às notícias e novidades." />
        <Letreiro texto={dados.ataCompleta || dados.ata || "Aguarde informações."} />
      </div>
    );
  }

  // ---- LAYOUT COMPACTO PADRÃO ----
  // Ajuste máximo de linhas por bloco para caber sem scroll em telas > 1200px.
  // No celular/tablet, layout colunar.

  return (
    <div className="painel-ia-container">
      <TopoInstitucional />

      <div className="painel-flex-main">
        {/* Sessão e mesa diretora */}
        <div className="painel-bloco-info">
          <div><b>Data:</b> {dados?.data || "-"} <b>Hora:</b> {dados?.hora || "-"}</div>
          <div><b>Local:</b> {dados?.local || "-"}</div>
          <div>
            <b>Status:</b>{" "}
            <span className={`status-tag status-${(dados?.statusSessao || "").toLowerCase()}`}>{dados?.statusSessao || "-"}</span>
          </div>
          <div>
            <b>Presidente:</b> {dados?.mesaDiretora?.find(x => x.cargo === "Presidente")?.nome || "-"}
          </div>
          <div>
            <b>Vice:</b> {dados?.mesaDiretora?.find(x => x.cargo === "Vice-Presidente")?.nome || "-"}
          </div>
          <div>
            <b>Secretário:</b> {dados?.mesaDiretora?.find(x => x.cargo === "Secretário")?.nome || "-"}
          </div>
        </div>

        {/* Presentes/habilitados */}
        <div className="painel-bloco-presentes">
          <h3>Habilitados</h3>
          <div className="presentes-lista">
            {(presentes.length === 0 ? <span style={{opacity:.7}}>Nenhum habilitado</span> :
              presentes.slice(0, width > 600 ? 6 : 3).map(p => (
                <div className="parlamentar-mini" key={p.id}>
                  <img src={p.foto || "/assets/default-parlamentar.png"} alt={p.nome} />
                  <span className="mini-nome">{p.nome}</span>
                  <span className="mini-partido">{p.partido}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Tribuna com oradores */}
        <div className="painel-bloco-tribuna">
          <h3>Tribuna</h3>
          {dados?.tribunaAtual?.oradores?.length > 0 ? (
            <div className="tribuna-lista">
              {dados.tribunaAtual.oradores.map((orador, idx) => {
                const parlamentar = (dados?.parlamentares || []).find(p => p.id === orador.id);
                const oradorAtivo = dados.tribunaAtual.oradorAtivoIdx === idx;
                return (
                  <div className={`orador-mini ${oradorAtivo ? "orador-ativo" : ""}`} key={orador.id}>
                    <img src={parlamentar?.foto || "/assets/default-parlamentar.png"} alt={orador.nome} />
                    <span className="mini-nome">{orador.nome}</span>
                    <span className="mini-partido">{orador.partido}</span>
                    <span className="mini-tempo">{orador.tempoFala}s</span>
                    {oradorAtivo && (
                      <div className="mini-ativo-destaque">
                        <span>FALANDO AGORA</span>
                        <span className="tribuna-mini-cronometro">{dados.tribunaAtual.tempoRestante || 0}s</span>
                        <div className="legenda-mini">{dados.tribunaAtual.legenda || <span style={{color:"#888"}}>Legenda não disponível</span>}</div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <span style={{opacity:.7}}>Nenhum orador</span>
          )}
        </div>

        {/* Ordem do dia */}
        <div className="painel-bloco-ordem">
          <h3>Ordem do Dia</h3>
          <div className="ordemdia-lista">
            {(dados?.ordemDoDia || []).slice(0, width > 600 ? 3 : 2).map((mat, idx) => (
              <div key={mat.id || idx} className="ordem-item">
                <b>{mat.tipo === "materia" ? "Matéria" : "Ata"}:</b> {mat.titulo || "-"}<br />
                <b>Status:</b> {mat.status || "-"}<br />
                <b>Autor:</b> {mat.autor || "-"}
              </div>
            ))}
          </div>
        </div>

        {/* Votação */}
        <div className="painel-bloco-votacao">
          <h3>Votação</h3>
          <div className="votacao-tabela-grafico">
            <table>
              <thead>
                <tr><th>Vereador</th><th>Voto</th></tr>
              </thead>
              <tbody>
                {presentes.slice(0, width > 600 ? 6 : 3).map(parl => {
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
            {dados?.votacaoAtual?.resultado && (
              <div className="painel-grafico-mini">
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
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins:{legend:{display:false}},
                    scales: { y: { ticks: { stepSize: 1, precision: 0 } } }
                  }}
                  height={width > 600 ? 80 : 60}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <Letreiro texto={dados?.ata || dados?.ataCompleta || ""} />
    </div>
  );
}
