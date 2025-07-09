import React, { useEffect, useState, useRef } from "react";
import TopoInstitucional from "./TopoInstitucional";
import panelConfig from "../config/panelConfig.json";
import { doc, onSnapshot, getDocs, collection, query, where } from "firebase/firestore";
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

// ========== COMPONENTE LEGENDA IA (Só ativa no ADM) ==========
function LegendaWhisper({ ativo, tribunaAtual, dadosPainel, onLegenda }) {
  // Reproduz a legenda IA (áudio apenas máquina ADM)
  const [legenda, setLegenda] = useState("");
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const ativoRef = useRef(ativo);

  useEffect(() => { ativoRef.current = ativo; }, [ativo]);

  useEffect(() => {
    let gravaLoop = false;
    async function startGravacao() {
      if (!ativoRef.current) return;
      try {
        if (!streamRef.current || !streamRef.current.active) {
          streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
        }
        gravaLoop = true;
        async function gravarBloco() {
          if (!gravaLoop || !ativoRef.current) return;
          let chunks = [];
          const recorder = new window.MediaRecorder(streamRef.current, { mimeType: "audio/webm" });
          mediaRecorderRef.current = recorder;
          recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
          recorder.onstop = async () => {
            if (!gravaLoop || !ativoRef.current) return;
            if (chunks.length === 0) return;
            const blob = new Blob(chunks, { type: "audio/webm" });
            if (blob.size < 4000) { if (gravaLoop && ativoRef.current) setTimeout(gravarBloco, 150); return; }
            const formData = new FormData();
            formData.append("file", blob, "audio.webm");
            try {
              const res = await fetch("http://localhost:3333/api/whisper", { method: "POST", body: formData });
              const data = await res.json();
              const texto = data.text || "⚠️ Nada transcrito.";
              setLegenda(texto);
              onLegenda(texto);
            } catch {
              setLegenda("❌ Erro ao transcrever.");
              onLegenda("❌ Erro ao transcrever.");
            }
            if (gravaLoop && ativoRef.current) setTimeout(gravarBloco, 150);
          };
          recorder.start();
          setTimeout(() => { if (recorder.state !== "inactive") recorder.stop(); }, 3500);
        }
        gravarBloco();
      } catch {
        setLegenda("❌ Erro ao acessar microfone.");
        onLegenda("❌ Erro ao acessar microfone.");
      }
    }
    if (ativo) { startGravacao(); }
    else {
      gravaLoop = false;
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") { mediaRecorderRef.current.stop(); }
      if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    }
    return () => {
      gravaLoop = false;
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") { mediaRecorderRef.current.stop(); }
      if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    };
  }, [ativo, tribunaAtual, dadosPainel, onLegenda]);

  return null; // Legenda é exibida no painel principal, aqui só envia para o pai
}

// ========== BANNER IA Pós-Sessão ==========
function BannerMensagemIA({ frase, noticia }) {
  return (
    <div className="banner-ia-encerrada">
      <h1>{frase || "Sessão Encerrada!"}</h1>
      {noticia && noticia.frase && (
        <div className="banner-ia-noticia">
          <span>📰 {noticia.frase}</span>
        </div>
      )}
    </div>
  );
}

// ========== PAINEL PRINCIPAL ==========
export default function PainelVotacaoIA() {
  const containerRef = useRef(null);
  const [dadosPainel, setDadosPainel] = useState(null);
  const [presentes, setPresentes] = useState([]);
  const [legenda, setLegenda] = useState("");
  const [fullTribuna, setFullTribuna] = useState(false);
  const [fullVotacao, setFullVotacao] = useState(false);
  const [msgEncerrada, setMsgEncerrada] = useState("");
  const [noticiaIA, setNoticiaIA] = useState("");
  const [votosRegistrados, setVotosRegistrados] = useState([]);
  const [telaAuxiliar, setTelaAuxiliar] = useState(false);

  // -------- Fetch dados painel ativo --------
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "painelAtivo", "ativo"), async (docSnap) => {
      const data = docSnap.data();
      setDadosPainel(data);

      // Presentes (parlamentares habilitados)
      let habilitados = data?.habilitados || [];
      if (!habilitados.length && data?.votacaoAtual?.habilitados) {
        habilitados = data.votacaoAtual.habilitados;
      }
      let docs = [];
      if (habilitados.length > 0) {
        if (habilitados.length <= 10) {
          const q = query(collection(db, "parlamentares"), where("__name__", "in", habilitados));
          docs = (await getDocs(q)).docs.map(d => ({ id: d.id, ...d.data() }));
        } else {
          const all = (await getDocs(collection(db, "parlamentares"))).docs.map(d => ({ id: d.id, ...d.data() }));
          docs = all.filter(v => habilitados.includes(v.id));
        }
      }
      setPresentes(docs);

      // Votos
      const votos = data?.votacaoAtual?.votos || {};
      setVotosRegistrados(Object.entries(votos).map(([id, voto]) => ({ id, ...voto })));
    });
    return () => unsub();
  }, []);

  // -------- Mensagens IA pós-sessão --------
  useEffect(() => {
    let noticiaInterval = null;
    async function carregarNoticia() {
      fetch("http://localhost:3334/api/noticiaia")
        .then((r) => r.json())
        .then((d) => setNoticiaIA(d))
        .catch(() => setNoticiaIA({ frase: "Acompanhe as novidades nas redes sociais!" }));
    }
    if (dadosPainel && dadosPainel.statusSessao === "Encerrada") {
      fetch("http://localhost:3334/api/sessaoencerrada")
        .then((r) => r.json())
        .then((d) => setMsgEncerrada(d.frase || "Sessão encerrada!"))
        .catch(() => setMsgEncerrada("Sessão encerrada!"));
      carregarNoticia();
      noticiaInterval = setInterval(carregarNoticia, 20000);
    } else {
      setMsgEncerrada("");
      setNoticiaIA("");
    }
    return () => { if (noticiaInterval) clearInterval(noticiaInterval); };
  }, [dadosPainel?.statusSessao]);

  // --------- CAMPOS DERIVADOS ----------
  const {
    data: sessaoData,
    hora: sessaoHora,
    local: sessaoLocal,
    presidente,
    mesaDiretora,
    tipo,
    statusSessao,
    ordemDoDia,
    tribunaAtual,
    votacaoAtual,
    resultadoFinal,
    quorumMinimo,
  } = dadosPainel || {};

  // Presidente (prioriza mesaDiretora se disponível)
  const nomePresidente = presidente ||
    (Array.isArray(mesaDiretora)
      ? (mesaDiretora.find(m =>
        m.cargo &&
        m.cargo.trim().toLowerCase() === "presidente"
      )?.nome)
      : null) || "—";

  // ============= FULLSCREEN AUTOMÁTICO TRIBUNA ==========
  useEffect(() => {
    if (tribunaAtual?.nome && tribunaAtual.tempoRestante > 0 && !fullTribuna) {
      setFullTribuna(true);
    } else if ((!tribunaAtual?.nome || tribunaAtual.tempoRestante <= 0) && fullTribuna) {
      setFullTribuna(false);
    }
  }, [tribunaAtual]);

  // ============= FULLSCREEN AUTOMÁTICO VOTAÇÃO ==========
  useEffect(() => {
    if (votacaoAtual?.status === "em_votacao" && !fullVotacao) {
      setFullVotacao(true);
    } else if ((!votacaoAtual || votacaoAtual.status !== "em_votacao") && fullVotacao) {
      setFullVotacao(false);
    }
  }, [votacaoAtual]);

  // ============= TELA AUXILIAR (expansão automática) ==========
  useEffect(() => {
    if (telaAuxiliar) {
      // abrir nova janela/tela (TV/monitor auxiliar)
      window.open(window.location.href + "?aux", "_blank", "noopener,noreferrer");
      setTelaAuxiliar(false);
    }
  }, [telaAuxiliar]);

  // ============= GRÁFICO DE VOTAÇÃO ==========
  const dadosGrafico = resultadoFinal ? {
    labels: ["Sim", "Não", "Abstenção"],
    datasets: [{
      label: "Votos",
      data: [resultadoFinal.sim || 0, resultadoFinal.nao || 0, resultadoFinal.abstencao || 0],
      backgroundColor: ["#2ecc71", "#e74c3c", "#f1c40f"],
      borderWidth: 2,
      borderRadius: 8,
    }]
  } : null;

  // ============= SESSÃO ENCERRADA/MODO NOTÍCIAS ==========
  if (!dadosPainel || statusSessao === "Encerrada") {
    return (
      <div className="painel-ultra-container" ref={containerRef}>
        <TopoInstitucional />
        <BannerMensagemIA frase={msgEncerrada} noticia={noticiaIA} />
        <div className="painel-ultra-info" style={{ textAlign: "center", margin: 32 }}>
          <img src={panelConfig.logoPath || "/logo-camara.png"} alt="Logo Câmara" className="painel-logo" />
          <div className="painel-news-ia">
            <h3>Resumo da Sessão</h3>
            {resultadoFinal && dadosGrafico &&
              <div style={{ maxWidth: 420, margin: "0 auto" }}>
                <Bar data={dadosGrafico} />
                <p style={{ margin: 8, fontSize: 20, fontWeight: 600 }}>
                  ✅ Sim: {resultadoFinal.sim || 0} | ❌ Não: {resultadoFinal.nao || 0} | ⚪ Abstenção: {resultadoFinal.abstencao || 0}
                </p>
              </div>
            }
            <p style={{ margin: 20, color: "#888" }}>Aguarde novas sessões ou acompanhe nossas redes sociais!</p>
          </div>
        </div>
      </div>
    );
  }

  // ============= FULLSCREEN TRIBUNA ==========
  if (fullTribuna && tribunaAtual?.nome) {
    return (
      <div className="painel-fullscreen-tribuna" ref={containerRef}>
        <TopoInstitucional />
        <div className="full-tribuna-main">
          <img src={tribunaAtual.fotoURL || "/assets/default-parlamentar.png"} alt={tribunaAtual.nome} className="full-foto-orador" />
          <div className="full-orador-info">
            <h2>{tribunaAtual.nome}</h2>
            <span className="full-partido">{tribunaAtual.partido ? `(${tribunaAtual.partido})` : ""}</span>
          </div>
          <div className="full-cronometro">
            <span>{tribunaAtual.tempoRestante || 0}s</span>
          </div>
          <div className="full-legenda">
            {legenda ? <span>{legenda}</span> : <span style={{ color: "#888" }}>Legenda IA aguardando...</span>}
          </div>
        </div>
      </div>
    );
  }

  // ============= FULLSCREEN VOTAÇÃO ==========
  if (fullVotacao && votacaoAtual) {
    return (
      <div className="painel-fullscreen-votacao" ref={containerRef}>
        <TopoInstitucional />
        <div className="full-votacao-main">
          <h2>Votação em Andamento</h2>
          {votacaoAtual.materias && votacaoAtual.materias.length > 0 && (
            <div className="materias-list">
              {votacaoAtual.materias.map((mat, idx) => (
                <div key={idx} className="votacao-materia">
                  <p><strong>Matéria:</strong> {mat.titulo}</p>
                  <p><strong>Tipo:</strong> {mat.tipo || "—"}</p>
                  <p><strong>Autor:</strong> {mat.autor || "—"}</p>
                </div>
              ))}
            </div>
          )}
          {dadosGrafico && (
            <div style={{ maxWidth: 480, margin: "0 auto" }}>
              <Bar data={dadosGrafico} />
            </div>
          )}
          <div className="tabela-votos-full">
            <table>
              <thead>
                <tr><th>Vereador</th><th>Voto</th></tr>
              </thead>
              <tbody>
                {votosRegistrados.map(item => {
                  const dv = presentes.find(p => p.id === item.id) || {};
                  return (
                    <tr key={item.id}>
                      <td>{dv.nome || "—"} <span className="sigla-partido">({dv.partido || "—"})</span></td>
                      <td>
                        {item.voto === "sim" ? "✅ Sim"
                          : item.voto === "nao" ? "❌ Não"
                          : item.voto === "abstencao" ? "⚪ Abstenção"
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // ============= PAINEL NORMAL (Responsivo e Profissional) ==========
  return (
    <div className="painel-ultra-container" ref={containerRef}>
      {/* LEGENDA IA SÓ ATIVA SE ADM (Painel de Controle) estiver usando */}
      <LegendaWhisper
        ativo={!!(tribunaAtual?.tempoRestante > 0)}
        tribunaAtual={tribunaAtual}
        dadosPainel={dadosPainel}
        onLegenda={setLegenda}
      />

      <TopoInstitucional />

      <section className="sessao-info-ultra">
        <div className="info-gerais">
          <h2>Informações da Sessão</h2>
          <p><strong>Data:</strong> {sessaoData || "-"} | <strong>Hora:</strong> {sessaoHora || "-"}</p>
          <p><strong>Local:</strong> {sessaoLocal || "—"}</p>
          <p><strong>Status:</strong> <span className={`status-ultra status-${(statusSessao || "").toLowerCase()}`}>{statusSessao || "—"}</span> | <strong>Tipo:</strong> {tipo || "—"}</p>
        </div>
        <div className="mesa-diretora-ultra">
          <h3>Mesa Diretora</h3>
          <ul>
            {Array.isArray(mesaDiretora) && mesaDiretora.length > 0
              ? mesaDiretora.map((m, i) => (
                <li key={i}>
                  <span className="mesa-cargo">{m.cargo}:</span> {m.nome}
                </li>
              ))
              : <li>—</li>
            }
          </ul>
        </div>
      </section>

      <section className="presentes-ultra">
        <h2>Parlamentares Presentes</h2>
        <div className="tags-presentes-ultra">
          {presentes.length > 0 ? presentes.map(p => (
            <div key={p.id} className="tag-present-ultra">
              {p.foto ? <img src={p.foto} alt={p.nome} className="tag-foto-ultra" /> : <div className="tag-foto-placeholder-ultra" />}
              <span className="tag-nome-ultra">{p.nome}</span>
              {p.partido && <span className="tag-partido-ultra">{p.partido.toUpperCase()}</span>}
            </div>
          )) : <p>Nenhum parlamentar presente</p>}
        </div>
      </section>

      <section className="tribuna-ultra">
        <h2>Tribuna</h2>
        {tribunaAtual?.nome ? (
          <div className="conteudo-tribuna-ultra">
            <img src={tribunaAtual.fotoURL || "/assets/default-parlamentar.png"} alt={tribunaAtual.nome} className="foto-orador-ultra" />
            <div className="orador-info-ultra">
              <h3>{tribunaAtual.nome}</h3>
              <span className="orador-partido-ultra">{tribunaAtual.partido ? `(${tribunaAtual.partido})` : ""}</span>
            </div>
            <div className="cronometro-ultra">{tribunaAtual.tempoRestante || 0}s</div>
            <div className="legenda-ultra">
              {legenda ? <span>{legenda}</span> : <span style={{ color: "#888" }}>Legenda IA aguardando...</span>}
            </div>
          </div>
        ) : <p>Nenhum orador na tribuna.</p>}
      </section>

      <section className="ordem-ultra">
        <h2>Ordem do Dia</h2>
        {Array.isArray(ordemDoDia) && ordemDoDia.length > 0 ? (
          <div className="ordem-list-ultra">
            {ordemDoDia.map((mat, idx) => (
              <div key={idx} className="ordem-materia-ultra">
                <p><strong>{mat.tipo === "materia" ? "Matéria" : "Ata"}:</strong> {mat.titulo || "—"}</p>
                <p><strong>Status:</strong> {mat.status || "—"} <strong>Autor:</strong> {mat.autor || "—"}</p>
              </div>
            ))}
          </div>
        ) : <p>Nenhuma matéria/ata na ordem do dia.</p>}
      </section>

      <section className="votacao-ultra">
        <h2>Votação</h2>
        {dadosGrafico && (
          <div className="painel-grafico-ultra">
            <Bar data={dadosGrafico} />
            <div style={{ margin: 8, fontSize: 18 }}>
              ✅ Sim: {resultadoFinal?.sim || 0} | ❌ Não: {resultadoFinal?.nao || 0} | ⚪ Abstenção: {resultadoFinal?.abstencao || 0}
            </div>
          </div>
        )}
        <table className="tabela-votos-ultra">
          <thead>
            <tr><th>Vereador</th><th>Voto</th></tr>
          </thead>
          <tbody>
            {votosRegistrados.map(item => {
              const dv = presentes.find(p => p.id === item.id) || {};
              return (
                <tr key={item.id}>
                  <td>{dv.nome || "—"} <span className="sigla-partido-ultra">({dv.partido || "—"})</span></td>
                  <td>
                    {item.voto === "sim" ? "✅ Sim"
                      : item.voto === "nao" ? "❌ Não"
                      : item.voto === "abstencao" ? "⚪ Abstenção"
                      : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}
