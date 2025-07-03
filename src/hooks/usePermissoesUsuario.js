import { useState, useEffect } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";

// Recebe o tipoUsuario do usuário logado
export default function usePermissoesUsuario(tipoUsuario) {
  const [permissoes, setPermissoes] = useState(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!tipoUsuario) return;
    async function carregar() {
      setCarregando(true);
      const snap = await getDocs(
        query(collection(db, "permissoes"), where("tipoUsuario", "==", tipoUsuario))
      );
      const obj = {};
      snap.forEach(doc => {
        obj[doc.data().tela] = doc.data().permissoes;
      });
      setPermissoes(obj);
      setCarregando(false);
    }
    carregar();
  }, [tipoUsuario]);

  return { permissoes, carregando };
}
