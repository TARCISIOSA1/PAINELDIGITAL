import React, { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
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
  });

  const [fotoFile, setFotoFile] = useState(null);
  const [parlamentares, setParlamentares] = useState([]);
  const [filtroNome, setFiltroNome] = useState("");
  const [filtroPartido, setFiltroPartido] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");

  // PAGINAÇÃO
  const [pagina, setPagina] = useState(0);
  const porPagina = 6;

  useEffect(() => {
    carregarParlamentares();
    carregarUsuarios();
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
      }));
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleUploadFoto = async () => {
    if (!fotoFile) return form.foto;
    const storageRef = ref(storage, `fotosParlamentares/${Date.now()}-${fotoFile.name}`);
    await uploadBytes(storageRef, fotoFile);
    return await getDownloadURL(storageRef);
  };

  const salvarParlamentar = async () => {
    const urlFoto = await handleUploadFoto();
    const dados = { ...form, foto: urlFoto };

    if (editandoId) {
      await updateDoc(doc(db, "parlamentares", editandoId), dados);
      alert("Parlamentar atualizado!");
      setEditandoId(null);
    } else {
      await addDoc(collection(db, "parlamentares"), dados);
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
    });
    setFotoFile(null);
    setUsuarioSelecionado("");
    carregarParlamentares();
    setPagina(0); // Volta pra primeira página ao cadastrar novo
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
    const doc = new jsPDF();
    doc.text("Relatório de Parlamentares Filtrados", 14, 15);

    const filtrados = parlamentares.filter((p) =>
      p.nome.toLowerCase().includes(filtroNome.toLowerCase()) &&
      p.partido.toLowerCase().includes(filtroPartido.toLowerCase()) &&
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

    autoTable(doc, {
      startY: 25,
      head: [["Foto", "Nome", "Número", "Partido", "Votos", "Status", "Biografia"]],
      body: dadosTabela,
      didDrawCell: async (data) => {
        if (data.column.index === 0 && data.cell.raw) {
          doc.addImage(data.cell.raw, "JPEG", data.cell.x + 1, data.cell.y + 1, 10, 10);
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

    doc.save("parlamentares-filtrados.pdf");
  };

  // ---- NOVO: filtragem + paginação real ----
  const filtrados = parlamentares
    .filter((p) =>
      p.nome?.toLowerCase().includes(filtroNome.toLowerCase()) &&
      p.partido?.toLowerCase().includes(filtroPartido.toLowerCase()) &&
      (filtroStatus === "" || p.status === filtroStatus)
    );
  const totalPaginas = Math.ceil(filtrados.length / porPagina);
  const listaPaginada = filtrados.slice(pagina * porPagina, (pagina + 1) * porPagina);

  // Se excluir e página fica vazia, volta uma página
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

        <input name="nome" placeholder="Nome" value={form.nome} onChange={handleChange} />
        <input name="numero" placeholder="Número" value={form.numero} onChange={handleChange} />
        <input name="numeroPartido" placeholder="Número do Partido" value={form.numeroPartido} onChange={handleChange} />
        <input name="partido" placeholder="Sigla do Partido" value={form.partido} onChange={handleChange} />
        <input name="votos" placeholder="Votos" value={form.votos} onChange={handleChange} />
        <input name="telefone" placeholder="Telefone" value={form.telefone} onChange={handleChange} />
        <input name="email" placeholder="Email" value={form.email} onChange={handleChange} />
        <input name="sexo" placeholder="Sexo" value={form.sexo} onChange={handleChange} />

        <select name="tipoUsuario" value={form.tipoUsuario} onChange={handleChange}>
          <option value="Vereador">Vereador</option>
          <option value="Presidente">Presidente</option>
        </select>

        <select name="status" value={form.status} onChange={handleChange}>
          <option value="Ativo">Ativo</option>
          <option value="Inativo">Inativo</option>
        </select>

        <textarea name="biografia" placeholder="Biografia" value={form.biografia} onChange={handleChange} />

        <input type="file" onChange={(e) => setFotoFile(e.target.files[0])} />
        {fotoFile && <p>{fotoFile.name}</p>}

        <button onClick={salvarParlamentar}>Salvar</button>
        {editandoId && (
          <button style={{ backgroundColor: "#999" }} onClick={() => {
            setEditandoId(null);
            setForm({
              nome: "", numero: "", numeroPartido: "", partido: "", votos: "",
              telefone: "", email: "", sexo: "", tipoUsuario: "Vereador",
              status: "Ativo", biografia: "", foto: ""
            });
            setFotoFile(null);
            setUsuarioSelecionado("");
          }}>Cancelar Edição</button>
        )}
      </div>

      <h3>Usuários Cadastrados</h3>

      <div style={{ display: "flex", gap: "10px", marginBottom: "10px", flexWrap: "wrap" }}>
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
                    <div style={{
                      width: 50,
                      height: 50,
                      background: "#eee",
                      borderRadius: 10,
                      overflow: "hidden",
                      margin: "0 auto",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center"
                    }}>
                      {p.foto
                        ? <img src={p.foto} alt="Foto" style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            borderRadius: 10,
                          }} />
                        : <span style={{ color: "#aaa" }}>Sem foto</span>
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

      {/* PAGINAÇÃO */}
      {totalPaginas > 1 && (
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
      )}
    </div>
  );
}
