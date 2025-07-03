import React, { useEffect, useState } from "react";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../firebase";
import ComissaoDetalhe from "./ComissaoDetalhe";
import TopoInstitucional from "./TopoInstitucional";
import "./ListaComissoes.css"; // Importa o CSS

export default function ListaComissoes() {
  const [comissoes, setComissoes] = useState([]);
  const [comissaoSelecionada, setComissaoSelecionada] = useState(null);
  const [form, setForm] = useState({
    nome: "",
    descricao: "",
    tipo: "Permanente",
    presidente: "",
    vicePresidente: "",
    secretario: "",
    status: "Ativa",
    dataCriacao: "",
    dataExtincao: "",
  });
  const [editandoId, setEditandoId] = useState(null);
  const [erroNome, setErroNome] = useState("");

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "comissoes"), snapshot => {
      const lista = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setComissoes(lista);
    });
    return () => unsubscribe();
  }, []);

  function selecionarComissao(c) {
    setErroNome("");
    setComissaoSelecionada(c);
    setEditandoId(c.id);
    setForm({
      nome: c.nome || "",
      descricao: c.descricao || "",
      tipo: c.tipo || "Permanente",
      presidente: c.presidente || "",
      vicePresidente: c.vicePresidente || "",
      secretario: c.secretario || "",
      status: c.status || "Ativa",
      dataCriacao: c.dataCriacao || "",
      dataExtincao: c.dataExtincao || "",
    });
  }

  function novaComissao() {
    setErroNome("");
    setComissaoSelecionada(null);
    setEditandoId(null);
    setForm({
      nome: "",
      descricao: "",
      tipo: "Permanente",
      presidente: "",
      vicePresidente: "",
      secretario: "",
      status: "Ativa",
      dataCriacao: "",
      dataExtincao: "",
    });
  }

  async function salvarComissao(e) {
    e.preventDefault();
    if (!form.nome.trim()) {
      setErroNome("O nome da comissão é obrigatório.");
      return;
    }
    setErroNome("");
    if (editandoId) {
      const ref = doc(db, "comissoes", editandoId);
      await updateDoc(ref, form);
      setComissaoSelecionada({ id: editandoId, ...form });
    } else {
      const docRef = await addDoc(collection(db, "comissoes"), form);
      setComissaoSelecionada({ id: docRef.id, ...form });
      setEditandoId(docRef.id);
    }
  }

  async function excluirComissao(id) {
    if (!window.confirm("Tem certeza que deseja excluir esta comissão? Essa ação não pode ser desfeita.")) return;
    await deleteDoc(doc(db, "comissoes", id));
    if (comissaoSelecionada?.id === id) {
      setComissaoSelecionada(null);
      setEditandoId(null);
      novaComissao();
    }
  }

  return (
    <>
      <TopoInstitucional />

      <div className="container">
        <aside className="sidebar" role="complementary" aria-label="Lista de Comissões">
          <h2>Comissões</h2>
          <button className="btn-nova" onClick={novaComissao}>+ Nova Comissão</button>
          <ul className="comissoes-lista">
            {comissoes.map(c => (
              <li
                key={c.id}
                className={comissaoSelecionada?.id === c.id ? "selected" : ""}
                onClick={() => selecionarComissao(c)}
                title={`Clique para editar a comissão "${c.nome}"`}
                tabIndex={0}
                onKeyDown={e => {
                  if (e.key === "Enter" || e.key === " ") selecionarComissao(c);
                }}
              >
                {c.nome}
                <button
                  className="btn-excluir"
                  onClick={e => {
                    e.stopPropagation();
                    excluirComissao(c.id);
                  }}
                  aria-label={`Excluir comissão ${c.nome}`}
                  title={`Excluir comissão ${c.nome}`}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <main className="main-area" role="main">
          <h2>{editandoId ? "Editar Comissão" : "Nova Comissão"}</h2>
          {erroNome && <div className="erro">{erroNome}</div>}
          <form onSubmit={salvarComissao} noValidate>
            <label htmlFor="nomeComissao">Nome da Comissão</label>
            <input
              id="nomeComissao"
              placeholder="Nome da Comissão"
              value={form.nome}
              onChange={e => setForm({ ...form, nome: e.target.value })}
              required
              aria-required="true"
            />

            <label htmlFor="descricaoComissao">Descrição</label>
            <textarea
              id="descricaoComissao"
              placeholder="Descrição"
              value={form.descricao}
              onChange={e => setForm({ ...form, descricao: e.target.value })}
            />

            <label htmlFor="tipoComissao">Tipo</label>
            <select
              id="tipoComissao"
              value={form.tipo}
              onChange={e => setForm({ ...form, tipo: e.target.value })}
            >
              <option>Permanente</option>
              <option>Temporária</option>
              <option>Especial</option>
              <option>CPI</option>
            </select>

            <label htmlFor="presidenteComissao">Presidente</label>
            <input
              id="presidenteComissao"
              placeholder="Presidente"
              value={form.presidente}
              onChange={e => setForm({ ...form, presidente: e.target.value })}
            />

            <label htmlFor="vicePresidenteComissao">Vice-Presidente</label>
            <input
              id="vicePresidenteComissao"
              placeholder="Vice-Presidente"
              value={form.vicePresidente}
              onChange={e => setForm({ ...form, vicePresidente: e.target.value })}
            />

            <label htmlFor="secretarioComissao">Secretário</label>
            <input
              id="secretarioComissao"
              placeholder="Secretário"
              value={form.secretario}
              onChange={e => setForm({ ...form, secretario: e.target.value })}
            />

            <label htmlFor="statusComissao">Status</label>
            <select
              id="statusComissao"
              value={form.status}
              onChange={e => setForm({ ...form, status: e.target.value })}
            >
              <option>Ativa</option>
              <option>Inativa</option>
              <option>Extinta</option>
            </select>

            <label htmlFor="dataCriacaoComissao">Data Criação</label>
            <input
              id="dataCriacaoComissao"
              type="date"
              value={form.dataCriacao}
              onChange={e => setForm({ ...form, dataCriacao: e.target.value })}
            />

            <label htmlFor="dataExtincaoComissao">Data Extinção</label>
            <input
              id="dataExtincaoComissao"
              type="date"
              value={form.dataExtincao}
              onChange={e => setForm({ ...form, dataExtincao: e.target.value })}
            />

            <button type="submit" className="btn-salvar">Salvar Comissão</button>
          </form>

          {editandoId && <ComissaoDetalhe comissaoId={editandoId} />}
        </main>
      </div>
    </>
  );
}
