// src/components/MensagensInbox.jsx
import React, { useEffect, useState } from "react";
import { db, storage } from "../firebase";
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
} from "firebase/firestore";

export default function MensagensInbox({ usuarioId, onAbrirConversa }) {
  const [conversas, setConversas] = useState([]);
  const [filtro, setFiltro] = useState("");

  useEffect(() => {
    if (!usuarioId) return;

    const q = query(
      collection(db, "conversas"),
      where("participantes", "array-contains", usuarioId),
      orderBy("ultimaData", "desc")
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const lista = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      if (filtro.trim()) {
        const fLower = filtro.toLowerCase();
        setConversas(
          lista.filter((c) =>
            (c.nomeGrupo || "")
              .toLowerCase()
              .includes(fLower)
          )
        );
      } else {
        setConversas(lista);
      }
    });

    return () => unsubscribe();
  }, [usuarioId, filtro]);

  return (
    <div style={{ maxHeight: "80vh", overflowY: "auto" }}>
      <input
        type="text"
        placeholder="Buscar conversa/grupo"
        value={filtro}
        onChange={(e) => setFiltro(e.target.value)}
        style={{ width: "100%", padding: "8px", marginBottom: "8px" }}
      />
      {conversas.length === 0 && <p>Nenhuma conversa encontrada.</p>}
      <ul style={{ listStyle: "none", padding: 0 }}>
        {conversas.map((c) => (
          <li
            key={c.id}
            onClick={() => onAbrirConversa(c)}
            style={{
              cursor: "pointer",
              padding: "8px",
              borderBottom: "1px solid #ccc",
            }}
          >
            <strong>{c.tipo === "grupo" ? c.nomeGrupo : "Conversa individual"}</strong>
            <br />
            <small>
              {c.ultimoTexto
                ? c.ultimoTexto.length > 40
                  ? c.ultimoTexto.slice(0, 40) + "..."
                  : c.ultimoTexto
                : "Sem mensagens ainda"}
            </small>
          </li>
        ))}
      </ul>
    </div>
  );
}
