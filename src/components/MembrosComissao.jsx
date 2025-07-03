import React, { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "./firebase";

export default function MembrosComissao({ comissaoId }) {
  const [vereadores, setVereadores] = useState([]);
  const [membros, setMembros] = useState([]);
  const [selecionados, setSelecionados] = useState([]);

  useEffect(() => {
    async function carregarVereadores() {
      const q = query(collection(db, "vereadores"), orderBy("nome"));
      const snapshot = await getDocs(q);
      setVereadores(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }
    carregarVereadores();
  }, []);

  useEffect(() => {
    if (!comissaoId) return;
    async function carregarMembros() {
      const col = collection(db, "comissoes", comissaoId, "membros");
      const snapshot = await getDocs(col);
      const lista = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMembros(lista);
      setSelecionados(lista.map(m => m.userId));
    }
    carregarMembros();
  }, [comissaoId]);

  async function adicionarMembro(vereador) {
    if (selecionados.includes(vereador.id)) return;

    const col = collection(db, "comissoes", comissaoId, "membros");
    await addDoc(col, {
      userId: vereador.id,
      nome: vereador.nome,
      cargo: vereador.tipousuario || "",
      partido: vereador.partido || "",
      email: vereador.email || "",
      telefone: vereador.telefone || "",
    });

    setSelecionados([...selecionados, vereador.id]);
    setMembros([...membros, {
      userId: vereador.id,
      nome: vereador.nome,
      cargo: vereador.tipousuario || "",
      partido: vereador.partido || "",
      email: vereador.email || "",
      telefone: vereador.telefone || "",
    }]);
  }

  async function removerMembro(idMembro, userId) {
    if (!window.confirm("Remover este membro da comissão?")) return;
    await deleteDoc(doc(db, "comissoes", comissaoId, "membros", idMembro));
    setMembros(membros.filter(m => m.id !== idMembro));
    setSelecionados(selecionados.filter(id => id !== userId));
  }

  return (
    <div className="membros-comissao">
      <h4>Membros da Comissão</h4>
      <div>
        <label>Adicionar vereador:</label>
        <select
          onChange={e => {
            const userId = e.target.value;
            if (!userId) return;
            const vereador = vereadores.find(v => v.id === userId);
            if (vereador) adicionarMembro(vereador);
            e.target.value = "";
          }}
          defaultValue=""
        >
          <option value="">-- Selecione um vereador --</option>
          {vereadores
            .filter(v => !selecionados.includes(v.id))
            .map(v => (
              <option key={v.id} value={v.id}>
                {v.nome} - {v.tipousuario} - {v.partido}
              </option>
            ))}
        </select>
      </div>

      <ul className="lista-membros">
        {membros.map(m => (
          <li key={m.id}>
            <b>{m.nome}</b> - {m.cargo} - {m.partido} - {m.email} - {m.telefone}
            <button
              onClick={() => removerMembro(m.id, m.userId)}
              style={{ marginLeft: "10px", color: "red", cursor: "pointer" }}
            >
              Remover
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
