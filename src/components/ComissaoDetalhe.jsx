import React, { useEffect, useState } from "react";
import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "../firebase";

function MembrosComissao({ comissaoId }) {
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
    <div className="comissao-aba membros">
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

export default function ComissaoDetalhe({ comissaoId }) {
  const [abas, setAbas] = useState("atas");

  // Estados para atas
  const [atas, setAtas] = useState([]);
  const [formAta, setFormAta] = useState({
    dataReuniao: "",
    resumo: "",
    status: "Rascunho",
    arquivoUrl: ""
  });
  const [editandoAtaId, setEditandoAtaId] = useState(null);

  // Estados para pareceres
  const [pareceres, setPareceres] = useState([]);
  const [formParecer, setFormParecer] = useState({
    numero: "",
    dataParecer: "",
    descricao: "",
    status: "Pendente",
    arquivoUrl: "",
  });
  const [editandoParecerId, setEditandoParecerId] = useState(null);

  useEffect(() => {
    if (!comissaoId) return;
    const colAtas = collection(db, "comissoes", comissaoId, "atas");
    const q = query(colAtas, orderBy("dataReuniao", "desc"));
    getDocs(q).then((snapshot) => {
      const lista = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAtas(lista);
    });
  }, [comissaoId]);

  useEffect(() => {
    if (!comissaoId) return;
    const colPareceres = collection(db, "comissoes", comissaoId, "pareceres");
    const q = query(colPareceres, orderBy("dataParecer", "desc"));
    getDocs(q).then((snapshot) => {
      const lista = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPareceres(lista);
    });
  }, [comissaoId]);

  async function salvarAta() {
    if (!formAta.dataReuniao.trim()) {
      alert("Data da reunião é obrigatória");
      return;
    }
    const col = collection(db, "comissoes", comissaoId, "atas");

    if (editandoAtaId) {
      const ref = doc(col, editandoAtaId);
      await updateDoc(ref, formAta);
      setEditandoAtaId(null);
    } else {
      await addDoc(col, formAta);
    }
    setFormAta({
      dataReuniao: "",
      resumo: "",
      status: "Rascunho",
      arquivoUrl: ""
    });
    const q = collection(db, "comissoes", comissaoId, "atas");
    getDocs(q).then((snapshot) => {
      const lista = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAtas(lista);
    });
  }

  async function salvarParecer() {
    if (!formParecer.numero.trim()) {
      alert("Número do parecer é obrigatório");
      return;
    }
    const col = collection(db, "comissoes", comissaoId, "pareceres");

    if (editandoParecerId) {
      const ref = doc(col, editandoParecerId);
      await updateDoc(ref, formParecer);
      setEditandoParecerId(null);
    } else {
      await addDoc(col, formParecer);
    }
    setFormParecer({
      numero: "",
      dataParecer: "",
      descricao: "",
      status: "Pendente",
      arquivoUrl: ""
    });
    const q = collection(db, "comissoes", comissaoId, "pareceres");
    getDocs(q).then((snapshot) => {
      const lista = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPareceres(lista);
    });
  }

  async function excluirAta(id) {
    if (!window.confirm("Deseja excluir esta ata?")) return;
    const ref = doc(db, "comissoes", comissaoId, "atas", id);
    await deleteDoc(ref);
    setAtas(atas.filter(a => a.id !== id));
  }

  async function excluirParecer(id) {
    if (!window.confirm("Deseja excluir este parecer?")) return;
    const ref = doc(db, "comissoes", comissaoId, "pareceres", id);
    await deleteDoc(ref);
    setPareceres(pareceres.filter(p => p.id !== id));
  }

  function editarAta(ata) {
    setEditandoAtaId(ata.id);
    setFormAta(ata);
  }

  function editarParecer(parecer) {
    setEditandoParecerId(parecer.id);
    setFormParecer(parecer);
  }

  return (
    <div className="comissao-detalhe">
      <div className="abas">
        <button
          className={abas === "atas" ? "ativo" : ""}
          onClick={() => setAbas("atas")}
        >Atas</button>
        <button
          className={abas === "pareceres" ? "ativo" : ""}
          onClick={() => setAbas("pareceres")}
        >Pareceres</button>
        <button
          className={abas === "membros" ? "ativo" : ""}
          onClick={() => setAbas("membros")}
        >Membros</button>
      </div>

      {abas === "atas" && (
        <div className="comissao-aba atas">
          <h4>{editandoAtaId ? "Editar Ata" : "Nova Ata"}</h4>
          <form
            onSubmit={e => {
              e.preventDefault();
              salvarAta();
            }}
          >
            <label>Data da Reunião</label>
            <input
              type="date"
              value={formAta.dataReuniao}
              onChange={e => setFormAta({...formAta, dataReuniao: e.target.value})}
              required
            />
            <label>Resumo</label>
            <textarea
              value={formAta.resumo}
              onChange={e => setFormAta({...formAta, resumo: e.target.value})}
            />
            <label>Status</label>
            <select
              value={formAta.status}
              onChange={e => setFormAta({...formAta, status: e.target.value})}
            >
              <option>Rascunho</option>
              <option>Aprovado</option>
              <option>Publicado</option>
            </select>
            <label>Arquivo URL (opcional)</label>
            <input
              type="url"
              placeholder="https://exemplo.com/arquivo.pdf"
              value={formAta.arquivoUrl}
              onChange={e => setFormAta({...formAta, arquivoUrl: e.target.value})}
            />
            <button type="submit">{editandoAtaId ? "Atualizar" : "Salvar"}</button>
            {editandoAtaId && (
              <button
                type="button"
                onClick={() => {
                  setEditandoAtaId(null);
                  setFormAta({
                    dataReuniao: "",
                    resumo: "",
                    status: "Rascunho",
                    arquivoUrl: ""
                  });
                }}
              >Cancelar</button>
            )}
          </form>

          <h5>Atas da Comissão</h5>
          <ul>
            {atas.map(a => (
              <li key={a.id}>
                <b>{a.dataReuniao}</b> — {a.resumo} — <i>{a.status}</i> —{" "}
                {a.arquivoUrl && (
                  <a href={a.arquivoUrl} target="_blank" rel="noreferrer">Arquivo</a>
                )}
                <button onClick={() => editarAta(a)}>Editar</button>
                <button onClick={() => excluirAta(a.id)}>Excluir</button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {abas === "pareceres" && (
        <div className="comissao-aba pareceres">
          <h4>{editandoParecerId ? "Editar Parecer" : "Novo Parecer"}</h4>
          <form
            onSubmit={e => {
              e.preventDefault();
              salvarParecer();
            }}
          >
            <label>Número do Parecer</label>
            <input
              type="text"
              value={formParecer.numero}
              onChange={e => setFormParecer({...formParecer, numero: e.target.value})}
              required
            />
            <label>Data do Parecer</label>
            <input
              type="date"
              value={formParecer.dataParecer}
              onChange={e => setFormParecer({...formParecer, dataParecer: e.target.value})}
            />
            <label>Descrição</label>
            <textarea
              value={formParecer.descricao}
              onChange={e => setFormParecer({...formParecer, descricao: e.target.value})}
            />
            <label>Status</label>
            <select
              value={formParecer.status}
              onChange={e => setFormParecer({...formParecer, status: e.target.value})}
            >
              <option>Pendente</option>
              <option>Emitido</option>
              <option>Revisado</option>
            </select>
            <label>Arquivo URL (opcional)</label>
            <input
              type="url"
              placeholder="https://exemplo.com/arquivo.pdf"
              value={formParecer.arquivoUrl}
              onChange={e => setFormParecer({...formParecer, arquivoUrl: e.target.value})}
            />
            <button type="submit">{editandoParecerId ? "Atualizar" : "Salvar"}</button>
            {editandoParecerId && (
              <button
                type="button"
                onClick={() => {
                  setEditandoParecerId(null);
                  setFormParecer({
                    numero: "",
                    dataParecer: "",
                    descricao: "",
                    status: "Pendente",
                    arquivoUrl: "",
                  });
                }}
              >Cancelar</button>
            )}
          </form>

          <h5>Pareceres da Comissão</h5>
          <ul>
            {pareceres.map(p => (
              <li key={p.id}>
                <b>{p.numero}</b> — {p.descricao} — <i>{p.status}</i> — {p.dataParecer} —{" "}
                {p.arquivoUrl && (
                  <a href={p.arquivoUrl} target="_blank" rel="noreferrer">Arquivo</a>
                )}
                <button onClick={() => editarParecer(p)}>Editar</button>
                <button onClick={() => excluirParecer(p.id)}>Excluir</button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {abas === "membros" && (
        <MembrosComissao comissaoId={comissaoId} />
      )}
    </div>
  );
}
