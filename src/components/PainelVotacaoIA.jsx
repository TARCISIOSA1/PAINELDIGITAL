import React, { useEffect, useState } from "react";
import TopoInstitucional from "./TopoInstitucional";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend,
} from "chart.js";
import styles from "./PainelVotacaoIA.module.css";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

function Letreiro({ texto }) {
  if (!texto) return null;
  return (
    <div className={styles.letreiroMarquee}>
      <span>{texto}</span>
    </div>
  );
}

function BannerBoasVindas({ frase }) {
  return (
    <div className={styles.bannerBoasvindas}>
      <h1>{frase || "Bem-vindos à Sessão Plenária"}</h1>
    </div>
  );
}

export default function PainelVotacaoIA() {
  const [dados, setDados] = useState(null);
  const [presentes, setPresentes] = useState([]);
  const [votos, setVotos] = useState([]);
  const [width, setWidth] = useState(window.innerWidth);
  const [isFullscreen, setIsFullscreen] = useState(false);

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

  // Controle de fullscreen: detecta se está em tela cheia
  useEffect(() => {
    function onFullscreenChange() {
      setIsFullscreen(!!(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement
      ));
    }
    document.addEventListener("fullscreenchange", onFullscreenChange);
    document.addEventListener("webkitfullscreenchange", onFullscreenChange);
    document.addEventListener("mozfullscreenchange", onFullscreenChange);
    document.addEventListener("MSFullscreenChange", onFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", onFullscreenChange);
      document.removeEventListener("mozfullscreenchange", onFullscreenChange);
      document.removeEventListener("MSFullscreenChange", onFullscreenChange);
    };
  }, []);

  // Botão: Fullscreen
  function handleFullscreen() {
    const el = document.documentElement;
    if (el.requestFullscreen) el.requestFullscreen();
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    else if (el.msRequestFullscreen) el.msRequestFullscreen();
  }
  // Botão: Tela Auxiliar
  function abrirTelaAuxiliar() {
    window.open(window.location.href, "_blank", "width=1024,height=768");
  }

  if (!dados) {
    return <div className={styles.painelIaAguardando}>Aguardando início da sessão...</div>;
  }

  // Exibição em fullscreen tribuna
  if (dados?.tribunaAtual?.cronometroAtivo && dados?.tribunaAtual?.oradorAtivoIdx >= 0 && dados?.tribunaAtual?.oradores?.length > 0) {
    const idx = dados.tribunaAtual.oradorAtivoIdx;
    const orador = dados.tribunaAtual.oradores[idx];
    const parlamentar = (dados?.parlamentares || []).find(p => p.id === orador.id);
    return (
      <div className={styles.painelIaFullscreen}>
        <TopoInstitucional className={styles.topo} />
        <div className={styles.tribunaFull}>
          <img
            src={parlamentar?.foto || "/assets/default-parlamentar.png"}
            alt={orador.nome}
            className={styles.fotoOradorFull}
          />
          <div className={styles.tribunaFullInfo}>
            <div className={styles.tribunaFullNome}>{orador.nome}</div>
            <div className={styles.tribunaFullPartido}>{orador.partido}</div>
            <div className={styles.tribunaFullOrdem}>Ordem #{idx + 1}</div>
            <div className={styles.tribunaFullCronometro}>{dados.tribunaAtual.tempoRestante}s</div>
          </div>
          <div className={styles.legendaTribunaFull}>
            {dados.tribunaAtual.legenda || <span style={{color:"#ccc"}}>Legenda não disponível</span>}
          </div>
        </div>
        {!isFullscreen && (
          <div className={styles.fixedBtns}>
            <button className={styles.btnAuxiliar} onClick={abrirTelaAuxiliar} title="Abrir Tela Auxiliar">Tela Auxiliar</button>
            <button className={styles.btnFullscreen} onClick={handleFullscreen} title="Tela Cheia">Fullscreen</button>
          </div>
        )}
      </div>
    );
  }

  // Exibição em fullscreen votação
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
      <div className={styles.painelIaFullscreen}>
        <TopoInstitucional className={styles.topo} />
        <div className={styles.votacaoFull}>
          <h2>Votação em Andamento</h2>
          <Bar data={chartData} options={{responsive: true, maintainAspectRatio: false, plugins:{legend:{display:false}}}} />
        </div>
        {!isFullscreen && (
          <div className={styles.fixedBtns}>
            <button className={styles.btnAuxiliar} onClick={abrirTelaAuxiliar} title="Abrir Tela Auxiliar">Tela Auxiliar</button>
            <button className={styles.btnFullscreen} onClick={handleFullscreen} title="Tela Cheia">Fullscreen</button>
          </div>
        )}
      </div>
    );
  }

  // Exibição de sessão encerrada
  if (dados?.statusSessao === "Encerrada") {
    return (
      <div className={styles.painelIaEncerrada}>
        <TopoInstitucional className={styles.topo} />
        <BannerBoasVindas frase="Sessão encerrada! Fique atento às notícias e novidades." />
        <Letreiro texto={dados.ataCompleta || dados.ata || "Aguarde informações."} />
      </div>
    );
  }

  // Painel principal (normal)
  return (
    <div className={styles.painelContainer}>
      <TopoInstitucional className={styles.topo} />

      <div className={styles.painelFlexMain}>
        {/* Bloco de informações da sessão */}
        <div className={styles.painelBlocoInfo}>
          <div><b>Data:</b> {dados?.data || "-"} <b>Hora:</b> {dados?.hora || "-"}</div>
          <div><b>Local:</b> {dados?.local || "-"}</div>
          <div>
            <b>Legislatura:</b> {dados?.legislatura || "—"}
          </div>
          <div>
            <b>Sessão Legislativa:</b> {dados?.sessaoLegislativa || "—"}
          </div>
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

        {/* Bloco de Ordem do Dia, logo após informações da sessão */}
        <div className={styles.painelBlocoOrdem}>
          <h3>Ordem do Dia</h3>
          <div className={styles.ordemdiaLista}>
            {(dados?.ordemDoDia || []).length === 0
              ? <span style={{opacity:.7}}>Nenhuma matéria na pauta</span>
              : (dados?.ordemDoDia || []).map((mat, idx) => (
              <div key={mat.id || idx}
                className={styles.ordemItem}
                data-status={mat.status === "Aprovada" ? "aprovada"
                  : mat.status === "Rejeitada" ? "rejeitada"
                  : mat.status === "Sem Quórum" ? "semquorum" : ""}
              >
                <b>{mat.tipo === "materia" ? "Matéria" : "Ata"}:</b> {mat.titulo || "-"}<br />
                <b>Status:</b> {mat.status || "-"}<br />
                <b>Autor:</b> {mat.autor || "-"}
              </div>
            ))}
          </div>
        </div>

        {/* Bloco de habilitados bem expandido */}
        <div className={styles.painelBlocoPresentes}>
          <h3>Parlamentares Habilitados</h3>
          <div className={styles.presentesLista}>
            {(presentes.length === 0 ? <span style={{opacity:.7}}>Nenhum habilitado</span> :
              presentes.map(p => (
                <div className={styles.parlamentarMini} key={p.id}>
                  <img src={p.foto || "/assets/default-parlamentar.png"} alt={p.nome} />
                  <span className={styles.miniNome}>{p.nome}</span>
                  <span className={styles.miniPartido}>{p.partido}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Bloco da tribuna */}
        <div className={styles.painelBlocoTribuna}>
          <h3>Tribuna</h3>
          {dados?.tribunaAtual?.oradores?.length > 0 ? (
            <div className={styles.tribunaLista}>
              {dados.tribunaAtual.oradores.map((orador, idx) => {
                const parlamentar = (dados?.parlamentares || []).find(p => p.id === orador.id);
                const oradorAtivo = dados.tribunaAtual.oradorAtivoIdx === idx;
                return (
                  <div className={`${styles.oradorMini} ${oradorAtivo ? styles.oradorAtivo : ""}`} key={orador.id}>
                    <img src={parlamentar?.foto || "/assets/default-parlamentar.png"} alt={orador.nome} />
                    <span className={styles.miniNome}>{orador.nome}</span>
                    <span className={styles.miniPartido}>{orador.partido}</span>
                    <span className={styles.miniTempo}>{orador.tempoFala}s</span>
                    {oradorAtivo && (
                      <div className={styles.miniAtivoDestaque}>
                        <span>FALANDO AGORA</span>
                        <span className={styles.tribunaMiniCronometro}>{dados.tribunaAtual.tempoRestante || 0}s</span>
                        <div className={styles.legendaMini}>{dados.tribunaAtual.legenda || <span style={{color:"#888"}}>Legenda não disponível</span>}</div>
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

        {/* Bloco da votação */}
        <div className={styles.painelBlocoVotacao}>
          <h3>Votação</h3>
          <div className={styles.votacaoTabelaGrafico}>
            <table>
              <thead>
                <tr><th>Vereador</th><th>Voto</th></tr>
              </thead>
              <tbody>
                {presentes.map(parl => {
                  const voto = votos.find(v => v.id === parl.id);
                  return (
                    <tr key={parl.id}>
                      <td>{parl.nome} <span className={styles.partido}>({parl.partido})</span></td>
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
              <div className={styles.painelGraficoMini}>
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

      {!isFullscreen && (
        <div className={styles.fixedBtns}>
          <button className={styles.btnAuxiliar} onClick={abrirTelaAuxiliar} title="Abrir Tela Auxiliar">Tela Auxiliar</button>
          <button className={styles.btnFullscreen} onClick={handleFullscreen} title="Tela Cheia">Fullscreen</button>
        </div>
      )}
    </div>
  );
}
