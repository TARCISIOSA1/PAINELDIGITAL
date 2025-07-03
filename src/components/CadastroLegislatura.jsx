import React, { useEffect, useState } from "react";
import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { db } from "../firebase";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import TopoInstitucional from "./TopoInstitucional"; // Importa o topo institucional
import "./CadastroLegislatura.css";

export default function CadastroLegislatura() {
  const [legislaturas, setLegislaturas] = useState([]);
  const [numero, setNumero] = useState("");
  const [anoInicio, setAnoInicio] = useState("");
  const [anoTermino, setAnoTermino] = useState("");
  const [descricao, setDescricao] = useState("");
  const [status, setStatus] = useState("Ativa");
  const [presidente, setPresidente] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [editandoId, setEditandoId] = useState(null);
  const [filtroStatus, setFiltroStatus] = useState("");
  const [filtroAno, setFiltroAno] = useState("");

  const legislaturaRef = collection(db, "legislaturas");

  useEffect(() => {
    carregarLegislaturas();
    // eslint-disable-next-line
  }, []);

  const carregarLegislaturas = async () => {
    const snapshot = await getDocs(legislaturaRef);
    const lista = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    setLegislaturas(lista);
  };

  const limparCampos = () => {
    setNumero("");
    setAnoInicio("");
    setAnoTermino("");
    setDescricao("");
    setStatus("Ativa");
    setPresidente("");
    setDataInicio("");
    setDataFim("");
    setEditandoId(null);
  };

  const salvarLegislatura = async () => {
    const nova = {
      numero,
      anoInicio,
      anoTermino,
      descricao,
      status,
      presidente,
      dataInicio,
      dataFim,
    };

    if (editandoId) {
      await updateDoc(doc(db, "legislaturas", editandoId), nova);
    } else {
      await addDoc(legislaturaRef, nova);
    }

    limparCampos();
    carregarLegislaturas();
  };

  const editarLegislatura = (leg) => {
    setNumero(leg.numero);
    setAnoInicio(leg.anoInicio);
    setAnoTermino(leg.anoTermino);
    setDescricao(leg.descricao);
    setStatus(leg.status);
    setPresidente(leg.presidente || "");
    setDataInicio(leg.dataInicio || "");
    setDataFim(leg.dataFim || "");
    setEditandoId(leg.id);
  };

  const excluirLegislatura = async (id) => {
    await deleteDoc(doc(db, "legislaturas", id));
    carregarLegislaturas();
  };

  const exportarPDF = () => {
    const docPDF = new jsPDF();
    docPDF.text("Relatório de Legislaturas", 14, 15);
    autoTable(docPDF, {
      startY: 20,
      head: [["ID", "Número", "Início", "Término", "Status", "Presidente", "Data Início", "Data Fim"]],
      body: legislaturas.map((l) => [
        l.id,
        l.numero,
        l.anoInicio,
        l.anoTermino,
        l.status,
        l.presidente,
        l.dataInicio || "-",
        l.dataFim || "-",
      ]),
    });
    docPDF.save("legislaturas.pdf");
  };

  return (
    <>
      <TopoInstitucional />
      <div className="container-legislatura" style={{ paddingTop: "100px" }}>
        <h2>Cadastro de Legislatura</h2>

        <div className="form-legislatura">
          <input
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
            placeholder="Número da Legislatura"
          />
          <input
            value={anoInicio}
            onChange={(e) => setAnoInicio(e.target.value)}
            placeholder="Ano de Início"
            type="number"
          />
          <input
            value={anoTermino}
            onChange={(e) => setAnoTermino(e.target.value)}
            placeholder="Ano de Término"
            type="number"
          />
          <input
            type="date"
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
            placeholder="Data de Início"
          />
          <input
            type="date"
            value={dataFim}
            onChange={(e) => setDataFim(e.target.value)}
            placeholder="Data de Fim"
          />
          <textarea
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Descrição"
          />
          <input
            value={presidente}
            onChange={(e) => setPresidente(e.target.value)}
            placeholder="Presidente da Câmara"
          />
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option>Ativa</option>
            <option>Encerrada</option>
          </select>
          <button onClick={salvarLegislatura}>
            {editandoId ? "Atualizar" : "Salvar"}
          </button>
          <button onClick={limparCampos}>Limpar</button>
          <button onClick={exportarPDF}>Exportar PDF</button>
        </div>

        <h3>Legislaturas Registradas</h3>

        <div style={{ marginBottom: "20px", display: "flex", gap: "10px" }}>
          <select onChange={(e) => setFiltroStatus(e.target.value)}>
            <option value="">Todos os Status</option>
            <option value="Ativa">Ativa</option>
            <option value="Encerrada">Encerrada</option>
          </select>

          <input
            type="number"
            placeholder="Filtrar por Ano de Início"
            onChange={(e) => setFiltroAno(e.target.value)}
          />
        </div>

        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Número</th>
              <th>Início</th>
              <th>Término</th>
              <th>Status</th>
              <th>Presidente</th>
              <th>Data Início</th>
              <th>Data Fim</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {legislaturas
              .filter(
                (l) =>
                  (!filtroStatus || l.status === filtroStatus) &&
                  (!filtroAno || String(l.anoInicio).includes(filtroAno))
              )
              .map((l) => (
                <tr key={l.id}>
                  <td>{l.id}</td>
                  <td>{l.numero}</td>
                  <td>{l.anoInicio}</td>
                  <td>{l.anoTermino}</td>
                  <td>{l.status}</td>
                  <td>{l.presidente}</td>
                  <td>{l.dataInicio || "-"}</td>
                  <td>{l.dataFim || "-"}</td>
                  <td>
                    <button onClick={() => editarLegislatura(l)}>Editar</button>
                    <button onClick={() => excluirLegislatura(l.id)}>Excluir</button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
