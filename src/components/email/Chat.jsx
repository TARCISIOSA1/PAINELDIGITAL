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

// Pega dados do usuário logado (id, nome, foto, etc)
function getUsuarioLogado() {
  try {
    const obj = JSON.parse(localStorage.getItem("usuarioLogado"));
    return obj && obj.id ? obj : null;
  } catch {
    return null;
  }
}

export default function Chat() {
  // Usuário logado
  const usuarioLogado = getUsuarioLogado();
  const usuarioId = usuarioLogado?.id || "";
  const [usuarios, setUsuarios] = useState([]);
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

  // Buscar conversas do usuário logado
  useEffect(() => {
    if (!usuarioId) return setConversas([]);
    const q = query(
      collection(db, "conversas"),
      where("membros", "array-contains", usuarioId),
      orderBy("ultimaMensagemTimestamp", "desc")
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const lista = [];
      snapshot.forEach(doc => {
        lista.push({ id: doc.id, ...doc.data() });
      });
      setConversas(lista);
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
    });
    return () => unsub();
  }, [conversaAtiva]);

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
    await addDoc(msgsRef, {
      remetenteId: usuarioId,
      tipo: "texto",
      texto: mensagemTexto.trim(),
      timestamp: new Date(),
    });
    const conversaDoc = doc(db, "conversas", conversaAtiva.id);
    await updateDoc(conversaDoc, {
      ultimaMensagemTexto: mensagemTexto.trim(),
      ultimaMensagemTimestamp: new Date(),
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

  // ==== ENVIO DE ARQUIVO ====
  async function handleArquivoSelecionado(e) {
    const file = e.target.files[0];
    if (!file || !conversaAtiva) return;
    const caminho = `chat/${conversaAtiva.id}/${Date.now()}_${file.name}`;
    const refArq = storageRef(storage, caminho);
    await uploadBytes(refArq, file);
    const url = await getDownloadURL(refArq);
    await addDoc(collection(db, "conversas", conversaAtiva.id, "mensagens"), {
      remetenteId: usuarioId,
      tipo: file.type.startsWith("image/") ? "imagem" : "arquivo",
      nomeArquivo: file.name,
      urlArquivo: url,
      timestamp: new Date(),
    });
    fileInputRef.current.value = "";
  }

  // ==== GRAVAÇÃO DE ÁUDIO ====
  async function gravarAudio() {
    if (gravando) {
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
      }
      setGravando(false);
      return;
    }
    if (!navigator.mediaDevices) {
      alert("Navegador não suporta gravação de áudio.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new window.MediaRecorder(stream);
      audioChunksRef.current = [];
      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };
      mediaRecorderRef.current.onstop = async () => {
        if (!audioChunksRef.current.length) {
          alert("Nenhum áudio gravado. Tente novamente.");
          return;
        }
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const caminho = `chat/${conversaAtiva.id}/${Date.now()}_audio.webm`;
        const refAudio = storageRef(storage, caminho);
        await uploadBytes(refAudio, blob);
        const url = await getDownloadURL(refAudio);
        await addDoc(collection(db, "conversas", conversaAtiva.id, "mensagens"), {
          remetenteId: usuarioId,
          tipo: "audio",
          urlAudio: url,
          timestamp: new Date(),
        });
      };
      mediaRecorderRef.current.start();
      setGravando(true);
      setTimeout(() => {
        if (
          mediaRecorderRef.current &&
          mediaRecorderRef.current.state === "recording"
        ) {
          mediaRecorderRef.current.stop();
          setGravando(false);
        }
      }, 30000);
    } catch (err) {
      alert("Não foi possível acessar o microfone.");
    }
  }

  // Caso não esteja logado
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
                <strong style={{ fontSize: 15, maxWidth: 80, overflow: "hidden", textOverflow: "ellipsis", display: "inline-block", whiteSpace: "nowrap" }}>
                  {u.nome}
                </strong>
                {u.numero && <span className="partido-numero"> - {u.numero}</span>}
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
            return (
              <div
                key={conv.id}
                className={`conversa-item ${conversaAtiva && conversaAtiva.id === conv.id ? "ativa" : ""}`}
                onClick={() => setConversaAtiva(conv)}
              >
                <strong>{nome}</strong>
                {conv.grupo === true && <span style={{ fontSize: 12, marginLeft: 8, color: "#888" }}>(Grupo)</span>}
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
            <div style={{ margin: "10px 0" }}>
              <button
                style={{ background: "#f22", color: "#fff", marginRight: 8, border: 0, padding: "6px 14px", borderRadius: 4 }}
                onClick={() => apagarConversa(conversaAtiva.id)}
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
                      {!isRemetente && <strong style={{ fontSize: 13, maxWidth: 85, overflow: "hidden", textOverflow: "ellipsis", display: "inline-block", whiteSpace: "nowrap" }}>{remetente.nome}</strong>}
                      {/* Áudio */}
                      {msg.tipo === "audio" && msg.urlAudio &&
                        <audio src={msg.urlAudio} controls style={{ width: 200 }} />
                      }
                      {/* Arquivo */}
                      {msg.tipo === "arquivo" && msg.urlArquivo &&
                        <div>
                          <a href={msg.urlArquivo} target="_blank" rel="noopener noreferrer">
                            📎 {msg.nomeArquivo}
                          </a>
                        </div>
                      }
                      {/* Imagem */}
                      {msg.tipo === "imagem" && msg.urlArquivo &&
                        <div>
                          <img src={msg.urlArquivo} alt={msg.nomeArquivo} style={{ maxWidth: 120, maxHeight: 120, borderRadius: 7, border: "1px solid #ccc" }} />
                          <div style={{ fontSize: 12 }}>{msg.nomeArquivo}</div>
                        </div>
                      }
                      {/* Texto */}
                      {(!msg.tipo || msg.tipo === "texto") && msg.texto &&
                        <p style={{ margin: 0 }}>{msg.texto}</p>
                      }
                    </div>
                  </div>
                );
              })}
              <div ref={mensagensEndRef}></div>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                enviarMensagem();
              }}
              className="form-enviar-msg"
            >
              <input
                type="file"
                accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
                style={{ display: "none" }}
                ref={fileInputRef}
                onChange={handleArquivoSelecionado}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current.click()}
                title="Enviar arquivo"
                style={{ marginRight: 8 }}
              >📎</button>
              {window.MediaRecorder && (
                <button
                  type="button"
                  onClick={gravarAudio}
                  title={gravando ? "Parar gravação" : "Gravar áudio"}
                  style={{ marginRight: 8, color: gravando ? "#c00" : "#222" }}
                >{gravando ? "⏹️" : "🎤"}</button>
              )}
              <input
                type="text"
                placeholder="Digite sua mensagem..."
                value={mensagemTexto}
                onChange={(e) => setMensagemTexto(e.target.value)}
                style={{ maxWidth: 150 }}
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
