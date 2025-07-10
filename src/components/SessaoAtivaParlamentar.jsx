import React, { useEffect, useState } from "react";
import { doc, onSnapshot, getDoc, getDocs, updateDoc, arrayUnion, collection } from "firebase/firestore";
import { db } from "../firebase";
import TopoInstitucional from "./TopoInstitucional";
import Chat from "./email/Chat";
import "./SessaoAtivaParlamentar.css";

export default function SessaoAtivaParlamentar() {
  const usuarioId = localStorage.getItem("id");

  const [parlamentar, setParlamentar] = useState(null);
  const [parlamentares, setParlamentares] = useState([]); // TODOS
  const [painel, setPainel] = useState(null);
  const [voto, setVoto] = useState("");
  const [aba, setAba] = useState("votacao");
  const [enviando, setEnviando] = useState(false);
  const [materiasVotadas, setMateriasVotadas] = useState([]);

  // Badge alerta chat
  const [chatAlert, setChatAlert] = useState(false);

  // Modal de confirmação de voto
  const [modalConfirm, setModalConfirm] = useState({ exibir: false, etapa: 1, votoNovo: "" });

  // Carrega TODOS os parlamentares
  useEffect(() => {
    async function fetchParlamentares() {
      const snap = await getDocs(collection(db, "parlamentares"));
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setParlamentares(lista);
      // Parlamentar logado
      const eu = lista.find(p => p.id === usuarioId);
      setParlamentar(eu || null);
    }
    fetchParlamentares();
  }, [usuarioId]);

  // Painel Ativo (sessão/votação/tribuna)
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
        if (aba !== "chat" && ultima.id !== parlamentar.id) {
          setChatAlert(true);
        }
      }
    });
    return () => unsubscribe();
  }, [parlamentar, aba]);

  // Carrega matérias votadas para resultados (exemplo: pega todas já votadas da coleção)
  useEffect(() => {
    async function fetchMaterias() {
      const snap = await getDocs(collection(db, "materias"));
      // Filtra só matérias já votadas e que tenham votos registrados
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .filter(m => m.status === "Votada" || m.status === "Aprovada" || m.status === "Rejeitada" || m.votos);
      setMateriasVotadas(lista);
    }
    fetchMaterias();
  }, []);

  // PEDIDOS DE FALA - sempre do painelAtivo
  const pedidosTribuna = painel?.pedidosTribuna || [];

  // Função: pedir palavra
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
        status: "Em Análise"
      })
    });
    setEnviando(false);
  };

  // Votação
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
    { key: "resultados", label: "Resultados" },
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
    data, hora, presidente, secretario, mesaDiretora, ataCompleta, ataPdfUrl, observacoes
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

  // Bloco para o pedido de fala (um só por parlamentar)
  const meuPedido = (pedidosTribuna || []).find(p => p.id === parlamentar.id);

  // Pega oradores da tribuna (com dados completos dos parlamentares)
  const oradoresTribuna = (painel.tribunaAtual?.oradores || []).map(o => {
    const p = parlamentares.find(p => p.id === o.id) || {};
    return {
      ...o,
      nome: p.nome || o.nome,
      partido: p.partido || o.partido,
      foto: p.foto || o.foto,
      tipo: p.tipo,
    };
  });

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
            {/* Pedido do próprio parlamentar */}
            {(() => {
              if (!meuPedido) {
                return (
                  <button className="botao-voto" onClick={pedirPalavra} disabled={enviando}>
                    ✋ Pedir Palavra
                  </button>
                );
              }
              if (meuPedido.status === "Em Análise") {
                return (
                  <div className="aviso" style={{background:'#f9f0c7', color:'#b48612'}}>
                    Seu pedido está <b>em análise</b> pela Mesa Diretora.<br/>Aguarde ser aceito ou rejeitado.
                  </div>
                );
              }
              if (meuPedido.status === "Aceito") {
                return (
                  <div className="aviso" style={{background:'#eaf3ff', color:'#1854b4'}}>
                    Pedido aceito! Você já foi incluído na lista de oradores da tribuna.
                  </div>
                );
              }
              if (meuPedido.status === "Rejeitado") {
                return (
                  <div className="aviso" style={{background:'#ffeaea', color:'#b02525'}}>
                    Seu pedido para falar na tribuna foi <b>rejeitado</b> pela Mesa Diretora.
                  </div>
                );
              }
              return null;
            })()}

            {/* Lista de pedidos em análise */}
            <h3 style={{marginTop:24, marginBottom:10}}>Pedidos em Análise</h3>
            <ul>
              {(pedidosTribuna || [])
                .filter(p => p.status === "Em Análise")
                .map((p, i) => (
                  <li key={p.id || i}>
                    <img src={p.foto || "/assets/default-parlamentar.png"} alt={p.nome} style={{ width: 28, borderRadius: "50%", marginRight: 8 }} />
                    <b>{p.nome}</b> {p.partido ? <span>({p.partido})</span> : null} - <span>{formatarData(p.horario)}</span>
                  </li>
                ))}
              {(!pedidosTribuna || pedidosTribuna.filter(p => p.status === "Em Análise").length === 0) && (
                <li style={{color:'#aaa'}}>Nenhum pedido em análise.</li>
              )}
            </ul>
            <div className="tribuna-publico">
              <b>Painel Público:</b> {pedidosTribuna?.filter(p => p.status === "Em Análise").length > 0
                ? pedidosTribuna.filter(p => p.status === "Em Análise").map(p => `${p.nome} pediu a palavra`).join(", ")
                : "Nenhum pedido de palavra no momento."}
            </div>

            {/* Lista de Oradores da Tribuna */}
            <h3 style={{marginTop:32}}>Oradores da Tribuna</h3>
            {oradoresTribuna && oradoresTribuna.length > 0 ? (
              <table style={{ width: "100%", marginBottom: 18, background: "#f9fbfe", borderRadius: 8, overflow: "hidden", fontSize: "1rem" }}>
                <thead>
                  <tr style={{ background: "#f0f4fa" }}>
                    <th style={{ padding: "6px 3px" }}>Ordem</th>
                    <th style={{ padding: "6px 3px" }}>Nome</th>
                    <th style={{ padding: "6px 3px" }}>Partido</th>
                    <th style={{ padding: "6px 3px" }}>Tempo (s)</th>
                    <th style={{ padding: "6px 3px" }}>Saldo</th>
                    <th style={{ padding: "6px 3px" }}>Fala</th>
                  </tr>
                </thead>
                <tbody>
                  {oradoresTribuna.map((o, i) => (
                    <tr key={o.id || i} style={{
                      background: painel.tribunaAtual.oradorAtivoIdx === i ? "#c2e5ff" : "transparent",
                      fontWeight: painel.tribunaAtual.oradorAtivoIdx === i ? "bold" : "normal"
                    }}>
                      <td style={{ textAlign: "center" }}>{o.ordem ?? i + 1}</td>
                      <td>
                        <img src={o.foto || "/assets/default-parlamentar.png"} alt={o.nome} style={{ width: 22, height: 22, borderRadius: "50%", verticalAlign: "middle", marginRight: 6 }} />
                        {o.nome}
                        {painel.tribunaAtual.oradorAtivoIdx === i && (
                          <span style={{ color: "#0b57d0", fontWeight: 700, marginLeft: 6 }}>[Falando]</span>
                        )}
                      </td>
                      <td>{o.partido}</td>
                      <td style={{ textAlign: "center" }}>{o.tempoFala ?? "-"}</td>
                      <td style={{ textAlign: "center" }}>{o.saldo ?? "0"}</td>
                      <td>{o.fala ? <span title={o.fala}>{o.fala.slice(0, 30)}{o.fala.length > 30 ? "..." : ""}</span> : <span style={{ color: "#999" }}>-</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div style={{ color: "#888", marginBottom: 16 }}>Nenhum orador inscrito na tribuna.</div>
            )}
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

        {/* ABA RESULTADOS */}
        {aba === "resultados" && (
          <div style={{marginTop:8}}>
            <h2>Resultados das Votações</h2>
            {(materiasVotadas && materiasVotadas.length > 0) ? (
              materiasVotadas.map((mat, idx) => {
                // Agrupa votos
                const votosArr = Object.values(mat.votos || {});
                const votosSim = votosArr.filter(v => v.voto === "Sim");
                const votosNao = votosArr.filter(v => v.voto === "Não");
                const votosAbst = votosArr.filter(v => v.voto === "Abstenção");
                return (
                  <div key={mat.id || idx} style={{marginBottom:30, background:"#f8fafd", borderRadius:8, padding:18, boxShadow:"0 2px 6px #0001"}}>
                    <div style={{fontWeight:700, fontSize:17, color:"#1854b4", marginBottom:3}}>
                      {mat.titulo || mat.materia || `Matéria #${idx+1}`}
                    </div>
                    <div style={{fontSize:14, color:"#666", marginBottom:10}}>{mat.tipo || ""} - {mat.autor || ""}</div>
                    <table style={{width:"100%", marginBottom:8, fontSize:15}}>
                      <thead>
                        <tr style={{background:"#f0f4fa"}}>
                          <th style={{padding:6}}>Resultado</th>
                          <th style={{padding:6}}>Sim</th>
                          <th style={{padding:6}}>Não</th>
                          <th style={{padding:6}}>Abstenção</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td style={{padding:6, fontWeight:600}}>
                            Sim: {votosSim.length} &nbsp;
                            Não: {votosNao.length} &nbsp;
                            Abstenção: {votosAbst.length}
                          </td>
                          <td style={{padding:6}}>
                            {votosSim.map(v => (
                              <div key={v.vereador_id}>
                                <img src={v.foto||"/assets/default-parlamentar.png"} alt="" style={{width:20, borderRadius:"50%", verticalAlign:"middle", marginRight:4}}/>
                                {v.nome}
                              </div>
                            ))}
                          </td>
                          <td style={{padding:6}}>
                            {votosNao.map(v => (
                              <div key={v.vereador_id}>
                                <img src={v.foto||"/assets/default-parlamentar.png"} alt="" style={{width:20, borderRadius:"50%", verticalAlign:"middle", marginRight:4}}/>
                                {v.nome}
                              </div>
                            ))}
                          </td>
                          <td style={{padding:6}}>
                            {votosAbst.map(v => (
                              <div key={v.vereador_id}>
                                <img src={v.foto||"/assets/default-parlamentar.png"} alt="" style={{width:20, borderRadius:"50%", verticalAlign:"middle", marginRight:4}}/>
                                {v.nome}
                              </div>
                            ))}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                );
              })
            ) : (
              <div style={{color:"#888"}}>Nenhuma votação finalizada.</div>
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

function formatarData(str) {
  if (!str) return "";
  const d = new Date(str);
  if (isNaN(d)) return str;
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString().slice(0, 5)}`;
}
