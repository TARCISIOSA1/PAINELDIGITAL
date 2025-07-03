import React, { useEffect, useState } from "react";
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";
import { db } from "../firebase";

export default function ChatInbox({ userId, onOpenChat }) {
  const [conversas, setConversas] = useState([]);

  useEffect(() => {
    if (!userId) return;
    const q = query(
      collection(db, "conversas"),
      where("participantes", "array-contains", userId),
      orderBy("ultimaData", "desc")
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const lista = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setConversas(lista);
    });
    return () => unsub();
  }, [userId]);

  return (
    <div style={{ maxHeight: "400px", overflowY: "auto", border: "1px solid #ccc", padding: 8 }}>
      <h3>Conversas</h3>
      <button onClick={() => onOpenChat(null, true)}>+ Criar Grupo</button>
      <ul style={{ listStyle: "none", paddingLeft: 0 }}>
        {conversas.length === 0 && <li>Nenhuma conversa</li>}
        {conversas.map((conv) => (
          <li
            key={conv.id}
            style={{ cursor: "pointer", padding: 6, borderBottom: "1px solid #eee" }}
            onClick={() => onOpenChat(conv.id, false)}
          >
            <strong>{conv.tipo === "grupo" ? conv.nomeGrupo : "Chat Individual"}</strong><br />
            Última mensagem: {conv.ultimaMensagem || "—"}
          </li>
        ))}
      </ul>
    </div>
  );
}
