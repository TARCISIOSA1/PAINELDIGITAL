import React, { useState, useEffect } from "react";
import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  query,
  where,
} from "firebase/firestore";
import { db } from "../firebase";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import TopoInstitucional from "./TopoInstitucional";
import { FaTrash, FaEdit, FaLock, FaUserPlus } from "react-icons/fa";
import "./CadastroVereador.css";

function hashSenha(str) {
  let hash = 0, i, chr;
  for (i = 0; i < str.length; i++) {
    chr = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return hash.toString();
}

// FUNÇÃO PADRONIZADORA DE TIPO DE USUÁRIO (SEM acento, sempre igual no sistema)
function normalizaTipoUsuario(tipo) {
  if (!tipo) return "Vereador";
  const t = tipo.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  // Corrige variantes/acento do "Jurídico"
  if (t.toLowerCase().startsWith("jur")) return "Juridico";
  if (t === "Administrativo") return "Administrativo";
  if (t === "Presidente") return "Presidente";
  if (t === "MasterAdm") return "MasterAdm";
  return "Vereador";
}

export default function CadastroUsuario() {
  const [formData, setFormData] = useState({
    nome: "",
    email: "",
    senha: "",
    tipoUsuario: "Vereador",
  });
  const [usuarios, setUsuarios] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [inputKey, setInputKey] = useState(Date.now());

  useEffect(() => {
    carregarUsuarios();
  }, []);

  const carregarUsuarios = async () => {
    const querySnapshot = await getDocs(collection(db, "usuarios"));
    const lista = querySnapshot.docs
      .map((doc) => ({
        id: doc.id,
        ...doc.data(),
        tipoUsuario: normalizaTipoUsuario(doc.data().tipoUsuario),
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome));
    setUsuarios(lista);
  };

  const limparFormulario = () => {
    setFormData({
      nome: "",
      email: "",
      senha: "",
      tipoUsuario: "Vereador",
    });
    setEditingId(null);
    setInputKey(Date.now());
  };

  const handleSalvar = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!editingId) {
        const qEmail = query(
          collection(db, "usuarios"),
          where("email", "==", formData.email)
        );
        const existingEmail = await getDocs(qEmail);

        if (!formData.email) throw new Error("E-mail obrigatório.");
        if (!formData.senha) throw new Error("Senha obrigatória.");
        if (!formData.nome) throw new Error("Nome obrigatório.");

        if (!existingEmail.empty) {
          alert("E-mail já cadastrado!");
          setLoading(false);
          return;
        }
      }

      let uid = null;
      if (!editingId) {
        try {
          const auth = getAuth();
          const cred = await createUserWithEmailAndPassword(
            auth,
            formData.email,
            formData.senha
          );
          uid = cred.user.uid;
        } catch (authErr) {
          if (authErr.code === "auth/email-already-in-use") {
            alert("E-mail já cadastrado no Auth. Use outro e-mail.");
          } else {
            alert("Erro no cadastro Auth: " + authErr.message);
          }
          setLoading(false);
          return;
        }
      }

      // GARANTE tipoUsuario SEM acento, igual nas permissões:
      const tipoUsuarioFinal = normalizaTipoUsuario(formData.tipoUsuario);

      const docData = {
        nome: formData.nome,
        email: formData.email,
        senha: hashSenha(formData.senha),
        tipoUsuario: tipoUsuarioFinal,
        bloqueado: false,
      };
      if (uid) docData.uid = uid;

      if (editingId) {
        const docRef = doc(db, "usuarios", editingId);
        await updateDoc(docRef, docData);
        alert("Atualizado com sucesso!");
      } else {
        await addDoc(collection(db, "usuarios"), docData);
        alert("Cadastrado com sucesso!");
      }

      await carregarUsuarios();
      limparFormulario();
    } catch (error) {
      alert("Erro ao salvar. " + error.message);
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleEditar = (v) => {
    setFormData({
      nome: v.nome || "",
      email: v.email || "",
      senha: "",
      tipoUsuario: v.tipoUsuario || "Vereador",
    });
    setEditingId(v.id);
    setInputKey(Date.now());
  };

  const handleExcluir = async (id) => {
    if (window.confirm("Tem certeza que deseja excluir este usuário?")) {
      await deleteDoc(doc(db, "usuarios", id));
      await carregarUsuarios();
    }
  };

  const handleBloquear = async (id, bloqueado) => {
    const docRef = doc(db, "usuarios", id);
    await updateDoc(docRef, { bloqueado: !bloqueado });
    await carregarUsuarios();
  };

  return (
    <div className="cadastro-container">
      <TopoInstitucional />
      <h2 className="sistema-nome">Cadastro de Usuários</h2>

      <form className="form-cadastro" onSubmit={handleSalvar} autoComplete="off">
        <div className="form-inputs" style={{ display: "flex", gap: 10 }}>
          <input
            key={inputKey + "_nome"}
            type="text"
            placeholder="Nome completo"
            value={formData.nome}
            onChange={(e) =>
              setFormData({ ...formData, nome: e.target.value })
            }
            required
            autoComplete="off"
          />
          <input
            key={inputKey + "_email"}
            type="email"
            placeholder="Email"
            value={formData.email}
            onChange={(e) =>
              setFormData({ ...formData, email: e.target.value })
            }
            required
            autoComplete="off"
          />
          <input
            key={inputKey + "_senha"}
            type="password"
            placeholder={editingId ? "Nova senha (opcional)" : "Senha"}
            value={formData.senha}
            onChange={(e) =>
              setFormData({ ...formData, senha: e.target.value })
            }
            required={!editingId}
            autoComplete="new-password"
          />
          <select
            key={inputKey + "_tipo"}
            value={formData.tipoUsuario}
            onChange={(e) =>
              setFormData({ ...formData, tipoUsuario: e.target.value })
            }
            required
          >
            <option value="Vereador">Vereador</option>
            <option value="Administrativo">Administrativo</option>
            <option value="Juridico">Juridico</option>
            <option value="Presidente">Presidente</option>
            <option value="MasterAdm">MasterAdm</option>
          </select>
          <button
            type="button"
            onClick={limparFormulario}
            className="novo-btn"
            style={{
              background: "#2563eb",
              color: "#fff",
              border: "none",
              padding: "10px 16px",
              borderRadius: 6,
              fontWeight: "bold",
              display: "flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            <FaUserPlus /> Novo Usuário
          </button>
          <button
            type="submit"
            className="salvar-btn"
            style={{
              background: "#22c55e",
              color: "#fff",
              border: "none",
              padding: "10px 16px",
              borderRadius: 6,
              fontWeight: "bold",
            }}
            disabled={loading}
          >
            {loading
              ? "Salvando..."
              : editingId
              ? "Salvar Alterações"
              : "Salvar"}
          </button>
        </div>
      </form>

      <h3>Usuários Cadastrados</h3>
      <div className="tabela-container">
        <table className="tabela-usuarios">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Email</th>
              <th>Tipo</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((v) => (
              <tr key={v.id}>
                <td>{v.nome}</td>
                <td>{v.email}</td>
                <td>{v.tipoUsuario}</td>
                <td>{v.bloqueado ? "Bloqueado" : "Ativo"}</td>
                <td>
                  <button
                    className="action-btn editar"
                    onClick={() => handleEditar(v)}
                    title="Editar"
                  >
                    <FaEdit />
                  </button>
                  <button
                    className="action-btn excluir"
                    onClick={() => handleExcluir(v.id)}
                    title="Excluir"
                  >
                    <FaTrash />
                  </button>
                  <button
                    className="action-btn bloquear"
                    onClick={() => handleBloquear(v.id, v.bloqueado)}
                    title={v.bloqueado ? "Desbloquear" : "Bloquear"}
                  >
                    <FaLock />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
