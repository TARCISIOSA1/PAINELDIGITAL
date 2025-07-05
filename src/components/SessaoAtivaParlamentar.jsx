import React, { useEffect, useState } from "react";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import TopoInstitucional from "./TopoInstitucional";
import "./SessaoAtivaParlamentar.css";

const getUsuarioLogado = () => {
  return {
    id: localStorage.getItem("id"),
    nome: localStorage.getItem("nome"),
    partido: localStorage.getItem("partido"),
    foto: localStorage.getItem("foto"),
    tipo: localStorage.getItem("tipo"),
  };
};

export default function SessaoAtivaParlamentar() {
  const usuario = getUsuarioLogado();
  const [painel, setPainel] = useState(null);
  const [voto, setVoto] = useState("");
  const [status, setStatus] = useState("");
  const [enviando, setEnviando] = useState(false);

  // Controle do modal de confirmação de alteração de voto
  const [modalConfirm, setModalConfirm] = useState({
    exibir: false,
    etapa: 1,
    votoNovo: "",
  });

  useEffect(() => {
    const ref = doc(db, "painelAtivo", "ativo");
    const unsubscribe = onSnapshot(ref, (snap) => {
      if (!snap.exists()) {
        setPainel(null);
        return;
      }
      const data = snap.data();
      setPainel(data);

      if (data.votacaoAtual?.votos && usuario.id) {
        const votos = data.votacaoAtual.votos;
        const votoAtual = Object.values(votos).find(
          (v) => v.vereador_id === usuario.id
        );
        setVoto(votoAtual ? votoAtual.voto : "");
      } else {
        setVoto("");
      }
    });
    return () => unsubscribe();
  }, [usuario.id]);

  if (!painel)
    return (
      <div className="sessao-parlamentar-container">
        <TopoInstitucional />
        <div className="sessao-info">
          <h2>Sessão não iniciada</h2>
          <p>Aguardando início da sessão...</p>
        </div>
      </div>
    );

  const { votacaoAtual, statusSessao, titulo, data, hora, presidente, secretario } = painel;
  const materia = votacaoAtual?.materia || votacaoAtual?.titulo || "-";
  const autor = votacaoAtual?.autor || "-";
  const tipo = votacaoAtual?.tipo || "-";
  const statusVotacao = (votacaoAtual?.status || "").toLowerCase();
  const habilitados = votacaoAtual?.habilitados || [];
  const podeVotar =
    statusSessao === "Ativa" &&
    (statusVotacao === "em_votacao" || statusVotacao === "votando") &&
    habilitados.includes(usuario.id);

  const jaVotou = voto === "Sim" || voto === "Não" || voto === "Abstenção";

  // Fluxo de alteração de voto com dupla confirmação
  const handleVotar = (novoVoto) => {
    if (jaVotou && voto !== novoVoto) {
      setModalConfirm({ exibir: true, etapa: 1, votoNovo: novoVoto });
    } else if (!jaVotou) {
      enviarVoto(novoVoto);
    }
  };

  const confirmarAlteracao = async () => {
    if (modalConfirm.etapa === 1) {
      setModalConfirm((m) => ({ ...m, etapa: 2 }));
    } else if (modalConfirm.etapa === 2) {
      setModalConfirm({ exibir: false, etapa: 1, votoNovo: "" });
      await enviarVoto(modalConfirm.votoNovo);
    }
  };

  const cancelarAlteracao = () => {
    setModalConfirm({ exibir: false, etapa: 1, votoNovo: "" });
  };

  // Envio do voto (primeiro voto ou alteração)
  const enviarVoto = async (escolha) => {
    setEnviando(true);
    setStatus("");
    try {
      const ref = doc(db, "painelAtivo", "ativo");
      await updateDoc(ref, {
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
      setStatus("Voto registrado com sucesso!");
    } catch (err) {
      setStatus("Erro ao registrar voto. Tente novamente.");
    }
    setEnviando(false);
  };

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
      <div className="sessao-parlamentar-bloco">
        <div className="parlamentar-header">
          <img
            src={usuario.foto || "/assets/default-parlamentar.png"}
            alt={usuario.nome}
            className="parlamentar-foto"
          />
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
              <button
                className={`botao-voto botao-voto-sim${voto === "Sim" ? " ativo" : ""}`}
                onClick={() => handleVotar("Sim")}
                disabled={enviando}
              >
                ✅ Sim
              </button>
              <button
                className={`botao-voto botao-voto-nao${voto === "Não" ? " ativo" : ""}`}
                onClick={() => handleVotar("Não")}
                disabled={enviando}
              >
                ❌ Não
              </button>
              <button
                className={`botao-voto botao-voto-abstencao${voto === "Abstenção" ? " ativo" : ""}`}
                onClick={() => handleVotar("Abstenção")}
                disabled={enviando}
              >
                ⚪ Abstenção
              </button>
            </div>
          )}

          <div className="voto-mensagem">{msg}</div>

          {jaVotou && (
            <div className="voto-confirmado">
              <p>Seu voto atual:</p>
              <span className={`voto-exibido voto-${voto.toLowerCase()}`}>{voto}</span>
            </div>
          )}

          {status && <div className="voto-status">{status}</div>}
        </div>
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
