// src/components/Comissoes.jsx
import React, { useState, useEffect } from "react";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  getDocs,
} from "firebase/firestore";
import { db } from "../firebase";
import TopoInstitucional from "./TopoInstitucional";
import "./Comissoes.css";

export default function Comissoes() {
  const [aba, setAba] = useState("dados");
  const [comissoes, setComissoes] = useState([]);
  const [parlamentares, setParlamentares] = useState([]);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState({
    nome: "",
    descricao: "",
    tipo: "Permanente",
    status: "Ativa",
    dataCriacao: "",
    dataExtincao: "",
  });

  const [membros, setMembros] = useState([]);
  const [atas, setAtas] = useState([]);
  const [pareceres, setPareceres] = useState([]);
  const [novoMembro, setNovoMembro] = useState({ id: "", funcao: "" });
  const [novaAta, setNovaAta] = useState({ titulo: "", data: "", pdf: null });
  const [novoParecer, setNovoParecer] = useState({ titulo: "", data: "", pdf: null });

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "comissoes"), (snap) => {
      const lista = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setComissoes(lista);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    getDocs(collection(db, "parlamentares")).then((snap) => {
      const lista = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setParlamentares(lista);
    });
  }, []);

  async function salvarComissao() {
    if (!form.nome.trim()) return alert("Nome obrigatório");
    if (editando) {
      await updateDoc(doc(db, "comissoes", editando), form);
    } else {
      await addDoc(collection(db, "comissoes"), form);
    }
    setForm({ nome: "", descricao: "", tipo: "Permanente", status: "Ativa", dataCriacao: "", dataExtincao: "" });
    setEditando(null);
  }

  function editarComissao(c) {
    setEditando(c.id);
    setForm(c);
    setAba("dados");
    carregarSubdados(c.id);
  }

  function cancelarEdicao() {
    setEditando(null);
    setForm({ nome: "", descricao: "", tipo: "Permanente", status: "Ativa", dataCriacao: "", dataExtincao: "" });
    setMembros([]);
    setAtas([]);
    setPareceres([]);
  }

  async function excluirComissao(id) {
    if (window.confirm("Excluir comissão?")) {
      await deleteDoc(doc(db, "comissoes", id));
    }
  }

  async function carregarSubdados(id) {
    const membrosSnap = await getDocs(collection(db, `comissoes/${id}/membros`));
    setMembros(membrosSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    const atasSnap = await getDocs(collection(db, `comissoes/${id}/atas`));
    setAtas(atasSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    const parecerSnap = await getDocs(collection(db, `comissoes/${id}/pareceres`));
    setPareceres(parecerSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }

  async function adicionarMembro() {
    if (!novoMembro.id || !novoMembro.funcao) return alert("Selecione parlamentar e função");
    const p = parlamentares.find((p) => p.id === novoMembro.id);
    await addDoc(collection(db, `comissoes/${editando}/membros`), {
      nome: p.nome,
      funcao: novoMembro.funcao,
      parlamentarId: p.id,
    });
    setNovoMembro({ id: "", funcao: "" });
    carregarSubdados(editando);
  }

  async function adicionarArquivo(tipo) {
    const data = tipo === "ata" ? novaAta : novoParecer;
    if (!data.titulo || !data.data || !data.pdf) return alert("Preencha tudo e anexe PDF");
    const novo = { titulo: data.titulo, data: data.data, pdf: URL.createObjectURL(data.pdf) };
    await addDoc(collection(db, `comissoes/${editando}/${tipo === "ata" ? "atas" : "pareceres"}`), novo);
    tipo === "ata" ? setNovaAta({ titulo: "", data: "", pdf: null }) : setNovoParecer({ titulo: "", data: "", pdf: null });
    carregarSubdados(editando);
  }

  return (
    <div className="comissoes-container">
      <TopoInstitucional />
      <div className="comissoes-wrapper">
        <div className="lista-comissoes">
          <h2>Comissões</h2>
          <button onClick={cancelarEdicao} className="btn-nova-comissao">+ Nova Comissão</button>
          {comissoes.map((c) => (
            <div key={c.id} className="item-comissao">
              <span onClick={() => editarComissao(c)}>{c.nome}</span>
              <button onClick={() => excluirComissao(c.id)}>×</button>
            </div>
          ))}
        </div>

        <div className="form-comissao">
          {editando && (
            <div className="abas">
              <button onClick={() => setAba("dados")}>Dados</button>
              <button onClick={() => setAba("membros")}>Membros</button>
              <button onClick={() => setAba("atas")}>Atas</button>
              <button onClick={() => setAba("pareceres")}>Pareceres</button>
            </div>
          )}

          {aba === "dados" && (
            <form onSubmit={(e) => { e.preventDefault(); salvarComissao(); }}>
              <h2>{editando ? "Editar Comissão" : "Nova Comissão"}</h2>
              <input placeholder="Nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
              <textarea placeholder="Descrição" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
              <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
                <option>Permanente</option><option>Temporária</option><option>Especial</option><option>CPI</option>
              </select>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option>Ativa</option><option>Inativa</option><option>Extinta</option>
              </select>
              <input type="date" value={form.dataCriacao} onChange={(e) => setForm({ ...form, dataCriacao: e.target.value })} />
              <input type="date" value={form.dataExtincao} onChange={(e) => setForm({ ...form, dataExtincao: e.target.value })} />
              <button type="submit">{editando ? "Atualizar" : "Salvar"}</button>
            </form>
          )}

          {aba === "membros" && (
            <div>
              <h3>Adicionar Membro</h3>
              <select value={novoMembro.id} onChange={(e) => setNovoMembro({ ...novoMembro, id: e.target.value })}>
                <option value="">Selecione parlamentar</option>
                {parlamentares.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
              <select value={novoMembro.funcao} onChange={(e) => setNovoMembro({ ...novoMembro, funcao: e.target.value })}>
                <option value="">Função</option>
                <option>Presidente</option><option>Vice-Presidente</option><option>Relator</option><option>Membro Efetivo</option><option>Suplente</option><option>Secretário</option>
              </select>
              <button onClick={adicionarMembro}>Adicionar</button>
              <ul>
                {membros.map((m, i) => (
                  <li key={i}>{m.nome} - {m.funcao}</li>
                ))}
              </ul>
            </div>
          )}

          {aba === "atas" && (
            <div>
              <h3>Nova Ata</h3>
              <input placeholder="Título" value={novaAta.titulo} onChange={(e) => setNovaAta({ ...novaAta, titulo: e.target.value })} />
              <input type="date" value={novaAta.data} onChange={(e) => setNovaAta({ ...novaAta, data: e.target.value })} />
              <input type="file" accept="application/pdf" onChange={(e) => setNovaAta({ ...novaAta, pdf: e.target.files[0] })} />
              <button onClick={() => adicionarArquivo("ata")}>Salvar Ata</button>
              <ul>{atas.map((a, i) => <li key={i}>{a.titulo} ({a.data})</li>)}</ul>
            </div>
          )}

          {aba === "pareceres" && (
            <div>
              <h3>Novo Parecer</h3>
              <input placeholder="Título" value={novoParecer.titulo} onChange={(e) => setNovoParecer({ ...novoParecer, titulo: e.target.value })} />
              <input type="date" value={novoParecer.data} onChange={(e) => setNovoParecer({ ...novoParecer, data: e.target.value })} />
              <input type="file" accept="application/pdf" onChange={(e) => setNovoParecer({ ...novoParecer, pdf: e.target.files[0] })} />
              <button onClick={() => adicionarArquivo("parecer")}>Salvar Parecer</button>
              <ul>{pareceres.map((p, i) => <li key={i}>{p.titulo} ({p.data})</li>)}</ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
