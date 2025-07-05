import React, { useEffect, useState, useRef } from "react";
import { db, storage } from "../firebase";
import {
  collection,
  getDocs,
  updateDoc,
  doc,
  deleteDoc,
  addDoc,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

export default function ParlamentaresTabela() {
  const [parlamentares, setParlamentares] = useState([]);
  const [editando, setEditando] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [addModal, setAddModal] = useState(false);
  const [novo, setNovo] = useState({
    nome: "", partido: "", id: "", numero: "", votos: "", status: "Ativo", fotoFile: null, fotoUrl: ""
  });
  const [loading, setLoading] = useState(true);
  const [pagina, setPagina] = useState(0);
  const porPagina = 6;
  const fileInputRef = useRef();

  // Carrega parlamentares
  useEffect(() => {
    async function carregar() {
      setLoading(true);
      const snap = await getDocs(collection(db, "parlamentares"));
      const lista = snap.docs.map((doc) => ({
        ...doc.data(),
        docId: doc.id,
      }));
      setParlamentares(lista);
      setLoading(false);
    }
    carregar();
  }, [addModal, editando]);

  // Paginação
  const totalPaginas = Math.ceil(parlamentares.length / porPagina);
  const listaPaginada = parlamentares.slice(pagina * porPagina, (pagina + 1) * porPagina);

  // CRUD EDIÇÃO
  function startEdit(p) {
    setEditando(p.docId);
    setEditForm({
      nome: p.nome,
      numero: p.numero || "",
      votos: p.votos || "",
      partido: p.partido || "",
      status: p.status || "Ativo",
      fotoUrl: p.fotoUrl,
      fotoFile: null,
    });
  }
  function handleEditChange(e) {
    setEditForm((f) => ({
      ...f,
      [e.target.name]: e.target.value,
    }));
  }
  async function handleSalvarEditado() {
    try {
      let url = editForm.fotoUrl || "";
      if (editForm.fotoFile) {
        const storageRef = ref(storage, `parlamentares/${editando}.jpg`);
        await uploadBytes(storageRef, editForm.fotoFile);
        url = await getDownloadURL(storageRef);
      }
      await updateDoc(doc(db, "parlamentares", editando), {
        nome: editForm.nome,
        numero: editForm.numero,
        votos: parseInt(editForm.votos) || 0,
        partido: editForm.partido,
        status: editForm.status,
        fotoUrl: url,
      });
      setEditando(null);
    } catch (e) {
      alert("Erro ao salvar: " + e.message);
    }
  }
  function handleFotoEdit(e) {
    const file = e.target.files[0];
    if (file) {
      setEditForm((f) => ({
        ...f,
        fotoFile: file,
        fotoUrl: URL.createObjectURL(file),
      }));
    }
  }
  async function handleExcluir(docId) {
    if (window.confirm("Excluir este parlamentar?")) {
      await deleteDoc(doc(db, "parlamentares", docId));
      setParlamentares((lst) => lst.filter((p) => p.docId !== docId));
    }
  }

  // Cadastro novo parlamentar
  async function handleNovo(e) {
    e.preventDefault();
    if (!novo.nome || !novo.id) {
      alert("Preencha nome e ID!");
      return;
    }
    let fotoUrl = "";
    if (novo.fotoFile) {
      const storageRef = ref(storage, `parlamentares/${novo.id}.jpg`);
      await uploadBytes(storageRef, novo.fotoFile);
      fotoUrl = await getDownloadURL(storageRef);
    }
    await addDoc(collection(db, "parlamentares"), {
      nome: novo.nome,
      partido: novo.partido,
      id: novo.id,
      numero: novo.numero,
      votos: parseInt(novo.votos) || 0,
      status: novo.status,
      fotoUrl,
    });
    setAddModal(false);
    setNovo({
      nome: "", partido: "", id: "", numero: "", votos: "", status: "Ativo", fotoFile: null, fotoUrl: ""
    });
    setPagina(0); // Volta pra primeira página
  }

  // Responsivo: se excluir último da página, volta uma página
  useEffect(() => {
    if (pagina > 0 && listaPaginada.length === 0) setPagina(pagina - 1);
    // eslint-disable-next-line
  }, [parlamentares, pagina]);

  return (
    <div style={{
      maxWidth: 1200, margin: "30px auto", background: "#fff", borderRadius: 14,
      boxShadow: "0 4px 24px #0002", padding: 22, overflowX: "auto"
    }}>
      <h2 style={{ textAlign: "center", color: "#17335a", fontSize: 32 }}>Parlamentares</h2>
      <div style={{ textAlign: "right", margin: "8px 0" }}>
        <button
          style={{ background: "#17335a", color: "#fff", border: "none", borderRadius: 8, padding: "8px 22px", fontWeight: 600 }}
          onClick={() => setAddModal(true)}
        >
          + Novo Parlamentar
        </button>
      </div>
      {addModal && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "#0005",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999
        }}>
          <form
            onSubmit={handleNovo}
            style={{ background: "#fff", borderRadius: 14, boxShadow: "0 8px 32px #0003", padding: 34, minWidth: 320, maxWidth: 420 }}
          >
            <h3>Novo Parlamentar</h3>
            <div style={{ marginBottom: 12, display: "flex", justifyContent: "center" }}>
              <label style={{
                width: 110, height: 110, borderRadius: 12, border: "2px dashed #17335a",
                overflow: "hidden", background: "#eee", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center"
              }}>
                {novo.fotoFile ? (
                  <img
                    src={URL.createObjectURL(novo.fotoFile)}
                    alt="Preview"
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : (
                  <span style={{ color: "#aaa", fontSize: 30 }}>+</span>
                )}
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={e => setNovo(f => ({ ...f, fotoFile: e.target.files[0] }))}
                />
              </label>
            </div>
            <input
              name="nome"
              value={novo.nome}
              onChange={e => setNovo(f => ({ ...f, nome: e.target.value }))}
              placeholder="Nome Completo"
              style={{ marginBottom: 10, width: "100%", padding: 9, borderRadius: 7, border: "1px solid #bbb" }}
              required
            />
            <input
              name="id"
              value={novo.id}
              onChange={e => setNovo(f => ({ ...f, id: e.target.value }))}
              placeholder="ID"
              style={{ marginBottom: 10, width: "100%", padding: 9, borderRadius: 7, border: "1px solid #bbb" }}
              required
            />
            <input
              name="partido"
              value={novo.partido}
              onChange={e => setNovo(f => ({ ...f, partido: e.target.value }))}
              placeholder="Partido"
              style={{ marginBottom: 10, width: "100%", padding: 9, borderRadius: 7, border: "1px solid #bbb" }}
            />
            <input
              name="numero"
              value={novo.numero}
              onChange={e => setNovo(f => ({ ...f, numero: e.target.value }))}
              placeholder="Número"
              style={{ marginBottom: 10, width: "100%", padding: 9, borderRadius: 7, border: "1px solid #bbb" }}
            />
            <input
              name="votos"
              value={novo.votos}
              onChange={e => setNovo(f => ({ ...f, votos: e.target.value }))}
              placeholder="Votos"
              type="number"
              style={{ marginBottom: 10, width: "100%", padding: 9, borderRadius: 7, border: "1px solid #bbb" }}
            />
            <select
              name="status"
              value={novo.status}
              onChange={e => setNovo(f => ({ ...f, status: e.target.value }))}
              style={{ marginBottom: 18, width: "100%", padding: 9, borderRadius: 7, border: "1px solid #bbb" }}
            >
              <option value="Ativo">Ativo</option>
              <option value="Inativo">Inativo</option>
            </select>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button type="button" onClick={() => setAddModal(false)} style={{ background: "#bbb", color: "#333", border: "none", borderRadius: 7, padding: "8px 22px" }}>
                Cancelar
              </button>
              <button type="submit" style={{ background: "#17335a", color: "#fff", border: "none", borderRadius: 7, padding: "8px 22px" }}>
                Salvar
              </button>
            </div>
          </form>
        </div>
      )}

      <div style={{ overflowX: "auto" }}>
        <table style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: 17,
          minWidth: 900
        }}>
          <thead>
            <tr style={{ background: "#e7eefa" }}>
              <th style={th}>ID</th>
              <th style={th}>Foto</th>
              <th style={th}>Nome</th>
              <th style={th}>Número</th>
              <th style={th}>Votos</th>
              <th style={th}>Sigla Partido</th>
              <th style={th}>Status</th>
              <th style={th}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ textAlign: "center", padding: 30 }}>Carregando...</td></tr>
            ) : (
              listaPaginada.map((p) => (
                <tr key={p.docId} style={{ background: editando === p.docId ? "#f2f7fc" : "#fff" }}>
                  <td style={td}>{p.docId}</td>
                  <td style={td}>
                    <div style={{
                      width: 60, height: 60, borderRadius: 10, background: "#eee",
                      display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden",
                      border: "2px solid #17335a", margin: "0 auto"
                    }}>
                      {editando === p.docId ? (
                        <>
                          <label style={{
                            width: "100%", height: "100%", cursor: "pointer"
                          }}>
                            <img
                              src={editForm.fotoUrl || "https://via.placeholder.com/64?text=Sem+Foto"}
                              alt={editForm.nome}
                              style={{ width: "100%", height: "100%", objectFit: "cover" }}
                            />
                            <input
                              type="file"
                              accept="image/*"
                              style={{ display: "none" }}
                              onChange={handleFotoEdit}
                              ref={fileInputRef}
                            />
                          </label>
                        </>
                      ) : (
                        <img
                          src={p.fotoUrl || "https://via.placeholder.com/64?text=Sem+Foto"}
                          alt={p.nome}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      )}
                    </div>
                  </td>
                  <td style={td}>
                    {editando === p.docId ? (
                      <input value={editForm.nome} name="nome" onChange={handleEditChange}
                        style={inputEstilo} />
                    ) : p.nome}
                  </td>
                  <td style={td}>
                    {editando === p.docId ? (
                      <input value={editForm.numero} name="numero" onChange={handleEditChange}
                        style={inputEstilo} />
                    ) : p.numero || ""}
                  </td>
                  <td style={td}>
                    {editando === p.docId ? (
                      <input value={editForm.votos} name="votos" onChange={handleEditChange}
                        style={inputEstilo} type="number" min="0" />
                    ) : p.votos || ""}
                  </td>
                  <td style={td}>
                    {editando === p.docId ? (
                      <input value={editForm.partido} name="partido" onChange={handleEditChange}
                        style={inputEstilo} />
                    ) : p.partido}
                  </td>
                  <td style={td}>
                    {editando === p.docId ? (
                      <select name="status" value={editForm.status} onChange={handleEditChange} style={inputEstilo}>
                        <option value="Ativo">Ativo</option>
                        <option value="Inativo">Inativo</option>
                      </select>
                    ) : (
                      <span style={{
                        color: p.status === "Ativo" ? "#219a15" : "#c72525",
                        fontWeight: 700
                      }}>{p.status}</span>
                    )}
                  </td>
                  <td style={td}>
                    {editando === p.docId ? (
                      <>
                        <button onClick={handleSalvarEditado} style={btnSalvar}>Salvar</button>
                        <button onClick={() => setEditando(null)} style={btnCancelar}>Cancelar</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => startEdit(p)} style={btnEditar}>Editar</button>
                        <button onClick={() => handleExcluir(p.docId)} style={btnExcluir}>Excluir</button>
                      </>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {/* PAGINAÇÃO */}
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", margin: "24px 0" }}>
          <button
            disabled={pagina === 0}
            onClick={() => setPagina(pagina - 1)}
            style={{ padding: "8px 20px", marginRight: 20, background: "#17335a", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, opacity: pagina === 0 ? 0.5 : 1 }}
          >Anterior</button>
          <span style={{ fontWeight: 600, color: "#17335a" }}>
            Página {pagina + 1} de {totalPaginas}
          </span>
          <button
            disabled={pagina + 1 >= totalPaginas}
            onClick={() => setPagina(pagina + 1)}
            style={{ padding: "8px 20px", marginLeft: 20, background: "#17335a", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, opacity: (pagina + 1 >= totalPaginas) ? 0.5 : 1 }}
          >Próxima</button>
        </div>
      </div>
    </div>
  );
}

// --- ESTILOS
const th = {
  padding: "10px 7px",
  background: "#e3e8f6",
  color: "#17335a",
  fontWeight: 700,
  borderBottom: "2px solid #b5bddf",
};
const td = {
  padding: "7px 7px",
  textAlign: "center",
  borderBottom: "1.5px solid #f0f1f8",
  verticalAlign: "middle"
};
const inputEstilo = {
  width: "90%", padding: 7, borderRadius: 6, border: "1px solid #bbb", fontSize: 16,
};
const btnEditar = {
  background: "#2764cc", color: "#fff", border: "none", borderRadius: 7, padding: "5px 15px", marginRight: 7, cursor: "pointer"
};
const btnExcluir = {
  background: "#c72525", color: "#fff", border: "none", borderRadius: 7, padding: "5px 12px", cursor: "pointer"
};
const btnSalvar = {
  background: "#219a15", color: "#fff", border: "none", borderRadius: 7, padding: "5px 13px", marginRight: 7, cursor: "pointer"
};
const btnCancelar = {
  background: "#888", color: "#fff", border: "none", borderRadius: 7, padding: "5px 13px", cursor: "pointer"
};
