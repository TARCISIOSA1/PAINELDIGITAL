import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase/config";

export function usePainelAtivo() {
  const [painel, setPainel] = useState(null);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "painelAtivo", "ativo"), (docSnap) => {
      if (docSnap.exists()) {
        setPainel(docSnap.data());
      } else {
        setPainel(null);
      }
    });
    return () => unsub();
  }, []);

  return painel;
}
