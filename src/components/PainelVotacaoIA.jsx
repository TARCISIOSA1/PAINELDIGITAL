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

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

// ----- Componente de Legenda (inalterado) -----
function LegendaWhisper({ ativo, tribunaAtual, dadosPainel, onLegenda }) {
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const ativoRef = useRef(ativo);

  useEffect(() => {
    ativoRef.current = ativo;
  }, [ativo]);

  useEffect(() => {
    let gravaLoop = false;

    async function startGravacao() {
      if (!ativoRef.current) return;
      try {
        if (
          !streamRef.current ||
          !streamRef.current.active ||
          streamRef.current.getTracks().some(track => track.readyState === 'ended')
        ) {
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
            if (blob.size < 5000) { if (gravaLoop && ativoRef.current) setTimeout(gravarBloco, 100); return; }
            const formData = new FormData();
            formData.append("file", blob, "audio/webm");
            try {
              const res = await fetch("http://localhost:3333/api/whisper", { method: "POST", body: formData });
              const data = await res.json();
              const texto = data.text || "⚠️ Nada transcrito.";
              onLegenda(texto);

              if (texto && tribunaAtual?.nome && dadosPainel?.data && tribunaAtual?.partido) {
                await fetch("http://localhost:3333/api/atasFalas", {
                  method: "POST", headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    fala: texto,
                    orador: tribunaAtual.nome,
                    partido: tribunaAtual.partido,
                    data: dadosPainel.data,
                    hora: dadosPainel.hora,
                  }),
                });
              }
            } catch {
              onLegenda("❌ Erro ao transcrever.");
            }
            if (gravaLoop && ativoRef.current) setTimeout(gravarBloco, 100);
          };

          recorder.start();
          setTimeout(() => { if (recorder.state !== "inactive") recorder.stop(); }, 3500);
        }

        gravarBloco();
      } catch {
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
  }, [ativo, onLegenda, tribunaAtual, dadosPainel]);

  return null;
}

// Banner de boas-vindas/encerramento/notícia IA
function BannerBoasVindas({ frase, noticia }) {
  return (
    <div className="banner-boasvindas">
      <h1>{frase || "Bem-vindos à sessão plenária!"}</h1>
      {noticia && noticia.frase && (
        <div className="banner-noticia">
          <span>📰 {noticia.frase}</span>
        </div>
      )}
    </div>
  );
}

// ---- PAINEL PRINCIPAL ----
export default function PainelVotacaoIA() {
  const containerRef = useRef(null);
  const [dadosPainel, setDadosPainel] = useState(null);
  const [presentes, setPresentes] = useState([]);
  const [votos, setVotos] = useState([]);
  const [timerRed, setTimerRed] = useState(false);
  const [fullTribuna, setFullTribuna] = useState(false);
  const [fullVotacao, setFullVotacao] = useState(false);
  const [legenda, setLegenda] = useState("");

  // Estado IA - boas-vindas / sessão encerrada / notícia
  const [boasVindas, setBoasVindas] = useState("");
  const [msgEncerrada, setMsgEncerrada] = useState("");
  const [noticiaIA, setNoticiaIA] = useState("");

  // Limpa legenda ao trocar de orador ou acabar tempo
  useEffect(() => {
    if (!dadosPainel?.tribunaAtual?.nome || dadosPainel.tribunaAtual.tempoRestante <= 0) setLegenda("");
  }, [dadosPainel?.tribunaAtual]);

  // Fetch dados painel ativo (Firestore)
  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, "painelAtivo", "ativo"), async (docSnap) => {
      const data = docSnap.data();
      setDadosPainel(data);

      // Presentes
      const habilitados = data.votacaoAtual?.habilitados || [];
      let docs = [];
      if (habilitados.length > 0) {
        if (habilitados.length <= 10) {
          const q = query(collection(db, 'parlamentares'), where('__name__', 'in', habilitados));
          docs = (await getDocs(q)).docs.map(d => ({ id: d.id, ...d.data() }));
        } else {
          const all = (await getDocs(collection(db, 'parlamentares'))).docs.map(d => ({ id: d.id, ...d.data() }));
          docs = all.filter(v => habilitados.includes(v.id));
        }
      }
      setPresentes(docs);

      // Votos
      const votos = data.votacaoAtual?.votos;
      setVotos(
        votos
          ? Object.values(votos).map(item => ({ id: item.vereador_id, voto: item.voto || '' }))
          : []
      );

      // Timer Red
      setTimerRed(!!(data.tribunaAtual?.tempoRestante <= 20 && data.tribunaAtual.tempoRestante > 0));
    });
    return () => unsubscribe();
  }, []);

  // Mensagem de boas-vindas IA
  useEffect(() => {
    fetch("http://localhost:3334/api/boasvindas")
      .then((r) => r.json())
      .then((d) => setBoasVindas(d.frase || "Bem-vindos!"))
      .catch(() => setBoasVindas("Bem-vindos à sessão plenária!"));
  }, []);

  // Se sessão for ENCERRADA, busca mensagem institucional e notícia IA
  useEffect(() => {
    let noticiaInterval = null;
    async function carregarNoticia() {
      fetch("http://localhost:3334/api/noticiaia")
        .then((r) => r.json())
        .then((d) => setNoticiaIA(d))
        .catch(() => setNoticiaIA({ frase: "Acompanhe as novidades da Câmara nas redes sociais!" }));
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

  // ----------- CAMPOS DERIVADOS -------------
  const {
    data: sessaoData,
    hora: sessaoHora,
    local: sessaoLocal,
    presidente: sessaoPresidente,
    secretario: sessaoSecretario,
    votacaoAtual,
    tribunaAtual,
    statusSessao,
    tipo,
    mesa,
    resultadoFinal,
  } = dadosPainel || {};

  // --------- PRESIDENTE E SECRETÁRIO -----------
  // Presidente (só "Presidente", não "Vice")
  const nomePresidente =
    sessaoPresidente ||
    (Array.isArray(mesa)
      ? (mesa.find(m =>
          m.cargo &&
          m.cargo.trim().toLowerCase() === "presidente"
        )?.vereador)
      : null) || "—";
  // Secretário (só "Secretário", não 2º ou 3º)
  const nomeSecretario =
    sessaoSecretario ||
    (Array.isArray(mesa)
      ? (mesa.find(m =>
          m.cargo &&
          (m.cargo.trim().toLowerCase() === "secretário" || m.cargo.trim().toLowerCase() === "secretario")
        )?.vereador)
      : null) || "—";

  // --------- DADOS DO GRÁFICO -----------
  const gerarDadosGrafico = () => {
    const res = resultadoFinal;
    if (!res) return null;
    return {
      labels: ["Sim", "Não", "Abstenção"],
      datasets: [{
        label: "Votos",
        data: [res.sim || 0, res.nao || 0, res.abstencao || 0],
        borderWidth: 1,
      }]
    };
  };
  const dadosGrafico = gerarDadosGrafico();

  // FULLSCREEN Tribuna
  if (fullTribuna && tribunaAtual?.nome) {
    return (
      <div className="fullscreen-overlay" ref={containerRef}>
        <TopoInstitucional />
        <section className="bloco-tribuna-central bloco-fullscreen">
          <h2>Tribuna</h2>
          <div className="tribuna-full-nome">{tribunaAtual.nome} {tribunaAtual.partido && <span className="tribuna-full-partido">({tribunaAtual.partido})</span>}</div>
          <div className="tribuna-full-legenda">{legenda || "..."}</div>
          <button className="btn-voltar" onClick={() => setFullTribuna(false)}>Voltar</button>
        </section>
      </div>
    );
  }

  // FULLSCREEN Votação
  if (fullVotacao && votacaoAtual) {
    return (
      <div className="fullscreen-overlay" ref={containerRef}>
        <TopoInstitucional />
        <section className="bloco-votacao-central bloco-fullscreen">
          <h2>Votação</h2>
          {dadosGrafico ? (
            <div className="grafico-votacao">
              <Bar data={dadosGrafico} />
            </div>
          ) : <p>Nenhuma matéria em votação.</p>}
          <button className="btn-voltar" onClick={() => setFullVotacao(false)}>Voltar</button>
        </section>
      </div>
    );
  }

  // SEM sessão ativa OU ENCERRADA
  if (!dadosPainel || statusSessao === "Encerrada") {
    return (
      <div className="painel-ia-container painel-ia-encerrada" ref={containerRef}>
        <TopoInstitucional />
        {msgEncerrada ? (
          <BannerBoasVindas frase={msgEncerrada} noticia={noticiaIA} />
        ) : (
          <BannerBoasVindas frase={boasVindas} noticia={null} />
        )}
        {/* LOGO centralizada */}
        <div className="painel-institucional-animado" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <img
            src={panelConfig.logoPath || "/logo-camara.png"}
            alt="Logomarca Câmara"
            style={{ maxWidth: 200, opacity: 0.7, margin: "20px 0" }}
          />
        </div>
      </div>
    );
  }

  // ---------- PAINEL NORMAL ----------
  return (
    <div className="painel-ia-container" ref={containerRef}>
      <LegendaWhisper
        ativo={!!(tribunaAtual && tribunaAtual.tempoRestante > 0 && tribunaAtual.nome)}
        tribunaAtual={tribunaAtual}
        dadosPainel={dadosPainel}
        onLegenda={setLegenda}
      />
      <TopoInstitucional />

      <section className="sessao-info-presentes">
        <div className="info-gerais">
          <h2>Informações da Sessão</h2>
          <p><strong>Data:</strong> {sessaoData || '-'} | <strong>Hora:</strong> {sessaoHora || '-'}</p>
          <p><strong>Local:</strong> {sessaoLocal || '—'}</p>
          <p>
            <strong>Presidente:</strong> {nomePresidente} | <strong>Secretário:</strong> {nomeSecretario}
          </p>
          <p><strong>Status:</strong> <span className={`status-small status-${(statusSessao || '').toLowerCase()}`}>{statusSessao || '—'}</span> | <strong>Tipo:</strong> {tipo || '—'}</p>
        </div>
        <div className="presentes-box">
          <h2>Parlamentares Presentes</h2>
          <div className="tags-presentes">
            {presentes.length > 0 ? presentes.map(p => (
              <div key={p.id} className="tag-present">
                {p.foto ? <img src={p.foto} alt={p.nome} className="tag-foto" /> : <div className="tag-foto-placeholder" />}
                <span className="tag-nome">{p.nome}</span>
                {p.partido && <span className="tag-partido">{p.partido.toUpperCase()}</span>}
              </div>
            )) : <p>Nenhum parlamentar habilitado</p>}
          </div>
        </div>
      </section>

      <section className="bloco-tribuna-central">
        <h2>Tribuna</h2>
        {tribunaAtual?.nome ? (
          <div className={`tribuna-box${timerRed ? " tribuna-timer-red" : ""}`}>
            <div className="tribuna-nome">
              {tribunaAtual.nome} {tribunaAtual.partido && <span className="tribuna-partido">({tribunaAtual.partido})</span>}
            </div>
            <div className="tribuna-legenda">{legenda || <span style={{ color: "#999" }}>Legenda será exibida aqui em tempo real...</span>}</div>
            <div className="tribuna-cronometro">
              <strong>Tempo restante:</strong> {tribunaAtual.tempoRestante > 0 ? tribunaAtual.tempoRestante + "s" : "Encerrado"}
              {tribunaAtual.tempoRestante > 0 && <button className="btn-full" onClick={() => setFullTribuna(true)}>Tela cheia</button>}
            </div>
          </div>
        ) : <p>Nenhum orador na tribuna.</p>}
      </section>

      <section className="bloco-votacao-central">
        <h2>Votação</h2>
        {votacaoAtual ? (
          <div className="votacao-box">
            <div><strong>Matéria:</strong> {votacaoAtual?.materia || "—"} <span style={{ fontStyle: "italic", color: "#666" }}>{votacaoAtual?.autor && `- Autor: ${votacaoAtual.autor}`}</span></div>
            <div><strong>Status:</strong> <span className={`status-small status-${(votacaoAtual?.status || "").toLowerCase()}`}>{votacaoAtual?.status || "—"}</span></div>
            <div className="votacao-presentes">
              {presentes.map((p) => (
                <span className="tag-present tag-present-voto" key={p.id}>
                  {p.foto ? <img src={p.foto} alt={p.nome} className="tag-foto" /> : <div className="tag-foto-placeholder" />}
                  <span className="tag-nome">{p.nome}</span>
                  {p.partido && <span className="tag-partido">{p.partido.toUpperCase()}</span>}
                  <span className="tag-voto">
                    {votos.find(v => v.id === p.id)?.voto
                      ? (votos.find(v => v.id === p.id).voto === "sim" ? "✅ Sim" : votos.find(v => v.id === p.id).voto === "nao" ? "❌ Não" : "⚪ Abstenção")
                      : "—"}
                  </span>
                </span>
              ))}
            </div>
            {dadosGrafico && (
              <div className="grafico-votacao">
                <Bar data={dadosGrafico} />
                <button className="btn-full" onClick={() => setFullVotacao(true)}>Tela cheia</button>
              </div>
            )}
          </div>
        ) : <p>Nenhuma matéria em votação.</p>}
      </section>
    </div>
  );
}
