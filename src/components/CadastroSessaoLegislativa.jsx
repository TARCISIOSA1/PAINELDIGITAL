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
import "./CadastroSessaoLegislativa.css";
import TopoInstitucional from "./TopoInstitucional"; // <<< topo institucional

// Função que define se a sessão está ativa pela data atual
const calcularStatusAtiva = (dataInicio, dataFim) => {
  if (!dataInicio || !dataFim) return "Inativa";
  const hoje = new Date();
  const inicio = new Date(dataInicio);
  const fim = new Date(dataFim);
  return hoje >= inicio && hoje <= fim ? "Ativa" : "Inativa";
};

export default function CadastroSessaoLegislativa() {
  const [sessoes, setSessoes] = useState([]);
  const [legislaturas, setLegislaturas] = useState([]);
  const [legislaturaId, setLegislaturaId] = useState("");
  const [numero, setNumero] = useState("");
  const [ano, setAno] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [editandoId, setEditandoId] = useState(null);

  const sessoesRef = collection(db, "sessoesLegislativas");
  const legislaturaRef = collection(db, "legislaturas");

  useEffect(() => {
    carregarSessoes();
    carregarLegislaturas();
  }, []);

  const carregarSessoes = async () => {
    const snapshot = await getDocs(sessoesRef);
    const lista = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    setSessoes(lista);
  };

  const carregarLegislaturas = async () => {
    const snapshot = await getDocs(legislaturaRef);
    const lista = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    setLegislaturas(lista);
  };

  const limparCampos = () => {
    setLegislaturaId("");
    setNumero("");
    setAno("");
    setDataInicio("");
    setDataFim("");
    setEditandoId(null);
  };

  // SALVAR com atualização de status automática
  const salvarSessao = async () => {
    if (!legislaturaId || !numero || !ano) {
      alert("Preencha todos os campos obrigatórios.");
      return;
    }

    // Antes de salvar, deixa todas as sessões dessa legislatura como inativas
    const snapshot = await getDocs(sessoesRef);
    for (const docItem of snapshot.docs) {
      const s = docItem.data();
      if (s.legislaturaId === legislaturaId) {
        await updateDoc(doc(db, "sessoesLegislativas", docItem.id), { status: "Inativa" });
      }
    }

    const status = calcularStatusAtiva(dataInicio, dataFim);

    const nova = {
      legislaturaId,
      numero,
      ano,
      dataInicio,
      dataFim,
      status,
    };

    if (editandoId) {
      await updateDoc(doc(db, "sessoesLegislativas", editandoId), nova);
    } else {
      await addDoc(sessoesRef, nova);
    }

    limparCampos();
    carregarSessoes();
  };

  const editarSessao = (sessao) => {
    setLegislaturaId(sessao.legislaturaId || "");
    setNumero(sessao.numero || "");
    setAno(sessao.ano || "");
    setDataInicio(sessao.dataInicio || "");
    setDataFim(sessao.dataFim || "");
    setEditandoId(sessao.id);
  };

  const excluirSessao = async (id) => {
    await deleteDoc(doc(db, "sessoesLegislativas", id));
    carregarSessoes();
  };

  // Busca a descrição da legislatura
  const getLegislaturaTexto = (id) => {
    const leg = legislaturas.find((l) => l.id === id);
    if (!leg) return "-";
    return `Legislatura ${leg.numero} (${leg.anoInicio} - ${leg.anoTermino})`;
  };

  const exportarPDF = () => {
    const docPDF = new jsPDF();
    docPDF.text("Relatório de Sessões Legislativas (Ano Legislativo)", 14, 15);
    autoTable(docPDF, {
      startY: 20,
      head: [
        [
          "ID",
          "Legislatura",
          "Número Sessão Legislativa",
          "Ano de Vigência",
          "Data Início",
          "Data Fim",
          "Status",
        ],
      ],
      body: sessoes.map((s) => [
        s.id,
        getLegislaturaTexto(s.legislaturaId),
        s.numero,
        s.ano,
        s.dataInicio || "-",
        s.dataFim || "-",
        s.status || "-",
      ]),
    });
    docPDF.save("sessoes_legislativas.pdf");
  };

  return (
    <div className="container-sessao">
      <TopoInstitucional />  {/* TOPO INSTITUCIONAL APARECE AQUI */}
      <h2>Cadastro de Sessão Legislativa (Ano Legislativo)</h2>

      <div className="form-sessao">
        <select
          value={legislaturaId}
          onChange={(e) => setLegislaturaId(e.target.value)}
        >
          <option value="">Selecione a Legislatura</option>
          {legislaturas.map((l) => (
            <option key={l.id} value={l.id}>
              Legislatura {l.numero} ({l.anoInicio} - {l.anoTermino})
            </option>
          ))}
        </select>
        <input
          value={numero}
          onChange={(e) => setNumero(e.target.value)}
          placeholder="Número da Sessão Legislativa (ex: 1, 2, 3, 4)"
          type="number"
        />
        <input
          value={ano}
          onChange={(e) => setAno(e.target.value)}
          placeholder="Ano de Vigência (ex: 2021)"
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
        <button onClick={salvarSessao}>
          {editandoId ? "Atualizar" : "Salvar"}
        </button>
        <button onClick={limparCampos}>Limpar</button>
        <button onClick={exportarPDF}>Exportar PDF</button>
      </div>

      <h3>Sessões Legislativas Cadastradas (Ano Legislativo)</h3>

      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Legislatura</th>
            <th>Número</th>
            <th>Ano de Vigência</th>
            <th>Data Início</th>
            <th>Data Fim</th>
            <th>Status</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {sessoes.map((s) => (
            <tr key={s.id}>
              <td>{s.id}</td>
              <td>{getLegislaturaTexto(s.legislaturaId)}</td>
              <td>{s.numero}ª Sessão Legislativa</td>
              <td>{s.ano}</td>
              <td>{s.dataInicio || "-"}</td>
              <td>{s.dataFim || "-"}</td>
              <td>
                <span
                  style={{
                    fontWeight: "bold",
                    color: s.status === "Ativa" ? "#19b354" : "#aaa",
                  }}
                >
                  {s.status || "-"}
                </span>
              </td>
              <td>
                <button onClick={() => editarSessao(s)}>Editar</button>
                <button onClick={() => excluirSessao(s.id)}>Excluir</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
