import React, { useEffect, useRef, useState } from "react";
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

// Registra componentes do Chart.js
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

// Componente para gravar áudio, enviar ao Whisper e salvar fala no backend
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

          recorder.ondataavailable = (e) => {
            if (e.data.size > 0) chunks.push(e.data);
          };

          recorder.onstop = async () => {
            if (!gravaLoop || !ativoRef.current) return;
            if (chunks.length === 0) return;
            const blob = new Blob(chunks, { type: "audio/webm" });
            if (blob.size < 5000) {
              if (gravaLoop && ativoRef.current) setTimeout(gravarBloco, 100);
              return;
            }
            const formData = new FormData();
            formData.append("file", blob, "audio/webm");
            try {
              const res = await fetch("http://localhost:3333/api/whisper", {
                method: "POST",
                body: formData,
              });
              const data = await res.json();
              const texto = data.text || "⚠️ Nada transcrito.";
              onLegenda(texto);

              if (
                texto &&
                tribunaAtual?.nome &&
                dadosPainel?.data &&
                tribunaAtual?.partido
              ) {
                await fetch("http://localhost:3333/api/atasFalas", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    fala: texto,
                    orador: tribunaAtual.nome,
                    partido: tribunaAtual.partido,
                    data: dadosPainel.data,
                    horario: new Date().toLocaleTimeString("pt-BR", { hour12: false }),
                    sessaoId: dadosPainel?.sessaoId || "",
                  }),
                });
              }
            } catch {
              onLegenda("❌ Erro ao transcrever.");
            }
            if (gravaLoop && ativoRef.current) setTimeout(gravarBloco, 100);
          };

          recorder.start();
          setTimeout(() => {
            if (recorder.state !== "inactive") recorder.stop();
          }, 3500);
        }

        gravarBloco();
      } catch {
        onLegenda("❌ Erro ao acessar microfone.");
      }
    }

    if (ativo) {
      startGravacao();
    } else {
      gravaLoop = false;
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    }

    return () => {
      gravaLoop = false;
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [ativo, onLegenda, tribunaAtual, dadosPainel]);

  return null;
}

// Banner de boas-vindas / encerramento / notícia institucional
function BannerBoasVindas({ frase, noticia }) {
  return (
    <div className="banner-boasvindas">
      <h1 className="banner-titulo">{frase}</h1>
      {noticia && (
        <div className="banner-noticia-ia">
          <span role="img" aria-label="notícia">📰</span>
          {typeof noticia === "object" && noticia.frase ? (
            <>
              {noticia.frase}
              {noticia.link && (
                <a
                  href={noticia.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ marginLeft: 8, color: '#0051a8', textDecoration: 'underline', fontWeight: 500 }}
                >
                  [Leia na íntegra]
                </a>
              )}
            </>
          ) : (
            noticia
          )}
        </div>
      )}
    </div>
  );
}

// Painel Principal
export default function PainelVotacaoIA() {
  const containerRef = useRef(null);
  const [dadosPainel, setDadosPainel] = useState(null);
  const [presentes, setPresentes] = useState([]);
  const [votosRegistrados, setVotosRegistrados] = useState([]);
  const [timerRed, setTimerRed] = useState(false);
  const [fullTribuna, setFullTribuna] = useState(false);
  const [fullVotacao, setFullVotacao] = useState(false);
  const [legenda, setLegenda] = useState("");

  // Estado IA - boas-vindas / sessão encerrada / notícia
  const [boasVindas, setBoasVindas] = useState("");
  const [msgEncerrada, setMsgEncerrada] = useState("");
  const [noticiaIA, setNoticiaIA] = useState("");

  useEffect(() => {
    if (!dadosPainel?.tribunaAtual?.nome || dadosPainel.tribunaAtual.tempoRestante <= 0) {
      setLegenda("");
    }
  }, [dadosPainel?.tribunaAtual]);

  // Fetch dados painel
  useEffect(() => {
    const ref = doc(db, 'painelAtivo', 'ativo');
    const unsubscribe = onSnapshot(ref, async (snap) => {
      if (!snap.exists()) {
        setDadosPainel(null);
        return;
      }
      const data = snap.data();
      setDadosPainel(data);

      setFullTribuna(!!(data.tribunaAtual?.cronometroAtivo && data.tribunaAtual.tempoRestante > 0));
      setFullVotacao([
        'em_votacao',
        'votando'
      ].includes((data.votacaoAtual?.status || '').toLowerCase()));

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

      const votos = data.votacaoAtual?.votos;
      setVotosRegistrados(
        votos && typeof votos === 'object'
          ? Object.values(votos).map(item => ({ id: item.vereador_id, voto: item.voto || '' }))
          : []
      );

      setTimerRed(
        !!(data.tribunaAtual?.tempoRestante <= 20 && data.tribunaAtual.tempoRestante > 0)
      );
    });
    return () => unsubscribe();
  }, []);

  // IA: Mensagem de boas-vindas
  useEffect(() => {
    fetch("http://localhost:3334/api/boasvindas")
      .then((r) => r.json())
      .then((d) => setBoasVindas(d.frase || "Bem-vindos!"))
      .catch(() => setBoasVindas("Bem-vindos à sessão plenária!"));
  }, []);

  // Se sessão for ENCERRADA, busca mensagem institucional, notícia IA e próxima sessão
 // Se sessão for ENCERRADA, busca mensagem institucional e atualiza notícia IA a cada 20 segundos
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
    noticiaInterval = setInterval(carregarNoticia, 20000); // 20000 ms = 20 segundos

  } else {
    setMsgEncerrada("");
    setNoticiaIA("");
  }

  return () => {
    if (noticiaInterval) clearInterval(noticiaInterval);
  };
}, [dadosPainel?.statusSessao]);


  // Gráfico de votação
  const gerarDadosGrafico = () => {
    const res = dadosPainel?.resultadoFinal;
    if (!res) return null;
    return {
      labels: ['Sim', 'Não', 'Abstenção'],
      datasets: [
        {
          label: 'Votos',
          data: [res.sim || 0, res.nao || 0, res.abstencao || 0],
        },
      ],
    };
  };
  const dadosGrafico = gerarDadosGrafico();

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
    
  } = dadosPainel || {};

  // FULLSCREEN Tribuna
  if (fullTribuna && tribunaAtual?.nome) {
    return (
      <div className="fullscreen-overlay" ref={containerRef}>
        <LegendaWhisper ativo tribunaAtual={tribunaAtual} dadosPainel={dadosPainel} onLegenda={setLegenda} />
        <TopoInstitucional />
        <div className="fullscreen-content">
          <div className="full-tribuna-orador">
            <img src={tribunaAtual.fotoURL || '/assets/default-parlamentar.png'} alt={tribunaAtual.nome} className="full-foto-orador" />
            <span className="full-orador-info">
              {tribunaAtual.nome} <span className="full-partido">{tribunaAtual.partido ? `(${tribunaAtual.partido})` : ''}</span>
            </span>
          </div>
          <div className={`full-tribuna-tempo ${timerRed ? 'timer-alert' : ''}`}>{tribunaAtual.tempoRestante}s</div>
          <div className="legenda-tribuna-centralizada">
            {legenda ? <span className="legenda-linha-centralizada">{legenda}</span> : <span style={{ color: '#888' }}>Legenda não disponível</span>}
          </div>
        </div>
      </div>
    );
  }

  // FULLSCREEN Votação
  if (fullVotacao && votacaoAtual) {
    return (
      <div className="fullscreen-overlay" ref={containerRef}>
        <TopoInstitucional />
        <div className="fullscreen-content">
          <div className="full-votacao-content">
            <div className="full-votacao-titulo">{votacaoAtual.materia}</div>
            <div className="full-votacao-status">{votacaoAtual.status || 'Em Votação'} • {votacaoAtual.tipo || ''}</div>
            <div><strong>Autor:</strong> {votacaoAtual.autor || '—'}</div>
            <div className="full-votacao-votos">
              <span>✅ Sim: {votosRegistrados.filter(v => v.voto === 'Sim').length}</span>
              <span>❌ Não: {votosRegistrados.filter(v => v.voto === 'Não').length}</span>
              <span>⚪ Abst.: {votosRegistrados.filter(v => v.voto === 'Abstenção').length}</span>
            </div>
            {dadosGrafico && <Bar data={dadosGrafico} />}
          </div>
        </div>
      </div>
    );
  }

  // SEM sessão ativa OU ENCERRADA
  if (!dadosPainel || statusSessao === "Encerrada") {
    return (
      <div className="painel-ia-container painel-ia-encerrada" ref={containerRef}>
        <TopoInstitucional />
        {statusSessao === "Encerrada" ? (
          <BannerBoasVindas frase={msgEncerrada} noticia={noticiaIA} />
        ) : (
          <BannerBoasVindas frase={boasVindas} noticia={null} />
        )}
        {/* LOGO centralizada */}
        <div className="painel-institucional-animado" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <img
            src={panelConfig.logoPath || "/logo-camara.png"}
            alt="Logo Câmara"
            className="logo-institucional-animada"
            style={{ margin: "16px auto 12px auto", display: "block", maxWidth: 300, width: "100%" }}
          />
          <div className="painel-mensagem-extra" style={{ textAlign: "center" }}>
            {statusSessao === "Encerrada"
              ? "Aguarde novas sessões ou acompanhe as notícias."
              : "Aguardando início da próxima sessão..."}
          </div>
        </div>
      </div>
    );
  }

  // Painel Normal
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
   <p>
  <strong>Presidente:</strong> {
    sessaoPresidente 
    || (Array.isArray(dadosPainel?.mesa) 
          ? dadosPainel.mesa.find(m => m.cargo.toLowerCase() === "presidente")?.vereador 
          : '—')
    || '—'
  }
  {" | "}
  <strong>Secretário:</strong> {
    sessaoSecretario 
    || (Array.isArray(dadosPainel?.mesa) 
          ? dadosPainel.mesa.find(m => m.cargo.toLowerCase() === "secretário")?.vereador 
          : '—')
    || '—'
  }
</p>

    <p><strong>Status:</strong> <span className={`status-small status-${(statusSessao || '').toLowerCase()}`}>{statusSessao || '—'}</span> | <strong>Tipo:</strong> {tipo || '—'}</p>
    {/* Título removido, pois não existe mais */}
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
          <div className="conteudo-tribuna">
            <div className="tribuna-topo">
              <img src={tribunaAtual.fotoURL || '/assets/default-parlamentar.png'} alt={tribunaAtual.nome} className="foto-orador-destaque" />
              <div className="info-orador">
                <p><strong>Orador:</strong> {tribunaAtual.nome}</p>
                <p><strong>Partido:</strong> {tribunaAtual.partido || '—'}</p>
              </div>
              <div className={`timer-tribuna ${timerRed ? 'timer-alert' : ''}`}><span>{tribunaAtual.tempoRestante || 0}s</span></div>
            </div>
            <div className="legenda-tribuna-centralizada">
              {legenda ? <span className="legenda-linha-centralizada">{legenda}</span> : <span style={{ color: '#888' }}>Legenda não disponível</span>}
            </div>
          </div>
        ) : <p>Sem orador na tribuna.</p>}
      </section>

      <section className="bloco-votacao-central">
        <h2>Ordem do Dia</h2>
        {votacaoAtual?.materia ? (
          <div className="conteudo-votacao-central">
            <div className="votacao-detalhes">
              <p><strong>Matéria:</strong> {votacaoAtual.materia}</p>
              <p><strong>Tipo:</strong> {votacaoAtual.tipo || '—'}</p>
              <p><strong>Status:</strong> <span className={`status-small status-${(votacaoAtual.status || '').replace(/ /g, '-').toLowerCase()}`}>{votacaoAtual.status || '—'}</span></p>
              <p><strong>Autor:</strong> {votacaoAtual.autor || '—'}</p>
            </div>
            {votosRegistrados.length > 0 ? (
              <table className="tabela-votos-central"><thead><tr><th>Vereador</th><th>Voto</th></tr></thead><tbody>
                {votosRegistrados.map(item => {
                  const dv = presentes.find(p => p.id === item.id) || {};
                  return (
                    <tr key={item.id}><td>{dv.nome || '—'} <span className="sigla-partido">({dv.partido || '—'})</span></td><td>{item.voto === 'Sim' ? '✅ Sim' : item.voto === 'Não' ? '❌ Não' : item.voto || 'Ainda não votou'}</td></tr>
                  );
                })}
              </tbody></table>
            ) : <p>Nenhum voto registrado.</p>}

            <div className="resultado-final">
              <p><strong>Resultado Final:</strong> {`✅ Sim: ${votosRegistrados.filter(v => v.voto === 'Sim').length}  |  ❌ Não: ${votosRegistrados.filter(v => v.voto === 'Não').length}  |  ⚪ Abstenções: ${votosRegistrados.filter(v => v.voto === 'Abstenção').length}`}</p>
            </div>

            {dadosGrafico && (
              <div className="painel-grafico">
                <h3>📊 Gráfico de Votação</h3>
                <Bar data={dadosGrafico} />
              </div>
            )}

          </div>
        ) : <p>Nenhuma matéria em votação.</p>}
      </section>
    </div>
  );
}
