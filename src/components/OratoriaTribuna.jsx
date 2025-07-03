// src/components/OratoriaTribuna.jsx
import React, { useEffect, useState } from "react";
import { collection, getDocs, query, where, orderBy } from "firebase/firestore";
import { db } from "../firebase";

export default function OratoriaTribuna({ idSessao = null }) {
  const [falas, setFalas] = useState([]);
  const [carregando, setCarregando] = useState(true);

  // Se quiser buscar todas as falas de todas as sessões, deixe idSessao = null

  useEffect(() => {
    async function fetchFalas() {
      setCarregando(true);
      let q = collection(db, "falasTribuna");
      if (idSessao) {
        // Busca só as falas da sessão específica
        q = query(
          collection(db, "falasTribuna"),
          where("idSessao", "==", idSessao),
          orderBy("dataHoraInicioTribuna", "asc")
        );
      } else {
        // Busca todas as falas
        q = query(
          collection(db, "falasTribuna"),
          orderBy("dataHoraInicioTribuna", "desc")
        );
      }

      const snap = await getDocs(q);
      setFalas(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setCarregando(false);
    }
    fetchFalas();
  }, [idSessao]);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      <h2 style={{ fontSize: "2em", marginBottom: 24 }}>🗣️ Falas da Tribuna</h2>
      {carregando && <p>Carregando falas...</p>}
      {!carregando && falas.length === 0 && (
        <p style={{ color: "#888" }}>
          Nenhuma fala registrada{ idSessao ? " nesta sessão." : "." }
        </p>
      )}
      {falas.map(fala => (
        <div
          key={fala.id}
          style={{
            border: "1px solid #dcdcdc",
            borderRadius: 12,
            marginBottom: 24,
            background: "#f8f8f8",
            boxShadow: "0 1px 4px #0001",
            padding: 18,
          }}
        >
          <div style={{ fontWeight: "bold", fontSize: "1.2em" }}>
            {fala.nomeOrador} {fala.partidoOrador ? `(${fala.partidoOrador})` : ""}
          </div>
          <div style={{ fontSize: "0.97em", color: "#666", margin: "4px 0 10px 0" }}>
            <span>
              Início:{" "}
              {fala.dataHoraInicioTribuna
                ? new Date(fala.dataHoraInicioTribuna).toLocaleString()
                : "-"}
            </span>
            {" | "}
            <span>
              Fim:{" "}
              {fala.dataHoraFimTribuna
                ? new Date(fala.dataHoraFimTribuna).toLocaleString()
                : "-"}
            </span>
            {fala.idSessao && (
              <>
                {" | "}
                <span style={{ fontStyle: "italic" }}>Sessão: {fala.idSessao}</span>
              </>
            )}
          </div>
          <div
            style={{
              background: "#fff",
              padding: 12,
              borderRadius: 8,
              fontSize: "1.1em",
              whiteSpace: "pre-wrap",
              minHeight: 30,
              marginBottom: 2,
            }}
          >
            {fala.falaCompleta || <em style={{ color: "#999" }}>Fala não registrada.</em>}
          </div>
        </div>
      ))}
    </div>
  );
}
