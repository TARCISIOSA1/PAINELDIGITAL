import React, { useState, useEffect } from "react";
import { collection, addDoc, getDocs } from "firebase/firestore";
import { db } from "../../firebase";
import "./ModalCriarGrupo.css";

export default function ModalCriarGrupo({ aberto, onClose, usuario }) {
  const [nomeGrupo, setNomeGrupo] = useState("");
  const [usuarios, setUsuarios] = useState([]);
  const [selecionados, setSelecionados] = useState([]);

  useEffect(() => {
    if (!aberto) return;
    // Carregar usuários para seleção (pode filtrar apenas parlamentares e admins)
    async function loadUsuarios() {
      const snapshot = await getDocs(collection(db, "usuarios"));
      setUsuarios(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    }
    loadUsuarios();
  }, [aberto]);

  function toggleSelecionado(id) {
    if (selecionados.includes(id)) {
      setSelecionados(selecionados.filter((x) => x !== id));
    } else {
      setSelecionados([...selecionados, id]);
    }
  }

  async function criarGrupo() {
    if (!nomeGrupo.trim() || selecionados.length === 0) {
      alert("Preencha nome do grupo e selecione participantes.");
      return;
    }
    try {
      await addDoc(collection(db, "conversas"), {
        nome: nomeGrupo,
        participantes: [usuario.id, ...selecionados],
        mensagens: [],
        ultimaAtualizacao: new Date(),
      });
      setNomeGrupo("");
      setSelecionados([]);
      onClose();
    } catch (err) {
      alert("Erro ao criar grupo: " + err.message);
    }
  }

  if (!aberto) return null;
  return (
    <div className="modal-fundo">
      <div className="modal-container">
        <h3>Criar Grupo de Chat</h3>
        <input
          type="text"
          placeholder="Nome do grupo"
          value={nomeGrupo}
          onChange={(e) => setNomeGrupo(e.target.value)}
        />
        <div className="usuarios-lista">
          {usuarios.map((u) => (
            <label key={u.id}>
              <input
                type="checkbox"
                checked={selecionados.includes(u.id)}
                onChange={() => toggleSelecionado(u.id)}
              />
              {u.nome || u.email || u.id}
            </label>
          ))}
        </div>
        <div className="modal-actions">
          <button onClick={criarGrupo}>Criar</button>
          <button onClick={onClose} className="btn-cancelar">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
