import React, { useState, useEffect, useRef } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  doc,
  updateDoc,
  arrayUnion,
} from "firebase/firestore";
import { db } from "../../firebase"; // ajuste caminho
import ModalCriarGrupo from "./ModalCriarGrupo";
import "./ChatConversas.css";

export default function ChatConversas({ usuario }) {
  const [conversas, setConversas] = useState([]);
  const [conversaAtiva, setConversaAtiva] = useState(null);
  const [mensagem, setMensagem] = useState("");
  const [modalCriarGrupoOpen, setModalCriarGrupoOpen] = useState(false);
  const mensagensEndRef = useRef();

  // Carregar conversas do usuário (participante)
  useEffect(() => {
    if (!usuario?.id) return;

    const q = query(
      collection(db, "conversas"),
      where("participantes", "array-contains", usuario.id),
      orderBy("ultimaAtualizacao", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const lista = [];
      snapshot.forEach((doc) => lista.push({ id: doc.id, ...doc.data() }));
      setConversas(lista);
    });

    return () => unsubscribe();
  }, [usuario]);

  // Enviar mensagem
  async function enviarMensagem() {
    if (!mensagem.trim() || !conversaAtiva) return;
    try {
      const refConversa = doc(db, "conversas", conversaAtiva.id);
      await updateDoc(refConversa, {
        mensagens: arrayUnion({
          idRemetente: usuario.id,
          texto: mensagem.trim(),
          dataEnvio: new Date(),
        }),
        ultimaAtualizacao: new Date(),
      });
      setMensagem("");
      scrollParaFim();
    } catch (error) {
      alert("Erro ao enviar mensagem: " + error.message);
    }
  }

  // Scroll para fim das mensagens
  function scrollParaFim() {
    setTimeout(() => {
      if (mensagensEndRef.current) {
        mensagensEndRef.current.scrollIntoView({ behavior: "smooth" });
      }
    }, 100);
  }

  useEffect(() => {
    scrollParaFim();
  }, [conversaAtiva]);

  return (
    <div className="chat-container">
      <aside className="chat-sidebar">
        <button
          className="btn-criar-grupo"
          onClick={() => setModalCriarGrupoOpen(true)}
        >
          + Criar Grupo
        </button>
        <ul className="lista-conversas">
          {conversas.map((c) => (
            <li
              key={c.id}
              className={`conversa-item ${
                conversaAtiva?.id === c.id ? "ativa" : ""
              }`}
              onClick={() => setConversaAtiva(c)}
            >
              <div className="nome-conversa">
                {c.nome || c.participantes.join(", ")}
              </div>
              <div className="ultima-mensagem">
                {c.mensagens && c.mensagens.length > 0
                  ? c.mensagens[c.mensagens.length - 1].texto
                  : "Sem mensagens"}
              </div>
            </li>
          ))}
        </ul>
      </aside>

      <section className="chat-content">
        {conversaAtiva ? (
          <>
            <header className="chat-header">{conversaAtiva.nome || conversaAtiva.participantes.join(", ")}</header>
            <div className="chat-mensagens">
              {conversaAtiva.mensagens?.map((m, i) => (
                <div
                  key={i}
                  className={`mensagem-item ${
                    m.idRemetente === usuario.id ? "minha-mensagem" : "outra-mensagem"
                  }`}
                >
                  <span>{m.texto}</span>
                  <small>
                    {m.dataEnvio?.toDate
                      ? m.dataEnvio.toDate().toLocaleString()
                      : new Date(m.dataEnvio).toLocaleString()}
                  </small>
                </div>
              ))}
              <div ref={mensagensEndRef} />
            </div>
            <footer className="chat-footer">
              <textarea
                placeholder="Digite sua mensagem..."
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    enviarMensagem();
                  }
                }}
              />
              <button onClick={enviarMensagem}>Enviar</button>
            </footer>
          </>
        ) : (
          <div className="chat-selecao">Selecione uma conversa ou crie um grupo</div>
        )}

        <ModalCriarGrupo
          aberto={modalCriarGrupoOpen}
          onClose={() => setModalCriarGrupoOpen(false)}
          usuario={usuario}
        />
      </section>
    </div>
  );
}
