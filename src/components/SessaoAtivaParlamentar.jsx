import React, { useEffect, useState } from "react";
import { doc, onSnapshot, getDoc, updateDoc, arrayUnion } from "firebase/firestore";
import { db } from "../firebase";
import TopoInstitucional from "./TopoInstitucional";
import Chat from "./email/Chat";
import "./SessaoAtivaParlamentar.css";

export default function SessaoAtivaParlamentar() {
  const usuarioId = localStorage.getItem("id");

  const [parlamentar, setParlamentar] = useState(null);
  const [painel, setPainel] = useState(null);
  const [voto, setVoto] = useState("");
  const [aba, setAba] = useState("votacao");
  const [enviando, setEnviando] = useState(false);

  // Pedir palavra
  const [pedidoFeito, setPedidoFeito] = useState(false);

  // Modal de confirmação de voto
  const [modalConfirm, setModalConfirm] = useState({ exibir: false, etapa: 1, votoNovo: "" });

  // Badge alerta chat
  const [chatAlert, setChatAlert] = useState(false);

  useEffect(() => {
    if (!usuarioId) return;
    async function fetchParlamentar() {
      const snap = await getDoc(doc(db, "parlamentares", usuarioId));
      setParlamentar(snap.exists() ? snap.data() : null);
    }
    fetchParlamentar();
  }, [usuarioId]);

  useEffect(() => {
    const ref = doc(db, "painelAtivo", "ativo");
    const unsubscribe = onSnapshot(ref, (snap) => {
      if (!snap.exists()) { setPainel(null); return; }
      const data = snap.data();
      setPainel(data);

      if (data.votacaoAtual?.votos && usuarioId) {
        const votos = data.votacaoAtual.votos;
        const votoAtual = Object.values(votos).find(v => v.vereador_id === usuarioId);
        setVoto(votoAtual ? votoAtual.voto : "");
      } else {
        setVoto("");
      }
      if (data.pedidosTribuna && Array.isArray(data.pedidosTribuna)) {
        setPedidoFeito(data.pedidosTribuna.some(p => p.id === usuarioId && p.status === "Pendente"));
      }
    });
    return () => { unsubscribe(); }
  }, [usuarioId]);

  // ALERTA DE NOVO CHAT
  useEffect(() => {
    if (!parlamentar) return;
    const chatRef = doc(db, "conversas", "sessaoAtiva");
    const unsubscribe = onSnapshot(chatRef, (snap) => {
      const mensagens = snap.exists() ? snap.data().mensagens || [] : [];
      if (mensagens.length > 0) {
        const ultima = mensagens[mensagens.length - 1];
        // Só alerta se NÃO está na aba chat e a mensagem não é do usuário atual
        if (aba !== "chat" && ultima.id !== parlamentar.id) {
          setChatAlert(true);
        }
      }
    });
    return () => unsubscribe();
  }, [parlamentar, aba]);

  const pedirPalavra = async () => {
    if (!parlamentar) return;
    setEnviando(true);
    await updateDoc(doc(db, "painelAtivo", "ativo"), {
      pedidosTribuna: arrayUnion({
        id: parlamentar.id,
        nome: parlamentar.nome,
        partido: parlamentar.partido,
        foto: parlamentar.foto || "",
        horario: new Date().toISOString(),
        status: "Pendente"
      })
    });
    setEnviando(false);
  };

  const votosValidos = ["Sim", "Não", "Abstenção"];
  const enviarVoto = async (escolha) => {
    if (!votosValidos.includes(escolha) || !parlamentar) return;
    setEnviando(true);
    await updateDoc(doc(db, "painelAtivo", "ativo"), {
      [`votacaoAtual.votos.${parlamentar.id}`]: {
        vereador_id: parlamentar.id,
        nome: parlamentar.nome,
        partido: parlamentar.partido,
        voto: escolha,
        foto: parlamentar.foto || "",
        dataHora: new Date().toISOString(),
      },
    });
    setVoto(escolha);
    setEnviando(false);
  };

  const jaVotou = voto === "Sim" || voto === "Não" || voto === "Abstenção";
  const handleVotar = (novoVoto) => {
    if (jaVotou && voto !== novoVoto) {
      setModalConfirm({ exibir: true, etapa: 1, votoNovo: novoVoto });
    } else if (!jaVotou) {
      enviarVoto(novoVoto);
    }
  };
  const confirmarAlteracao = async () => {
    if (modalConfirm.etapa === 1) {
      setModalConfirm(m => ({ ...m, etapa: 2 }));
    } else if (modalConfirm.etapa === 2) {
      setModalConfirm({ exibir: false, etapa: 1, votoNovo: "" });
      await enviarVoto(modalConfirm.votoNovo);
    }
  };
  const cancelarAlteracao = () => setModalConfirm({ exibir: false, etapa: 1, votoNovo: "" });

  const TABS = [
    { key: "votacao", label: "Votação" },
    { key: "tribuna", label: "Tribuna" },
    { key: "sessao", label: "Sessão Ativa" },
    { key: "chat", label: "Chat" },
  ];

  if (!parlamentar)
    return (
      <div className="sessao-parlamentar-container">
        <TopoInstitucional />
        <div className="sessao-info">
          <h2>Parlamentar não encontrado</h2>
          <p>Faça login novamente.</p>
        </div>
      </div>
    );

  if (!painel)
    return (
      <div className="sessao-parlamentar-container">
        <TopoInstitucional />
        <div className="sessao-info"><h2>Sessão não iniciada</h2><p>Aguardando início da sessão...</p></div>
      </div>
    );

  const { votacaoAtual, numeroSessaoLegislativa, numeroSessaoOrdinaria, modalidade, local, legislatura, legislaturaDescricao,
    data, hora, presidente, secretario, mesaDiretora, parlamentares, pedidosTribuna, ataCompleta, ataPdfUrl, observacoes
  } = painel;

  const materia = votacaoAtual?.materia || votacaoAtual?.titulo || "-";
  const autor = votacaoAtual?.autor || "-";
  const tipo = votacaoAtual?.tipo || "-";
  const statusSessao = painel.statusSessao || "-";
  const statusVotacao = (votacaoAtual?.status || "").toLowerCase();
  const habilitados = votacaoAtual?.habilitados || [];
  const podeVotar = statusSessao === "Ativa" && (statusVotacao === "em_votacao" || statusVotacao === "votando") && habilitados.includes(parlamentar.id);

  let msg = "";
  if (!habilitados.includes(parlamentar.id)) {
    msg = "Você não está habilitado para votar nesta sessão. Procure a Mesa Diretora.";
  } else if (!(statusVotacao === "em_votacao" || statusVotacao === "votando")) {
    msg = "Aguardando abertura da votação.";
  } else if (jaVotou) {
    msg = "Seu voto já foi registrado! Caso deseje, é possível alterar até o final da votação.";
  }

  return (
    <div className="sessao-parlamentar-container">
      <TopoInstitucional />
      <div className="aba-tabs">
        {TABS.map(t => (
          <button
            key={t.key}
            className={aba === t.key ? "tab-ativo" : ""}
            onClick={() => {
              setAba(t.key);
              if (t.key === "chat") setChatAlert(false);
            }}
            style={{ position: "relative" }}
          >
            {t.label}
            {t.key === "chat" && chatAlert && (
              <span className="chat-alert-badge" />
            )}
          </button>
        ))}
      </div>
      <div className="sessao-parlamentar-bloco">
        {/* ABA VOTAÇÃO */}
        {aba === "votacao" && (
          <div>
            <div className="parlamentar-header">
              <img src={parlamentar.foto || "/assets/default-parlamentar.png"} alt={parlamentar.nome} className="parlamentar-foto" />
              <div>
                <div className="parlamentar-nome">{parlamentar.nome} {parlamentar.partido && <span className="parlamentar-partido">({parlamentar.partido})</span>}</div>
                <div className="parlamentar-tipo">Perfil: {parlamentar.tipo || "-"}</div>
              </div>
            </div>
            <div className="sessao-info">
              <h2>Votação em Andamento</h2>
              <p><b>Matéria:</b> {materia}</p>
              <p><b>Tipo:</b> {tipo}</p>
              <p><b>Autor:</b> {autor}</p>
              <p><b>Status:</b> <span className="status-votacao">{votacaoAtual?.status || "-"}</span></p>
              <p><b>Sessão:</b> {numeroSessaoLegislativa || "-"} - Ordinária Nº {numeroSessaoOrdinaria || "-"} ({modalidade || "-"})</p>
              <p><b>Data:</b> {data || "-"} | <b>Hora:</b> {hora || "-"}</p>
              <p><b>Presidente:</b> {presidente || "-"} | <b>Secretário:</b> {secretario || "-"}</p>
            </div>
            <div className="sessao-voto-bloco">
              {podeVotar && (
                <div className="voto-opcoes">
                  <h3>Selecione seu voto:</h3>
                  <button className={`botao-voto botao-voto-sim${voto === "Sim" ? " ativo" : ""}`} onClick={() => handleVotar("Sim")} disabled={enviando}>✅ Sim</button>
                  <button className={`botao-voto botao-voto-nao${voto === "Não" ? " ativo" : ""}`} onClick={() => handleVotar("Não")} disabled={enviando}>❌ Não</button>
                  <button className={`botao-voto botao-voto-abstencao${voto === "Abstenção" ? " ativo" : ""}`} onClick={() => handleVotar("Abstenção")} disabled={enviando}>⚪ Abstenção</button>
                </div>
              )}
              <div className="voto-mensagem">{msg}</div>
              {jaVotou && (
                <div className="voto-confirmado">
                  <p>Seu voto atual:</p>
                  <span className={`voto-exibido voto-${voto.toLowerCase()}`}>{voto}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ABA TRIBUNA */}
        {aba === "tribuna" && (
          <div>
            <h2>Tribuna - Pedir Palavra</h2>
            <div style={{ margin: "18px 0" }}>
              {pedidoFeito ? (
                <div className="aviso">Você já pediu a palavra e está aguardando aceitação.</div>
              ) : (
                <button className="botao-voto" onClick={pedirPalavra} disabled={enviando}>✋ Pedir Palavra</button>
              )}
            </div>
            <h3>Pedidos Pendentes:</h3>
            <ul>
              {(pedidosTribuna || [])
                .filter(p => p.status === "Pendente")
                .map((p, i) => (
                  <li key={p.id || i}>
                    <img src={p.foto || "/assets/default-parlamentar.png"} alt={p.nome} style={{ width: 28, borderRadius: "50%", marginRight: 8 }} />
                    <b>{p.nome}</b> {p.partido ? <span>({p.partido})</span> : null} - <span>{formatarData(p.horario)}</span>
                  </li>
                ))}
            </ul>
            <div className="tribuna-publico">
              <b>Painel Público:</b> {pedidosTribuna?.filter(p => p.status === "Pendente").length > 0
                ? pedidosTribuna.filter(p => p.status === "Pendente").map(p => `${p.nome} pediu a palavra`).join(", ")
                : "Nenhum pedido de palavra no momento."}
            </div>
          </div>
        )}

        {/* ABA SESSÃO ATIVA */}
        {aba === "sessao" && (
          <div>
            <h2>Sessão Ativa</h2>
            <p><b>Sessão:</b> {numeroSessaoLegislativa || "-"} - Ordinária Nº {numeroSessaoOrdinaria || "-"} ({modalidade || "-"})</p>
            <p><b>Data:</b> {data || "-"} | <b>Hora:</b> {hora || "-"}</p>
            <p><b>Local:</b> {local || "-"} | <b>Legislatura:</b> {legislatura || "-"} <span style={{ color: "#888" }}>{legislaturaDescricao}</span></p>
            <p><b>Presidente:</b> {presidente || "-"} | <b>Secretário:</b> {secretario || "-"}</p>
            <h3>Mesa Diretora</h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              {(mesaDiretora || []).length === 0 && <span style={{ color: "#888" }}>Não informada</span>}
              {(mesaDiretora || []).map((m, idx) => (
                <div key={m.id || idx} style={{
                  border: "1px solid #eee", borderRadius: 8, padding: "6px 14px", display: "flex", alignItems: "center", gap: 7,
                  minWidth: 120, background: "#f7fafc"
                }}>
                  <img src={m.foto || "/assets/default-parlamentar.png"} alt={m.nome} style={{ width: 30, height: 30, borderRadius: "50%" }} />
                  <span><b>{m.nome}</b><br /><span style={{ fontSize: 12, color: "#888" }}>{m.cargo}</span></span>
                </div>
              ))}
            </div>
            <h3 style={{marginTop:18}}>Parlamentares Presentes</h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 10 }}>
              {(parlamentares || []).filter(p => p.presente).map((p, i) => (
                <div key={p.id || i} style={{
                  border: "1px solid #eee", borderRadius: 8, padding: "4px 12px", display: "flex", alignItems: "center", gap: 6,
                  minWidth: 80, background: "#fafdff"
                }}>
                  <img src={p.foto || "/assets/default-parlamentar.png"} alt={p.nome} style={{ width: 26, height: 26, borderRadius: "50%" }} />
                  <span>{p.nome} <span style={{ color: "#1854b4", fontWeight: 500 }}>{p.partido}</span></span>
                </div>
              ))}
              {(!parlamentares || parlamentares.filter(p => p.presente).length === 0) && (
                <span style={{ color: "#888" }}>Nenhum parlamentar presente</span>
              )}
            </div>
            <h3>Matéria em Votação</h3>
            {votacaoAtual ? (
              <>
                <p><b>Título:</b> {votacaoAtual.materia || votacaoAtual.titulo || "-"}</p>
                <p><b>Tipo:</b> {votacaoAtual.tipo || "-"}</p>
                <p><b>Autor:</b> {votacaoAtual.autor || "-"}</p>
                <p><b>Descrição:</b> {votacaoAtual.descricao || "-"}</p>
              </>
            ) : (
              <p style={{ color: "#888" }}>Nenhuma matéria em votação</p>
            )}
            <h3>Observações</h3>
            <p>{observacoes || <span style={{ color: "#aaa" }}>Nenhuma</span>}</p>
            {/* ATA (texto completo) */}
            {ataCompleta && ataCompleta.trim() && (
              <>
                <h3>Ata Completa</h3>
                <div style={{
                  background: "#f8fafd", borderRadius: 8, padding: 12, marginBottom: 10,
                  border: "1px solid #eee", maxHeight: 270, overflow: "auto", whiteSpace: "pre-wrap"
                }}>
                  {ataCompleta}
                </div>
              </>
            )}
            {/* PDF/ATA */}
            {ataPdfUrl && (
              <a href={ataPdfUrl} target="_blank" rel="noopener noreferrer" className="botao-voto" style={{ marginTop: 8, display: "inline-block" }}>
                Baixar Ata em PDF
              </a>
            )}
          </div>
        )}

        {/* ABA CHAT */}
        {aba === "chat" && (
          <div style={{marginTop: 12}}>
            <Chat usuario={parlamentar} />
          </div>
        )}
      </div>
      {/* MODAL DE CONFIRMAÇÃO DUPLA */}
      {modalConfirm.exibir && (
        <div className="modal-overlay">
          <div className="modal-confirmacao">
            {modalConfirm.etapa === 1 ? (
              <>
                <p>Tem certeza que deseja alterar seu voto para <b>{modalConfirm.votoNovo}</b>?</p>
                <div>
                  <button className="botao-confirmar" onClick={confirmarAlteracao}>Confirmar</button>
                  <button className="botao-cancelar" onClick={cancelarAlteracao}>Cancelar</button>
                </div>
              </>
            ) : (
              <>
                <p><b>Confirme novamente:</b> alterar o voto para <b>{modalConfirm.votoNovo}</b>?</p>
                <div>
                  <button className="botao-confirmar" onClick={confirmarAlteracao}>Confirmar e Salvar</button>
                  <button className="botao-cancelar" onClick={cancelarAlteracao}>Cancelar</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Utilitário para datas
function formatarData(str) {
  if (!str) return "";
  const d = new Date(str);
  if (isNaN(d)) return str;
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString().slice(0, 5)}`;
}
