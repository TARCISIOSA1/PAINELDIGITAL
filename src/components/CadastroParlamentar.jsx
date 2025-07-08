// src/components/CadastroParlamentar.jsx
import React, { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  deleteDoc,
  doc,
  updateDoc,
  setDoc,
  writeBatch
} from "firebase/firestore";
import {
  ref,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";
import { db, storage } from "../firebase";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import "./CadastroParlamentar.css";

export default function CadastroParlamentar() {
  const [usuarios, setUsuarios] = useState([]);
  const [usuarioSelecionado, setUsuarioSelecionado] = useState("");
  const [editandoId, setEditandoId] = useState(null);

  const [form, setForm] = useState({
    nome: "",
    numero: "",
    numeroPartido: "",
    partido: "",
    votos: "",
    telefone: "",
    email: "",
    sexo: "",
    tipoUsuario: "Vereador",
    status: "Ativo",
    biografia: "",
    foto: "",
    uid: "", // <- ADICIONADO!
  });

  const [fotoFile, setFotoFile] = useState(null);
  const [parlamentares, setParlamentares] = useState([]);
  const [filtroNome, setFiltroNome] = useState("");
  const [filtroPartido, setFiltroPartido] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");
  const [pagina, setPagina] = useState(0);
  const porPagina = 6;

  useEffect(() => {
    carregarParlamentares();
    carregarUsuarios();
    // eslint-disable-next-line
  }, []);

  const carregarParlamentares = async () => {
    const snapshot = await getDocs(collection(db, "parlamentares"));
    const lista = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    setParlamentares(lista);
  };

  const carregarUsuarios = async () => {
    const snapshot = await getDocs(collection(db, "usuarios"));
    const lista = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    setUsuarios(lista);
  };

  // Quando selecionar um usuário, puxa os dados e o UID
  const preencherCamposDoUsuario = (id) => {
    setUsuarioSelecionado(id);
    const user = usuarios.find((u) => u.id === id);
    if (user) {
      setForm((prev) => ({
        ...prev,
        nome: user.nome || "",
        email: user.email || "",
        telefone: user.telefone || "",
        numero: user.numero || "",
        partido: user.partido || "",
        numeroPartido: user.numeroPartido || "",
        sexo: user.sexo || "",
        tipoUsuario: user.tipoUsuario || "Vereador",
        votos: user.votos || "",
        foto: user.foto || "",
        uid: user.uid || "", // <- ESSENCIAL: Salva UID!
      }));
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

const handleUploadFoto = async () => {
  try {
    console.log("Tentando upload, fotoFile:", fotoFile);
    if (!fotoFile) return form.foto;
    const storageRef = ref(storage, `fotosParlamentares/${Date.now()}-${fotoFile.name}`);
    const uploadResult = await uploadBytes(storageRef, fotoFile);
    console.log("Upload feito:", uploadResult);
    const url = await getDownloadURL(storageRef);
    console.log("URL getDownloadURL:", url);
    return url;
  } catch (e) {
    console.error("ERRO NO UPLOAD FOTO:", e);
    alert("Erro ao fazer upload da foto: " + e.message);
    return form.foto;
  }
};

const salvarParlamentar = async () => {
  try {
    console.log("Iniciando SALVAR PARLAMENTAR", { fotoFile, form });
    const urlFoto = await handleUploadFoto();
    console.log("URL da foto gerada/uploadada:", urlFoto);
    const dados = { ...form, foto: urlFoto };

    if (!usuarioSelecionado || !dados.uid) {
      alert("Selecione um usuário para vincular o UID do parlamentar!");
      return;
    }

   if (editandoId) {
  await setDoc(doc(db, "parlamentares", editandoId), dados, { merge: true });
  alert("Parlamentar salvo/atualizado!");
  setEditandoId(null);
} else {
  await setDoc(doc(db, "parlamentares", usuarioSelecionado), dados, { merge: true });
  alert("Parlamentar salvo!");
}


    setForm({
      nome: "",
      numero: "",
      numeroPartido: "",
      partido: "",
      votos: "",
      telefone: "",
      email: "",
      sexo: "",
      tipoUsuario: "Vereador",
      status: "Ativo",
      biografia: "",
      foto: "",
      uid: "",
    });
    setFotoFile(null);
    setUsuarioSelecionado("");
    carregarParlamentares();
    setPagina(0);
  } catch (e) {
    console.error("ERRO AO SALVAR:", e);
    alert("Erro ao salvar parlamentar: " + e.message);
  }
};


  const excluirParlamentar = async (id) => {
    if (window.confirm("Deseja realmente excluir este parlamentar?")) {
      await deleteDoc(doc(db, "parlamentares", id));
      carregarParlamentares();
    }
  };

  const editarParlamentar = (p) => {
    setForm({ ...p });
    setEditandoId(p.id);
    setUsuarioSelecionado(p.id);
  };

  const carregarImagemBase64 = (url) => {
    return new Promise((resolve) => {
      if (!url) return resolve(null);
      const img = new Image();
      img.crossOrigin = "Anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/jpeg"));
      };
      img.onerror = () => resolve(null);
      img.src = url;
    });
  };

  const gerarPDF = async () => {
    const docPDF = new jsPDF();
    docPDF.text("Relatório de Parlamentares Filtrados", 14, 15);

    const filtrados = parlamentares.filter((p) =>
      p.nome?.toLowerCase().includes(filtroNome.toLowerCase()) &&
      p.partido?.toLowerCase().includes(filtroPartido.toLowerCase()) &&
      (filtroStatus === "" || p.status === filtroStatus)
    );

    const dadosTabela = [];
    for (let i = 0; i < filtrados.length; i++) {
      const p = filtrados[i];
      const imgBase64 = await carregarImagemBase64(p.foto);
      dadosTabela.push([
        imgBase64,
        p.nome || "-",
        p.numero || "-",
        p.partido || "-",
        p.votos || "-",
        p.status || "-",
        p.biografia || "-",
      ]);
    }

    autoTable(docPDF, {
      startY: 25,
      head: [["Foto", "Nome", "Número", "Partido", "Votos", "Status", "Biografia"]],
      body: dadosTabela,
      didDrawCell: async (data) => {
        if (data.column.index === 0 && data.cell.raw) {
          docPDF.addImage(data.cell.raw, "JPEG", data.cell.x + 1, data.cell.y + 1, 10, 10);
        }
      },
      columnStyles: {
        0: { cellWidth: 12 },
        1: { cellWidth: 40 },
        2: { cellWidth: 20 },
        3: { cellWidth: 20 },
        4: { cellWidth: 20 },
        5: { cellWidth: 20 },
        6: { cellWidth: 60 },
      },
    });

    docPDF.save("parlamentares-filtrados.pdf");
  };

  // ======= MIGRAÇÃO: ATUALIZAR ID DE PARLAMENTARES PARA SER IGUAL AO DO USUÁRIO ==========
  // ATENÇÃO: Isso é para uso opcional, para arrumar parlamentares antigos.
  // O botão chama essa função e move todos para ID igual ao do usuário.
  const migrarParlamentaresParaIdUsuario = async () => {
    const snapParlamentares = await getDocs(collection(db, "parlamentares"));
    const snapUsuarios = await getDocs(collection(db, "usuarios"));
    const usuarios = snapUsuarios.docs.map(u => ({ id: u.id, ...u.data() }));

    const batch = writeBatch(db);
    let migrados = 0;
    for (let d of snapParlamentares.docs) {
      const parlamentar = d.data();
      // Tenta achar usuário correspondente por email OU por uid OU por nome
      const usuario = usuarios.find(
        u =>
          (parlamentar.uid && (u.uid === parlamentar.uid || u.id === parlamentar.uid)) ||
          (parlamentar.email && u.email === parlamentar.email) ||
          (parlamentar.nome && u.nome === parlamentar.nome)
      );
      if (usuario && d.id !== usuario.id) {
        // Cria parlamentar com ID igual ao usuário
        batch.set(doc(db, "parlamentares", usuario.id), { ...parlamentar, uid: usuario.uid });
        // Apaga o antigo
        batch.delete(doc(db, "parlamentares", d.id));
        migrados++;
      }
    }
    if (migrados > 0) {
      await batch.commit();
      alert(`${migrados} parlamentares migrados para ID igual ao do usuário!`);
      carregarParlamentares();
    } else {
      alert("Nenhum parlamentar para migrar ou já está tudo certo.");
    }
  };
  // ===============================================================================

  // PAGINAÇÃO
  const filtrados = parlamentares
    .filter((p) =>
      p.nome?.toLowerCase().includes(filtroNome.toLowerCase()) &&
      p.partido?.toLowerCase().includes(filtroPartido.toLowerCase()) &&
      (filtroStatus === "" || p.status === filtroStatus)
    );
  const totalPaginas = Math.ceil(filtrados.length / porPagina);
  const listaPaginada = filtrados.slice(pagina * porPagina, (pagina + 1) * porPagina);

  useEffect(() => {
    if (pagina > 0 && listaPaginada.length === 0) setPagina(pagina - 1);
    // eslint-disable-next-line
  }, [filtrados.length, pagina]);

  return (
    <div className="cadastro-parlamentar">
      <h2>Cadastro de Parlamentar</h2>

      <div className="formulario">
        <label>Selecionar Usuário Cadastrado</label>
        <select value={usuarioSelecionado} onChange={(e) => preencherCamposDoUsuario(e.target.value)}>
          <option value="">-- Selecione --</option>
          {usuarios.map((u) => (
            <option key={u.id} value={u.id}>{u.nome}</option>
          ))}
        </select>

        <label>Nome</label>
        <input name="nome" placeholder="Nome" value={form.nome} onChange={handleChange} />

        <label>Número</label>
        <input name="numero" placeholder="Número" value={form.numero} onChange={handleChange} />

        <label>Número do Partido</label>
        <input name="numeroPartido" placeholder="Número do Partido" value={form.numeroPartido} onChange={handleChange} />

        <label>Sigla do Partido</label>
        <input name="partido" placeholder="Sigla do Partido" value={form.partido} onChange={handleChange} />

        <label>Votos</label>
        <input name="votos" placeholder="Votos" value={form.votos} onChange={handleChange} />

        <label>Telefone</label>
        <input name="telefone" placeholder="Telefone" value={form.telefone} onChange={handleChange} />

        <label>Email</label>
        <input name="email" placeholder="Email" value={form.email} onChange={handleChange} />

        <label>Sexo</label>
        <input name="sexo" placeholder="Sexo" value={form.sexo} onChange={handleChange} />

        <label>Tipo de Usuário</label>
        <select name="tipoUsuario" value={form.tipoUsuario} onChange={handleChange}>
          <option value="Vereador">Vereador</option>
          <option value="Presidente">Presidente</option>
        </select>

        <label>Status</label>
        <select name="status" value={form.status} onChange={handleChange}>
          <option value="Ativo">Ativo</option>
          <option value="Inativo">Inativo</option>
        </select>

        <label>Biografia</label>
        <textarea name="biografia" placeholder="Biografia" value={form.biografia} onChange={handleChange} />

        <label>Foto</label>
        <input
          type="file"
          accept="image/*"
          onChange={e => setFotoFile(e.target.files[0])}
        />
        <div className="foto-preview">
          {fotoFile
            ? (
              <img
                src={URL.createObjectURL(fotoFile)}
                alt="Preview"
              />
            )
            : form.foto
              ? (
                <img
                  src={form.foto}
                  alt="Foto"
                />
              )
              : <span>Sem foto</span>
          }
        </div>

        <button onClick={salvarParlamentar}>Salvar</button>
        {editandoId && (
          <button style={{ backgroundColor: "#999" }} onClick={() => {
            setEditandoId(null);
            setForm({
              nome: "", numero: "", numeroPartido: "", partido: "", votos: "",
              telefone: "", email: "", sexo: "", tipoUsuario: "Vereador",
              status: "Ativo", biografia: "", foto: "", uid: ""
            });
            setFotoFile(null);
            setUsuarioSelecionado("");
          }}>Cancelar Edição</button>
        )}
      </div>

      <h3>Usuários Cadastrados</h3>

      <div className="filtros">
        <input placeholder="Filtrar por nome" value={filtroNome} onChange={(e) => setFiltroNome(e.target.value)} />
        <input placeholder="Filtrar por partido" value={filtroPartido} onChange={(e) => setFiltroPartido(e.target.value)} />
        <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}>
          <option value="">Todos os Status</option>
          <option value="Ativo">Ativo</option>
          <option value="Inativo">Inativo</option>
        </select>
      </div>

      <button onClick={gerarPDF} style={{ marginBottom: 10 }}>Gerar PDF com Lista</button>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Foto</th>
              <th>Nome</th>
              <th>Número</th>
              <th>Votos</th>
              <th>Sigla Partido</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {listaPaginada.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: "center" }}>Nenhum parlamentar encontrado.</td>
              </tr>
            ) : (
              listaPaginada.map((p) => (
                <tr key={p.id}>
                  <td>{p.id}</td>
                  <td>
                    <div className="foto-tabela">
                      {p.foto
                        ? <img src={p.foto} alt="Foto" />
                        : <span>Sem foto</span>
                      }
                    </div>
                  </td>
                  <td>{p.nome}</td>
                  <td>{p.numero}</td>
                  <td>{p.votos}</td>
                  <td>{p.partido}</td>
                  <td>{p.status}</td>
                  <td>
                    <button onClick={() => editarParlamentar(p)}>Editar</button>
                    <button onClick={() => excluirParlamentar(p.id)}>Excluir</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPaginas > 1 && (
        <div className="paginacao">
          <button
            disabled={pagina === 0}
            onClick={() => setPagina(pagina - 1)}
          >Anterior</button>
          <span>
            Página {pagina + 1} de {totalPaginas}
          </span>
          <button
            disabled={pagina + 1 >= totalPaginas}
            onClick={() => setPagina(pagina + 1)}
          >Próxima</button>
        </div>
      )}
    </div>
  );
}
