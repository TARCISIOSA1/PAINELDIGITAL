// useSessaoAtiva.js - Hook para obter a sessão ativa
import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";

export default function useSessaoAtiva() {
  const [sessaoAtiva, setSessaoAtiva] = useState(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    async function buscarSessaoAtiva() {
      setCarregando(true);
      const snapshot = await getDocs(collection(db, "sessoes"));
      const lista = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      const ativa = lista.find((s) => s.status === "Ativa");
      setSessaoAtiva(ativa || null);
      setCarregando(false);
    }
    buscarSessaoAtiva();
  }, []);

  return { sessaoAtiva, carregando };
}
