import React, { useEffect, useState } from "react";
import { doc, onSnapshot, updateDoc, arrayUnion } from "firebase/firestore";
import { db } from "../firebase";
import TopoInstitucional from "./TopoInstitucional";
import Chat from "./Chat";  // <<== Usa seu Chat existente!
import "./SessaoAtivaParlamentar.css";

const getUsuarioLogado = () => ({
  id: localStorage.getItem("id"),
  nome: localStorage.getItem("nome"),
  partido: localStorage.getItem("partido"),
  foto: localStorage.getItem("foto"),
  tipo: localStorage.getItem("tipo"),
});

export default function SessaoAtivaParlamentar() {
  const usuario = getUsuarioLogado();
  const [painel, setPainel] = useState(null);
  const [voto, setVoto] = useState("");
  const [aba, setAba] = useState("votacao");
  const [enviando, setEnviando] = useState(false);

  // PEDIR PALAVRA
  const [pedidoFeito, setPedidoFeito] = useState(false);

  // MODAL DE CONFIRMAÇÃO DUPLA (votação)
  const [modalConfirm, setModalConfirm] = useState({ exibir: false, etapa: 1, votoNovo: "" });

  useEffect(() => {
    // Painel ativo
    const ref = doc(db, "painelAtivo", "ativo");
    const unsubscribe = onSnapshot(ref, (snap) => {
      if (!snap.exists()) { setPainel(null); return; }
      const data = snap.data();
      setPainel(data);
      if (data.votacaoAtual?.votos && usuario.id) {
        const votos = data.votacaoAtual.votos;
        const votoAtual = Object.values(votos).find(v => v.vereador_id === usuario.id);
        setVoto(votoAtual ? votoAtual.voto : "");
      } else {
        setVoto("");
      }
      // Verifica se já pediu palavra
      if (data.pedidosTribuna && Array.isArray(data.pedidosTribuna)) {
        setPedidoFeito(data.pedidosTribuna.some(p => p.id === usuario.id && p.status === "Pendente"));
      }
    });
    return () => { unsubscribe(); }
  }, [usuario.id]);

  // ----- PEDIR PALAVRA -----
  const pedirPalavra = async () => {
    setEnviando(true);
    await updateDoc(doc(db, "painelAtivo", "ativo"), {
      pedidosTribuna: arrayUnion({
        id: usuario.id,
        nome: usuario.nome,
        partido: usuario.partido,
        foto: usuario.foto || "",
        horario: new Date().toISOString(),
        status: "Pendente"
      })
    });
    setEnviando(false);
  };

  // ----- ENVIAR VOTO -----
  const votosValidos = ["Sim", "Não", "Abstenção"];
  const enviarVoto = async (escolha) => {
    if (!votosValidos.includes(escolha)) return;
    setEnviando(true);
    await updateDoc(doc(db, "painelAtivo", "ativo"), {
      [`votacaoAtual.votos.${usuario.id}`]: {
        vereador_id: usuario.id,
        nome: usuario.nome,
        partido: usuario.partido,
        voto: escolha,
        foto: usuario.foto || "",
        dataHora: new Date().toISOString(),
      },
    });
    setVoto(escolha);
    setEnviando(false);
  };
  // Controle modal dupla confirmação de voto
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

  // ------ TABS -----
  const TABS = [
    { key: "votacao", label: "Votação" },
    { key: "tribuna", label: "Tribuna" },
    { key: "sessao", label: "Sessão Ativa" },
    { key: "chat", label: "Chat" },
  ];

  if (!painel) return (
    <div className="sessao-parlamentar-container">
      <TopoInstitucional />
      <div className="sessao-info"><h2>Sessão não iniciada</h2><p>Aguardando início da sessão...</p></div>
    </div>
  );

  // Info da sessão/matéria
  const { votacaoAtual, titulo, data, hora, presidente, secretario, pedidosTribuna } = painel;
  const materia = votacaoAtual?.materia || votacaoAtual?.titulo || "-";
  const autor = votacaoAtual?.autor || "-";
  const tipo = votacaoAtual?.tipo || "-";
  const statusSessao = painel.statusSessao || "-";
  const statusVotacao = (votacaoAtual?.status || "").toLowerCase();
  const habilitados = votacaoAtual?.habilitados || [];
  const podeVotar = statusSessao === "Ativa" && (statusVotacao === "em_votacao" || statusVotacao === "votando") && habilitados.includes(usuario.id);

  let msg = "";
  if (!habilitados.includes(usuario.id)) {
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
            onClick={() => setAba(t.key)}
          >{t.label}</button>
        ))}
      </div>
      <div className="sessao-parlamentar-bloco">
        {/* ABA VOTAÇÃO */}
        {aba === "votacao" && (
          <div>
            <div className="parlamentar-header">
              <img src={usuario.foto || "/assets/default-parlamentar.png"} alt={usuario.nome} className="parlamentar-foto" />
              <div>
                <div className="parlamentar-nome">{usuario.nome} {usuario.partido && <span className="parlamentar-partido">({usuario.partido})</span>}</div>
                <div className="parlamentar-tipo">Perfil: {usuario.tipo}</div>
              </div>
            </div>
            <div className="sessao-info">
              <h2>Votação em Andamento</h2>
              <p><b>Matéria:</b> {materia}</p>
              <p><b>Tipo:</b> {tipo}</p>
              <p><b>Autor:</b> {autor}</p>
              <p><b>Status:</b> <span className="status-votacao">{votacaoAtual?.status || "-"}</span></p>
              <p><b>Sessão:</b> {titulo || "-"} | <b>Data:</b> {data || "-"} | <b>Hora:</b> {hora || "-"}</p>
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
        {/* ABA TRIBUNA - PEDIR PALAVRA */}
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
            {/* Mensagem pública (para painel público): */}
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
            <p><b>Sessão:</b> {titulo || "-"}</p>
            <p><b>Data:</b> {data || "-"} | <b>Hora:</b> {hora || "-"}</p>
            <p><b>Presidente:</b> {presidente || "-"} | <b>Secretário:</b> {secretario || "-"}</p>
            <h3>Matéria em Votação:</h3>
            <p><b>Título:</b> {materia}</p>
            <p><b>Tipo:</b> {tipo}</p>
            <p><b>Autor:</b> {autor}</p>
            <h3>Resumo:</h3>
            <p>{votacaoAtual?.descricao || "Sem resumo cadastrado."}</p>
            {/* PDF/ATA (link fictício, ajuste para seu campo real) */}
            {painel.ataPdfUrl && (
              <a href={painel.ataPdfUrl} target="_blank" rel="noopener noreferrer" className="botao-voto">Baixar Ata em PDF</a>
            )}
          </div>
        )}
        {/* ABA CHAT – usa seu componente! */}
        {aba === "chat" && (
          <div style={{marginTop: 12}}>
            <Chat usuario={usuario} />
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

// Função utilitária para formatar datas/horários
function formatarData(str) {
  if (!str) return "";
  const d = new Date(str);
  if (isNaN(d)) return str;
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString().slice(0, 5)}`;
}
