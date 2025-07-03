// useCarregarSessao.js
import { useEffect, useState } from "react";
import { collection, doc, getDocs } from "firebase/firestore";
import { db } from "../firebase";

export function useCarregarSessao() {
  const [sessaoAtiva, setSessaoAtiva] = useState(null);
  const [materiasVotacao, setMateriasVotacao] = useState([]);
  const [ordemDoDia, setOrdemDoDia] = useState([]);
  const [parlamentares, setParlamentares] = useState([]);
  const [quorumMinimo, setQuorumMinimo] = useState(0);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    async function carregarDados() {
      setCarregando(true);

      const sessoesSnapshot = await getDocs(collection(db, "sessoes"));
      const sessao = sessoesSnapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .find((s) => s.status === "Ativa");

      if (!sessao) {
        setSessaoAtiva(null);
        setCarregando(false);
        return;
      }

      setSessaoAtiva(sessao);

      const materias = sessao.ordemDoDia || [];
      setMateriasVotacao(materias);
      setOrdemDoDia(materias.map((m) => m.id));

      const parlamentaresSnap = await getDocs(collection(db, "parlamentares"));
      const presencasSnap = await getDocs(collection(db, "sessoes", sessao.id, "presencas"));
      const presencasMap = new Map();
      presencasSnap.docs.forEach((doc) => presencasMap.set(doc.id, doc.data()));

      const lista = parlamentaresSnap.docs.map((doc) => {
        const data = doc.data();
        const presenca = presencasMap.get(doc.id) || {};
        return {
          id: doc.id,
          nome: data.nome,
          partido: data.partido,
          presente: presenca.presente || false,
          habilitado: presenca.habilitado || false,
        };
      });

      setParlamentares(lista);
      setQuorumMinimo(Math.ceil(lista.filter((p) => p.presente).length * 0.5));
      setCarregando(false);
    }

    carregarDados();
  }, []);

  return {
    sessaoAtiva,
    materiasVotacao,
    setMateriasVotacao,
    ordemDoDia,
    setOrdemDoDia,
    parlamentares,
    setParlamentares,
    quorumMinimo,
    carregando,
  };
}
