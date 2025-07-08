import React, { useEffect, useState, useRef } from "react";
import "./PainelVotacao.css";
import {
  doc,
  onSnapshot,
  getDocs,
  collection,
  query,
  where,
} from "firebase/firestore";
import { db } from "../firebase";
import { corrigirTextoPorIA, resumirTextoPorIA } from "../utils/openai";
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
  const recognitionRef = useRef(null);
  const [dadosPainel, setDadosPainel] = useState(null);
  const [presentes, setPresentes] = useState([]);
  const [votosRegistrados, setVotosRegistrados] = useState([]);
  const [legendas, setLegendas] = useState([]);
  const [fullTranscricao, setFullTranscricao] = useState("");
  const [textoCorrigido, setTextoCorrigido] = useState("");
  const [resumoFala, setResumoFala] = useState([]);
  const [timerRed, setTimerRed] = useState(false);
  const [beepPlayed, setBeepPlayed] = useState(false);

  // --- Botão Tela Auxiliar (abre nova aba) ---
  const abrirTelaAuxiliar = () => {
    window.open(window.location.href, '_blank', 'noopener,noreferrer');
  };

  // --- Fullscreen ---
  const entrarTelaCheia = () => {
    const elem = containerRef.current;
    if (!elem) return;
    if (elem.requestFullscreen) elem.requestFullscreen();
    else if (elem.webkitRequestFullscreen) elem.webkitRequestFullscreen();
    else if (elem.msRequestFullscreen) elem.msRequestFullscreen();
  };

  // --- Firestore painelAtivo/ativo ---
  useEffect(() => {
    const painelRef = doc(db, "painelAtivo", "ativo");
    const unsubscribe = onSnapshot(painelRef, async (snap) => {
      if (!snap.exists()) {
        setDadosPainel(null);
        return;
      }
      const data = snap.data();
      setDadosPainel(data);

      // Raw recognition: iniciar se tribuna ativa
      const tempo = data?.tribunaAtual?.tempoRestante ?? 0;
      if (
        data?.tribunaAtual?.nome &&
        data.tribunaAtual.cronometroAtivo &&
        tempo > 0
      ) {
        startRecognition();
      } else {
        stopRecognition();
      }

      // Corrigir e resumir fala ao final do reconhecimento (usando textoBruto)
      if (data?.tribunaAtual?.textoBruto) {
        const texto = await corrigirTextoPorIA(data.tribunaAtual.textoBruto);
        setTextoCorrigido(texto);
        const resumo = await resumirTextoPorIA(texto);
        setResumoFala(resumo);
      } else {
        setTextoCorrigido("");
        setResumoFala([]);
      }

      // Parlamentares presentes (habilitados)
      if (data?.votacaoAtual?.habilitados) {
        const ids = data.votacaoAtual.habilitados;
        if (ids.length > 0) {
          let docsResult = [];
          if (ids.length <= 10) {
            const q = query(collection(db, "vereadores"), where("__name__", "in", ids));
            const snapV = await getDocs(q);
            docsResult = snapV.docs.map((d) => ({ id: d.id, ...d.data() }));
          } else {
            const snapAll = await getDocs(collection(db, "vereadores"));
            const todos = snapAll.docs.map((d) => ({ id: d.id, ...d.data() }));
            docsResult = todos.filter((v) => ids.includes(v.id));
          }
          setPresentes(docsResult);
        } else {
          setPresentes([]);
        }
      } else {
        setPresentes([]);
      }

      // Votos registrados
      if (data?.votacaoAtual?.votos && typeof data.votacaoAtual.votos === "object") {
        const votosObj = data.votacaoAtual.votos;
        const arr = Object.values(votosObj).map((item) => ({ id: item.vereador_id, voto: item.voto || "" }));
        setVotosRegistrados(arr);
      } else {
        setVotosRegistrados([]);
      }

      // Timer em vermelho e beep
      if (data?.tribunaAtual?.tempoRestante <= 20 && data?.tribunaAtual?.tempoRestante > 0) {
        setTimerRed(true);
        if (!beepPlayed) {
          playBeep();
          setBeepPlayed(true);
        }
      } else {
        setTimerRed(false);
        setBeepPlayed(false);
      }
    });
    return () => {
      unsubscribe();
      stopRecognition();
    };
    // eslint-disable-next-line
  }, [beepPlayed]);

  // --- IA de Legenda (speech to text via navegador) ---
  const startRecognition = () => {
    if (recognitionRef.current) return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.lang = "pt-BR";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          let transcript = event.results[i][0].transcript.trim();
          transcript = transcript.charAt(0).toUpperCase() + transcript.slice(1);
          if (!/[.!?]$/.test(transcript)) transcript += ".";
          setLegendas((prev) => {
            const next = [...prev, transcript];
            if (next.length > 4) next.shift();
            return next;
          });
          setFullTranscricao((prev) => (prev + " " + transcript).trim());
        }
      }
    };
    recognition.onend = () => {
      if (dadosPainel?.tribunaAtual?.cronometroAtivo) recognition.start();
    };
    recognition.onerror = (err) => {
      console.error("Erro no reconhecimento de fala:", err);
    };
    recognition.start();
    recognitionRef.current = recognition;
  };

  const stopRecognition = () => {
    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
  };

  // --- Beep ao fim do tempo ---
  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.type = "square";
      oscillator.frequency.setValueAtTime(1000, audioCtx.currentTime);
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      oscillator.start();
      setTimeout(() => {
        oscillator.stop();
        audioCtx.close();
      }, 200);
    } catch (e) {
      console.warn("Erro ao tocar beep:", e);
    }
  };

  // --- Gráfico dos votos ---
  const gerarDadosGrafico = () => {
    if (!dadosPainel?.resultadoFinal) return null;
    return {
      labels: ["Sim", "Não", "Abstenção"],
      datasets: [
        {
          label: "Votos",
          data: [
            dadosPainel.resultadoFinal.sim || 0,
            dadosPainel.resultadoFinal.nao || 0,
            dadosPainel.resultadoFinal.abstencao || 0,
          ],
          backgroundColor: ["#2ecc71", "#e74c3c", "#f1c40f"],
        },
      ],
    };
  };
  const dadosGrafico = gerarDadosGrafico();

  // --- Mensagem aguardando sessão ---
  if (!dadosPainel) {
    return (
      <div style={{
        background: "#fff",
        minHeight: "100vh",
        width: "100vw",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "1.4rem",
        color: "#283955",
        fontWeight: 500,
        textAlign: "center"
      }}>
        Aguardando início da sessão...
      </div>
    );
  }

  // --- DADOS DA SESSÃO ---
  const {
    data: sessaoData,
    hora: sessaoHora,
    local: sessaoLocal,
    presidente: sessaoPresidente,
    secretario: sessaoSecretario,
    votacaoAtual,
    tribunaAtual,
    resultadoFinal = {},
    statusSessao,
    tipo,
    titulo,
    ordemDoDia,
    mesaDiretora,
    pauta,
    parlamentares,
  } = dadosPainel;

  // --- Painel ---
  return (
    <div className="painel-ia-container" ref={containerRef}>
      {/* TOPO: FULLSCREEN E TELA AUXILIAR */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 16, marginBottom: 12 }}>
        <button className="btn-tela-cheia" onClick={entrarTelaCheia} title="Tela Cheia">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <path d="M9 3H5a2 2 0 0 0-2 2v4m12-6h4a2 2 0 0 1 2 2v4m0 6v4a2 2 0 0 1-2 2h-4m-6 6H5a2 2 0 0 1-2-2v-4"
              stroke="#767b84" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button className="btn-tela-aux" onClick={abrirTelaAuxiliar} title="Espelhar para Tela Auxiliar">
          <svg width="28" height="28" fill="none" viewBox="0 0 24 24"><path d="M17 17h5v2a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-2h5M12 15V3m-4 4 4-4 4 4" stroke="#1670b0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      </div>

      {/* INFORMAÇÕES DA SESSÃO E PRESENTES */}
      <section className="sessao-info-presentes">
        <div className="info-gerais">
          <h2>Informações da Sessão</h2>
          <p><strong>Data:</strong> {sessaoData || "-"} | <strong>Hora:</strong> {sessaoHora || "-"}</p>
          <p><strong>Local:</strong> {sessaoLocal || "—"}</p>
          <p><strong>Presidente:</strong> {sessaoPresidente || "—"} | <strong>Secretário:</strong> {sessaoSecretario || "—"}</p>
          <p><strong>Status:</strong>{" "}
            <span className={`status-small status-${(statusSessao || "").toLowerCase()}`}>{statusSessao || "—"}</span>{" "}
            | <strong>Tipo:</strong> {tipo || "—"}
          </p>
          <p><strong>Pauta:</strong> {pauta || "—"}</p>
        </div>
        <div className="presentes-box">
          <h2>Parlamentares Presentes</h2>
          <div className="tags-presentes">
            {(parlamentares && parlamentares.length > 0) ? (
              parlamentares.filter((p) => p.presente).map((p) => (
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
              <p>Nenhum parlamentar presente</p>
            )}
          </div>
        </div>
      </section>

      {/* MESA DIRETORA */}
      <section className="mesa-diretora-bloco">
        <h2>Mesa Diretora</h2>
        <ul style={{ display: "flex", flexWrap: "wrap", gap: 28, listStyle: "none", paddingLeft: 0 }}>
          {(mesaDiretora || []).map((m, idx) => (
            <li key={idx} style={{ padding: 0 }}>
              <b>{m.nome}</b> <span style={{ color: "#888" }}>({m.cargo})</span>
            </li>
          ))}
        </ul>
      </section>

      {/* BLOCO TRIBUNA */}
      <section className="bloco-tribuna-central">
        <h2>Tribuna</h2>
        {dadosPainel?.tribuna && Array.isArray(dadosPainel.tribuna.oradores) && dadosPainel.tribuna.oradorAtivoIdx >= 0 ? (
          <div className="conteudo-tribuna">
            {(() => {
              const orador = dadosPainel.tribuna.oradores[dadosPainel.tribuna.oradorAtivoIdx];
              if (!orador) return <p>Sem orador na tribuna.</p>;
              return (
                <div className="tribuna-topo">
                  {orador.foto && orador.foto.trim() !== "" ? (
                    <img src={orador.foto} alt={orador.nome} className="foto-orador-destaque" />
                  ) : (
                    <img src="/assets/default-parlamentar.png" alt="Sem foto" className="foto-orador-destaque foto-parlamentar-placeholder" />
                  )}
                  <div className="info-orador">
                    <p><strong>Orador:</strong> {orador.nome}</p>
                    <p><strong>Partido:</strong> {orador.partido || "—"}</p>
                  </div>
                  <div className={`timer-tribuna ${timerRed ? "timer-alert" : ""}`}>
                    <span>{dadosPainel.tribuna.tempoRestante || 0}s</span>
                  </div>
                </div>
              );
            })()}
            <div className="overlay-legendas">
              {legendas.slice(-3).map((l, idx) => (
                <p key={idx} className="legenda-linha">{l}</p>
              ))}
            </div>
            <div className="fala-corrigida">
              <p>{textoCorrigido}</p>
            </div>
          </div>
        ) : (
          <p>Sem orador na tribuna.</p>
        )}
      </section>

      {/* RESUMO IA */}
      {resumoFala.length > 0 && (
        <section className="resumo-ia">
          <h3>🧠 Resumo da Fala do Orador</h3>
          <ul>
            {resumoFala.map((ponto, i) => (
              <li key={i}>{ponto}</li>
            ))}
          </ul>
        </section>
      )}

      {/* BLOCO PAUTA/ORDEM DO DIA */}
      <section className="bloco-votacao-central">
        <h2>Ordem do Dia</h2>
        {(ordemDoDia && ordemDoDia.length > 0) ? (
          <div className="conteudo-votacao-central">
            <ul style={{ paddingLeft: 18 }}>
              {ordemDoDia.map((m, idx) => (
                <li key={m.id || idx}>
                  <b>{m.titulo || m.descricao || "Sem título"}</b>
                  {m.tipo && <> — <span>{m.tipo}</span></>}
                  {m.autor && <> — <span>Autor: {m.autor}</span></>}
                  {m.status && <> — <span>Status: {m.status}</span></>}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p>Nenhuma matéria na ordem do dia.</p>
        )}
      </section>

      {/* BLOCO VOTAÇÃO */}
      <section className="bloco-votacao-central">
        <h2>Votação em Andamento</h2>
        {votacaoAtual && Array.isArray(votacaoAtual.materias) && votacaoAtual.materias.length > 0 ? (
          <div className="conteudo-votacao-central">
            {votacaoAtual.materias.map((m, idx) => (
              <div key={m.id || idx} className="votacao-detalhes">
                <p><strong>Matéria:</strong> {m.titulo || m.descricao || "Sem título"}</p>
                <p><strong>Tipo:</strong> {m.tipo || "—"}</p>
                <p><strong>Status:</strong>
                  <span className={`status-small status-${(m.status || "").toLowerCase().replace(" ", "-")}`}>
                    {m.status || "—"}
                  </span>
                </p>
                <p><strong>Autor:</strong> {m.autor || "—"}</p>
              </div>
            ))}
            {votosRegistrados.length > 0 ? (
              <table className="tabela-votos-central">
                <thead>
                  <tr>
                    <th>Vereador</th>
                    <th>Voto</th>
                  </tr>
                </thead>
                <tbody>
                  {votosRegistrados.map((item) => {
                    const dadosV = presentes.find((p) => p.id === item.id) || {};
                    return (
                      <tr key={item.id}>
                        <td>{dadosV.nome || "—"} <span className="sigla-partido">({dadosV.partido || "—"})</span></td>
                        <td>{item.voto === "" ? "Ainda não votou" : item.voto === "Sim" ? "✅ Sim" : "❌ Não"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <p>Nenhum voto registrado.</p>
            )}

            <div className="resultado-final">
              <p><strong>Resultado Final:</strong> {(() => {
                const simCount = votosRegistrados.filter((v) => v.voto === "Sim").length;
                const naoCount = votosRegistrados.filter((v) => v.voto === "Não").length;
                return `✅ Sim: ${simCount}  |  ❌ Não: ${naoCount}  |  ⚪ Abstenções: ${resultadoFinal.abstencao || 0}`;
              })()}</p>
            </div>

            {dadosGrafico && (
              <div className="painel-grafico">
                <h3>📊 Gráfico de Votação</h3>
                <Bar data={dadosGrafico} />
              </div>
            )}
          </div>
        ) : (
          <p>Nenhuma votação em andamento.</p>
        )}
      </section>
    </div>
  );
}
