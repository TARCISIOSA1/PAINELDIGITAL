// src/components/PainelPublicoContainer.jsx
import React, { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import PainelVotacao from "./PainelVotacao";

export default function PainelPublicoContainer() {
  const [painelAtivo, setPainelAtivo] = useState(null);

  useEffect(() => {
    const docRef = doc(db, "painelAtivo", "ativo");
    const unsubscribe = onSnapshot(docRef, (docSnapshot) => {
      if (docSnapshot.exists()) {
        const data = docSnapshot.data();

        const temVotacao = data?.votacaoAtual?.status === "em_votacao" || data?.votacaoAtual?.status === "votando";

        if (temVotacao) {
          setPainelAtivo(data); // envia tudo: sessão + tribuna + votação
        } else {
          setPainelAtivo(null); // nenhuma votação em andamento
        }
      } else {
        setPainelAtivo(null);
      }
    });

    return () => unsubscribe();
  }, []);

  return <PainelVotacao painelAtivo={painelAtivo} />;
}
