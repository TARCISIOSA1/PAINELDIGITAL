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

// -------- Legenda IA com Whisper --------
function LegendaWhisper({ ativo, tribunaAtual, dadosPainel, onLegenda }) {
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const ativoRef = useRef(ativo);

  useEffect(() => { ativoRef.current = ativo; }, [ativo]);

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

              // Salva fala na ata no backend (opcional)
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

function BannerMensagemIA({ frase, noticia }) {
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

// -------- PAINEL PRINCIPAL --------
export default function PainelVotacaoIA() {
  const containerRef = useRef(null);
  const [dadosPainel, setDadosPainel] = useState(null);
  const [presentes, setPresentes] = useState([]);
  const [votosRegistrados, setVotosRegistrados] = useState([]);
  const [timerRed, setTimerRed] = useState(false);
  const [fullTribuna, setFullTribuna] = useState(false);
  const [fullVotacao, setFullVotacao] = useState(false);
  const [legenda, setLegenda] = useState("");
  const [boasVindas, setBoasVindas] = useState("");
  const [msgEncerrada, setMsgEncerrada] = useState("");
  const [noticiaIA, setNoticiaIA] = useState("");
  const [telaAuxiliar, setTelaAuxiliar] = useState(false);

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
      setVotosRegistrados(
        votos
          ? Object.entries(votos).map(([id, voto]) => ({ id, voto }))
          : []
      );
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

  // Sessão ENCERRADA: mensagem institucional e notícia IA
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
    numeroSessao,
    votacaoAtual,
    tribunaAtual,
    statusSessao,
    tipo,
    mesa,
    resultadoFinal,
    quorumMinimo,
    totalParlamentares,
  } = dadosPainel || {};

  // Presidente/Secretário
  const nomePresidente =
    sessaoPresidente ||
    (Array.isArray(mesa)
      ? (mesa.find(m =>
          m.cargo &&
          m.cargo.trim().toLowerCase() === "presidente"
        )?.vereador)
      : null) || "—";
  const nomeSecretario =
    sessaoSecretario ||
    (Array.isArray(mesa)
      ? (mesa.find(m =>
          m.cargo &&
          (m.cargo.trim().toLowerCase() === "secretário" || m.cargo.trim().toLowerCase() === "secretario")
        )?.vereador)
      : null) || "—";

  // Número da sessão e quorum
  const numeroDaSessao = numeroSessao || dadosPainel?.sessaoNumero || dadosPainel?.sessaoId || '—';
  const quorumMin = quorumMinimo || votacaoAtual?.quorum || 0;
  const totalParl = totalParlamentares || presentes.length;
  const quorumAtingido = quorumMin ? presentes.length >= quorumMin : true;

  // Tempo de votação
  const tempoVotacaoRestante = votacaoAtual?.tempoRestante || null;

  // Gráfico de votação
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

  // ----- FULLSCREEN TRIBUNA -----
  if (fullTribuna && tribunaAtual?.nome) {
    return (
      <div className="fullscreen-overlay" ref={containerRef}>
        <LegendaWhisper ativo tribunaAtual={tribunaAtual} dadosPainel={dadosPainel} onLegenda={setLegenda} />
        <TopoInstitucional />
        <div className="conteudo-fullscreen">
          <div className="full-tribuna-orador">
            <img src={tribunaAtual.fotoURL || '/assets/default-parlamentar.png'} alt={tribunaAtual.nome} className="full-foto-orador" />
            <span className="full-orador-info">
              {tribunaAtual.nome} <span className="full-partido">{tribunaAtual.partido ? `(${tribunaAtual.partido})` : ''}</span>
            </span>
          </div>
          <div className={`full-grand-time${timerRed ? ' timer-alert' : ''}`}>{tribunaAtual.tempoRestante}s</div>
          <div className="legenda-tribuna-centralizada">
            {legenda ? <span className="legenda-linha-centralizada">{legenda}</span> : <span style={{ color: '#888' }}>Legenda não disponível</span>}
          </div>
          <button className="btn-tela-auxiliar" onClick={() => setTelaAuxiliar(true)}>Ir para Tela Auxiliar</button>
        </div>
      </div>
    );
  }

  // ----- FULLSCREEN VOTAÇÃO -----
  if (fullVotacao && votacaoAtual) {
    return (
      <div className="fullscreen-overlay" ref={containerRef}>
        <TopoInstitucional />
        <div className="conteudo-fullscreen">
          <h2>Votação</h2>
          {dadosGrafico ? (
            <div className="painel-grafico">
              <Bar data={dadosGrafico} />
            </div>
          ) : <p>Nenhuma matéria em votação.</p>}
          <button className="btn-voltar" onClick={() => setFullVotacao(false)}>Voltar</button>
        </div>
      </div>
    );
  }

  // ----- SESSÃO ENCERRADA OU SEM DADOS -----
  if (!dadosPainel || statusSessao === "Encerrada") {
    return (
      <div className="painel-ia-container painel-ia-encerrada" ref={containerRef}>
        <TopoInstitucional />
        {msgEncerrada ? (
          <BannerMensagemIA frase={msgEncerrada} noticia={noticiaIA} />
        ) : (
          <BannerMensagemIA frase={boasVindas} noticia={null} />
        )}
        <div className="painel-institucional-animado" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <img
            src={panelConfig.logoPath || "/logo-camara.png"}
            alt="Logomarca Câmara"
            style={{ maxWidth: 200, opacity: 0.7, margin: "20px 0" }}
          />
          <div style={{ fontSize: 18, marginTop: 16, opacity: 0.75 }}>
            {statusSessao === "Encerrada"
              ? "Aguarde novas sessões ou acompanhe as notícias."
              : "Aguardando início da próxima sessão..."}
          </div>
        </div>
      </div>
    );
  }

  // ---------- PAINEL NORMAL ----------
  return (
    <div className="painel-ia-container" ref={containerRef}>
      <LegendaWhisper
        ativo={!!(tribunaAtual?.tempoRestante > 0)}
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
          <p><strong>Número da Sessão:</strong> {numeroDaSessao}</p>
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
                <div className="tag-circulo" style={{ background: "#0f0", border: "2px solid #060" }} />
                {p.foto ? <img src={p.foto} alt={p.nome} className="tag-foto" /> : <div className="tag-foto-placeholder" />}
                <span className="tag-nome">{p.nome}</span>
                {p.partido && <span className="tag-partido">{p.partido.toUpperCase()}</span>}
              </div>
            )) : <p>Nenhum parlamentar habilitado</p>}
          </div>
          <div className={`quorum-info${quorumAtingido ? '' : ' quorum-alert'}`}>Quorum: {presentes.length}/{totalParl}{quorumMin ? ` (mínimo ${quorumMin})` : ''} {quorumAtingido ? '✅' : '⚠️'}</div>
        </div>
      </section>

      <section className="bloco-tribuna-central">
        <h2>Tribuna</h2>
        {tribunaAtual?.nome ? (
          <div className="conteudo-tribuna">
            <div className="stand-topo">
              <img src={tribunaAtual.fotoURL || '/assets/default-parlamentar.png'} alt={tribunaAtual.nome} className="foto-orador-destaque" />
              <div className="info-orador">
                <p><strong>Orador:</strong> {tribunaAtual.nome}</p>
                <p><strong>Partido:</strong> {tribunaAtual.partido || '—'}</p>
              </div>
              <div className={`timer-grand${timerRed ? ' timer-alert' : ''}`}><span>{tribunaAtual.tempoRestante || 0}s</span></div>
            </div>
            <div className="legenda-tribuna-centralizada">
              {legenda ? <span className="legenda-linha-centralizada">{legenda}</span> : <span style={{ color: '#888' }}>Legenda não disponível</span>}
            </div>
            {tribunaAtual.tempoRestante > 0 && <button className="btn-full" onClick={() => setFullTribuna(true)}>Tela cheia</button>}
            <button className="btn-tela-auxiliar" onClick={() => setTelaAuxiliar(true)}>Ir para Tela Auxiliar</button>
          </div>
        ) : <p>Nenhum orador na tribuna.</p>}
      </section>

      <section className="bloco-votacao-central">
        <h2>Ordem do Dia</h2>
        {votacaoAtual?.materias && votacaoAtual.materias.length > 0 ? (
          <div className="conteudo-votacao-central">
            {votacaoAtual.materias.map((mat, idx) => (
              <div key={idx} className="votacao-detalhes">
                <p><strong>Matéria:</strong> {mat.titulo}</p>
                <p><strong>Tipo:</strong> {mat.tipo || '—'}</p>
                <p><strong>Status:</strong> <span className={`status-small status-${(mat.status || '').replace(/ /g, '-').toLowerCase()}`}>{mat.status || '—'}</span></p>
                <p><strong>Autor:</strong> {mat.autor || '—'}</p>
              </div>
            ))}
            {votosRegistrados.length > 0 ? (
              <table className="tabela-votos-central">
                <thead>
                  <tr><th>Vereador</th><th>Voto</th></tr>
                </thead>
                <tbody>
                  {votosRegistrados.map(item => {
                    const dv = presentes.find(p => p.id === item.id) || {};
                    return (
                      <tr key={item.id}>
                        <td>{dv.nome || '—'} <span className="sigla-partido">({dv.partido || '—'})</span></td>
                        <td>
                          {item.voto === 'sim'
                            ? '✅ Sim'
                            : item.voto === 'nao'
                            ? '❌ Não'
                            : item.voto === 'abstencao'
                            ? '⚪ Abstenção'
                            : item.voto || 'Ainda não votou'
                          }
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : <p>Nenhum voto registrado.</p>}

            <div className="resultado-final">
              <p><strong>Resultado Final:</strong> {`✅ Sim: ${votosRegistrados.filter(v => v.voto === 'sim').length}  |  ❌ Não: ${votosRegistrados.filter(v => v.voto === 'nao').length}  |  ⚪ Abstenções: ${votosRegistrados.filter(v => v.voto === 'abstencao').length}`}</p>
              {tempoVotacaoRestante !== null && (
                <p><strong>Tempo Restante para Votação:</strong> {tempoVotacaoRestante}s</p>
              )}
            </div>

            {dadosGrafico && (
              <div className="painel-grafico">
                <h3>📊 Gráfico de Votação</h3>
                <Bar data={dadosGrafico} />
                <button className="btn-full" onClick={() => setFullVotacao(true)}>Tela cheia</button>
              </div>
            )}
            <button className="btn-tela-auxiliar" onClick={() => setTelaAuxiliar(true)}>Ir para Tela Auxiliar</button>
          </div>
        ) : <p>Nenhuma matéria em votação.</p>}
      </section>
    </div>
  );
}
