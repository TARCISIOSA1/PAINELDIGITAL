import React, { useState, useEffect, useRef } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { db, storage } from "../../firebase";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import "./Chat.css";

// Função para buscar o usuário logado do localStorage
function getUsuarioLogado() {
  try {
    const obj = JSON.parse(localStorage.getItem("usuarioLogado"));
    return obj && obj.id ? obj : null;
  } catch {
    return null;
  }
}

export default function Chat() {
  const usuarioLogado = getUsuarioLogado();
  const usuarioId = usuarioLogado?.id || "";
  const [usuarios, setUsuarios] = useState([]);
  const [onlineIds, setOnlineIds] = useState(new Set());
  const [conversas, setConversas] = useState([]);
  const [conversaAtiva, setConversaAtiva] = useState(null);
  const [mensagemTexto, setMensagemTexto] = useState("");
  const [modoCriarGrupo, setModoCriarGrupo] = useState(false);
  const [grupoNome, setGrupoNome] = useState("");
  const [grupoParticipantes, setGrupoParticipantes] = useState(new Set());
  const [mensagens, setMensagens] = useState([]);
  const mensagensEndRef = useRef(null);
  const fileInputRef = useRef(null);

  // Áudio
  const [gravando, setGravando] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  // === NOVO: Para badge/contagem de não lidas ===
  const [naoLidasPorConversa, setNaoLidasPorConversa] = useState({});

  // Buscar contatos (parlamentares)
  useEffect(() => {
    const q = query(collection(db, "parlamentares"));
    const unsub = onSnapshot(q, (snapshot) => {
      const lista = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        lista.push({ id: doc.id, ...data });
      });
      setUsuarios(lista);
    });
    return () => unsub();
  }, []);

  // Buscar conversas do usuário logado (e badge não lida)
  useEffect(() => {
    if (!usuarioId) return setConversas([]);
    const q = query(
      collection(db, "conversas"),
      where("membros", "array-contains", usuarioId),
      orderBy("ultimaMensagemTimestamp", "desc")
    );
    const unsub = onSnapshot(q, async (snapshot) => {
      const lista = [];
      const naoLidasObj = {};
      for (const docu of snapshot.docs) {
        const data = docu.data();
        lista.push({ id: docu.id, ...data });

        // Checa não lidas para o badge
        let totalNaoLidas = 0;
        const msgsSnap = await getDocs(
          query(
            collection(db, "conversas", docu.id, "mensagens"),
            orderBy("timestamp", "asc")
          )
        );
        const msgs = [];
        msgsSnap.forEach((m) => msgs.push({ id: m.id, ...m.data() }));
        // Lógica: última mensagem lida por esse usuário
        const lidas = data.lidas || {};
        const lastLidaId = lidas[usuarioId];
        let achouLida = false;
        for (let i = msgs.length - 1; i >= 0; i--) {
          if (!achouLida && msgs[i].id === lastLidaId) {
            achouLida = true;
            break;
          }
          if (!achouLida && msgs[i].remetenteId !== usuarioId) totalNaoLidas++;
        }
        naoLidasObj[docu.id] = totalNaoLidas;
      }
      setConversas(lista);
      setNaoLidasPorConversa(naoLidasObj);
    });
    return () => unsub();
  }, [usuarioId]);

  // Buscar mensagens da conversa ativa
  useEffect(() => {
    if (!conversaAtiva) {
      setMensagens([]);
      return;
    }
    const msgsRef = collection(db, "conversas", conversaAtiva.id, "mensagens");
    const q = query(msgsRef, orderBy("timestamp", "asc"));
    const unsub = onSnapshot(q, (snapshot) => {
      const msgs = [];
      snapshot.forEach(doc => {
        msgs.push({ id: doc.id, ...doc.data() });
      });
      setMensagens(msgs);

      // Marcar como lidas ao abrir conversa
      if (msgs.length > 0 && usuarioId) {
        updateDoc(doc(db, "conversas", conversaAtiva.id), {
          [`lidas.${usuarioId}`]: msgs[msgs.length - 1].id
        });
      }
    });
    return () => unsub();
    // eslint-disable-next-line
  }, [conversaAtiva, usuarioId]);

  useEffect(() => {
    if (mensagensEndRef.current) {
      mensagensEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [mensagens]);

  // Iniciar conversa privada
  async function iniciarConversaPrivada(usuario) {
    if (!usuarioId) return;
    const q = query(
      collection(db, "conversas"),
      where("grupo", "==", false),
      where("membros", "array-contains", usuarioId)
    );
    const snapshot = await getDocs(q);
    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      if (
        data.membros.length === 2 &&
        data.membros.includes(usuario.id)
      ) {
        setConversaAtiva({ id: docSnap.id, ...data });
        return;
      }
    }
    const novoDoc = await addDoc(collection(db, "conversas"), {
      grupo: false,
      membros: [usuarioId, usuario.id],
      nome: null,
      criador: usuarioId,
      ultimaMensagemTexto: "",
      ultimaMensagemTimestamp: new Date(),
    });
    const docRef = doc(db, "conversas", novoDoc.id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      setConversaAtiva({ id: novoDoc.id, ...docSnap.data() });
    }
  }

  // Criar grupo
  async function criarGrupo() {
    if (grupoParticipantes.size === 0 || grupoNome.trim() === "") {
      alert("Informe nome do grupo e selecione pelo menos um participante.");
      return;
    }
    const membrosArray = Array.from(grupoParticipantes);
    if (!membrosArray.includes(usuarioId)) membrosArray.push(usuarioId);

    const novoDoc = await addDoc(collection(db, "conversas"), {
      grupo: true,
      nome: grupoNome.trim(),
      membros: membrosArray,
      criador: usuarioId,
      ultimaMensagemTexto: "",
      ultimaMensagemTimestamp: new Date(),
      lidas: { [usuarioId]: "" }
    });

    const docRef = doc(db, "conversas", novoDoc.id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      setConversaAtiva({ id: novoDoc.id, ...docSnap.data() });
    }

    setModoCriarGrupo(false);
    setGrupoNome("");
    setGrupoParticipantes(new Set());
  }

  // Enviar mensagem texto
  async function enviarMensagem() {
    if (!conversaAtiva || mensagemTexto.trim() === "") return;
    const msgsRef = collection(db, "conversas", conversaAtiva.id, "mensagens");
    const msgDoc = await addDoc(msgsRef, {
      remetenteId: usuarioId,
      tipo: "texto",
      texto: mensagemTexto.trim(),
      timestamp: new Date(),
    });
    const conversaDoc = doc(db, "conversas", conversaAtiva.id);
    await updateDoc(conversaDoc, {
      ultimaMensagemTexto: mensagemTexto.trim(),
      ultimaMensagemTimestamp: new Date(),
      [`lidas.${usuarioId}`]: msgDoc.id
    });
    setMensagemTexto("");
  }

  function toggleParticipante(id) {
    const newSet = new Set(grupoParticipantes);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setGrupoParticipantes(newSet);
  }

  function dadosRemetente(id) {
    return usuarios.find(u => u.id === id) || { nome: "Usuário", foto: "" };
  }

  function isOnline(id) {
    return onlineIds.has(id);
  }

  // ==== ENVIO DE ARQUIVO ====
  async function handleArquivoSelecionado(e) {
    const file = e.target.files[0];
    if (!file || !conversaAtiva) return;
    const caminho = `chat/${conversaAtiva.id}/${Date.now()}_${file.name}`;
    const refArq = storageRef(storage, caminho);
    await uploadBytes(refArq, file);
    const url = await getDownloadURL(refArq);
    const msgDoc = await addDoc(collection(db, "conversas", conversaAtiva.id, "mensagens"), {
      remetenteId: usuarioId,
      tipo: file.type.startsWith("image/") ? "imagem" : "arquivo",
      nomeArquivo: file.name,
      urlArquivo: url,
      timestamp: new Date(),
    });
    await updateDoc(doc(db, "conversas", conversaAtiva.id), {
      ultimaMensagemTexto: file.name,
      ultimaMensagemTimestamp: new Date(),
      [`lidas.${usuarioId}`]: msgDoc.id
    });
    fileInputRef.current.value = "";
  }

  // ==== GRAVAÇÃO DE ÁUDIO ====
  async function gravarAudio() {
    if (gravando) {
      mediaRecorderRef.current.stop();
      setGravando(false);
      return;
    }
    if (!navigator.mediaDevices) {
      alert("Navegador não suporta gravação de áudio.");
      return;
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorderRef.current = new window.MediaRecorder(stream);
    audioChunksRef.current = [];
    mediaRecorderRef.current.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunksRef.current.push(e.data);
    };
    mediaRecorderRef.current.onstop = async () => {
      const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
      const caminho = `chat/${conversaAtiva.id}/${Date.now()}_audio.webm`;
      const refAudio = storageRef(storage, caminho);
      await uploadBytes(refAudio, blob);
      const url = await getDownloadURL(refAudio);
      const msgDoc = await addDoc(collection(db, "conversas", conversaAtiva.id, "mensagens"), {
        remetenteId: usuarioId,
        tipo: "audio",
        urlAudio: url,
        timestamp: new Date(),
      });
      await updateDoc(doc(db, "conversas", conversaAtiva.id), {
        ultimaMensagemTexto: "[Áudio]",
        ultimaMensagemTimestamp: new Date(),
        [`lidas.${usuarioId}`]: msgDoc.id
      });
    };
    mediaRecorderRef.current.start();
    setGravando(true);
    setTimeout(() => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();
        setGravando(false);
      }
    }, 30000);
  }

  if (!usuarioLogado || !usuarioId) {
    return (
      <div style={{ padding: 40, maxWidth: 400, margin: "60px auto", color: "#c00", fontWeight: "bold" }}>
        Você precisa estar logado para usar o chat.<br />
        Realize o login no sistema e tente novamente.
      </div>
    );
  }

  // Layout
  return (
    <div className="chat-container">
      {/* COLUNA ESQUERDA */}
      <div className="lista-conversas">
        <div className="contatos-logado">
          <strong>Usuário logado:</strong>
          <div style={{ color: "#045", margin: "3px 0 10px 0" }}>
            {usuarioLogado.nome || usuarioId}
          </div>
          <div style={{ opacity: 0.4, fontSize: '0.8rem' }}>
            ID: {usuarioId}
          </div>
        </div>
        <button className="btn-novo-grupo" onClick={() => setModoCriarGrupo(true)}>+ Novo Grupo</button>
        <div className="contatos-sidebar">
          <div className="contatos-titulo">Contatos:</div>
          {usuarios.filter(u => u.id !== usuarioId).map((u) => (
            <div
              key={u.id}
              className="contato-item"
              onClick={() => iniciarConversaPrivada(u)}
              title={`Iniciar conversa com ${u.nome}`}
            >
              <img src={u.foto || "/default-avatar.png"} alt={u.nome} className="foto-contato" />
              <div>
                <strong>{u.nome}</strong>
                {u.numero && <span className="partido-numero"> - {u.numero}</span>}
                {/* Online indicator (opcional) */}
              </div>
            </div>
          ))}
        </div>
        <hr className="separador-conversas" />
        <div className="conversas-titulo">Conversas e Grupos</div>
        {conversas.length === 0 && <p className="nenhuma-conversa">Nenhuma conversa.</p>}
        <div className="conversas-lista">
          {conversas.map((conv) => {
            let nome = "Conversa";
            if (conv.grupo === false) {
              const outroId = conv.membros.find(id => id !== usuarioId);
              const outro = usuarios.find(u => u.id === outroId);
              nome = outro ? outro.nome : "Desconhecido";
            } else if (conv.grupo === true) {
              nome = conv.nome || "Grupo sem nome";
            }
            const naoLidas = naoLidasPorConversa[conv.id] || 0;
            return (
              <div
                key={conv.id}
                className={`conversa-item ${conversaAtiva && conversaAtiva.id === conv.id ? "ativa" : ""} ${naoLidas ? "nao-lida" : ""}`}
                onClick={() => setConversaAtiva(conv)}
              >
                <strong>{nome}</strong>
                {conv.grupo === true && <span style={{ fontSize: 12, marginLeft: 8, color: "#888" }}>(Grupo)</span>}
                {naoLidas > 0 && (
                  <span className="badge-nao-lida">{naoLidas > 99 ? "99+" : naoLidas}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* PAINEL DIREITO */}
      <div className="area-chat">
        {!conversaAtiva && !modoCriarGrupo && (
          <div className="info-selecione">
            <span>Selecione uma conversa ou crie um grupo para começar.</span>
          </div>
        )}
        {modoCriarGrupo && (
          <div className="form-criar-grupo">
            <h3>Criar Grupo</h3>
            <input
              type="text"
              placeholder="Nome do grupo"
              value={grupoNome}
              onChange={(e) => setGrupoNome(e.target.value)}
            />
            <div className="lista-participantes">
              {usuarios.filter(u => u.id !== usuarioId).map((u) => (
                <label key={u.id} className="participante-checkbox">
                  <input
                    type="checkbox"
                    checked={grupoParticipantes.has(u.id)}
                    onChange={() => toggleParticipante(u.id)}
                  />
                  {u.nome}
                </label>
              ))}
            </div>
            <button onClick={criarGrupo} className="btn-criar-grupo">Criar</button>
            <button onClick={() => setModoCriarGrupo(false)} className="btn-cancelar-grupo">Cancelar</button>
          </div>
        )}
        {conversaAtiva && !modoCriarGrupo && (
          <>
            <div className="header-chat">
              <h3>
                {conversaAtiva.grupo === false
                  ? (() => {
                    const outroId = conversaAtiva.membros.find(id => id !== usuarioId);
                    const outro = usuarios.find(u => u.id === outroId);
                    return outro ? outro.nome : "Desconhecido";
                  })()
                  : conversaAtiva.nome || "Grupo sem nome"}
              </h3>
            </div>
            {/* BOTÕES DE AÇÃO */}
            <div style={{ margin: "10px 0" }}>
              <button
                style={{ background: "#f22", color: "#fff", marginRight: 8, border: 0, padding: "6px 14px", borderRadius: 4 }}
                onClick={() => {
                  if (window.confirm("Tem certeza que deseja apagar este grupo/conversa? Essa ação não pode ser desfeita!")) {
                    apagarConversa(conversaAtiva.id)
                  }
                }}
              >
                Apagar grupo/conversa
              </button>
              <button
                style={{ background: "#bbb", color: "#333", border: 0, padding: "6px 14px", borderRadius: 4 }}
                onClick={() => limparMensagens(conversaAtiva.id)}
              >
                Limpar mensagens
              </button>
            </div>
            <div className="mensagens-lista">
              {mensagens.map((msg) => {
                const remetente = dadosRemetente(msg.remetenteId);
                const isRemetente = msg.remetenteId === usuarioId;
                return (
                  <div
                    key={msg.id}
                    className={`mensagem-item ${isRemetente ? "remetente" : "destinatario"}`}
                  >
                    {!isRemetente && remetente.foto && (
                      <img src={remetente.foto} alt={remetente.nome} className="foto-remetente" />
                    )}
                    <div className="mensagem-texto">
                      {!isRemetente && <strong>{remetente.nome}</strong>}
                      {msg.tipo === "audio" && msg.urlAudio &&
                        <audio src={msg.urlAudio} controls style={{ width: 200 }} />
                      }
                      {msg.tipo === "arquivo" && msg.urlArquivo &&
                        <div>
                          <a href={msg.urlArquivo} target="_blank" rel="noopener noreferrer">
                            📎 {msg.nomeArquivo}
                          </a>
                        </div>
                      }
                      {msg.tipo === "imagem" && msg.urlArquivo &&
                        <div>
                          <img src={msg.urlArquivo} alt={msg.nomeArquivo} style={{ maxWidth: 180, maxHeight: 180, borderRadius: 7, border: "1px solid #ccc" }} />
                          <div style={{ fontSize: 12 }}>{msg.nomeArquivo}</div>
                        </div>
                      }
                      {(!msg.tipo || msg.tipo === "texto") && msg.texto &&
                        <p>{msg.texto}</p>
                      }
                    </div>
                  </div>
                );
              })}
              <div ref={mensagensEndRef}></div>
            </div>
            {/* FORM DE ENVIO */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                enviarMensagem();
              }}
              className="form-enviar-msg"
            >
              {/* INPUT HIDDEN DE ARQUIVO */}
              <input
                type="file"
                accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
                style={{ display: "none" }}
                ref={fileInputRef}
                onChange={handleArquivoSelecionado}
              />
              {/* BOTÃO DE ARQUIVO */}
              <button
                type="button"
                onClick={() => fileInputRef.current.click()}
                title="Enviar arquivo"
                style={{ marginRight: 8 }}
              >📎</button>
              {/* BOTÃO DE ÁUDIO */}
              <button
                type="button"
                onClick={gravarAudio}
                title={gravando ? "Parar gravação" : "Gravar áudio"}
                style={{ marginRight: 8, color: gravando ? "#c00" : "#222" }}
              >{gravando ? "⏹️" : "🎤"}</button>
              {/* TEXTO */}
              <input
                type="text"
                placeholder="Digite sua mensagem..."
                value={mensagemTexto}
                onChange={(e) => setMensagemTexto(e.target.value)}
              />
              <button type="submit" disabled={mensagemTexto.trim() === ""}>Enviar</button>
            </form>
            {gravando && <div style={{ color: "#c00", fontSize: 14 }}>Gravando áudio... Clique no microfone para parar.</div>}
          </>
        )}
      </div>
    </div>
  );
}
