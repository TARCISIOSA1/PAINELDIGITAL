import React, { useState, useEffect, useRef } from "react";
import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  setDoc,
} from "firebase/firestore";
import { db, storage } from "../firebase";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { FaTrash, FaEdit } from "react-icons/fa";
import panelConfig from "../config/panelConfig.json";
import "./CadastroProjeto.css";

const MODALIDADES_VOTACAO = [
  "Única",
  "Primeira votação",
  "Segunda votação",
  "Votação secreta",
  "Nominal",
  "Destaque",
  "Escrutínio",
];

const TIPOS_PROJETO = [
  "Projeto de Lei Ordinária",
  "Projeto de Lei Complementar",
  "Projeto de Resolução",
  "Projeto de Decreto Legislativo",
  "Projeto de Emenda à Lei Orgânica",
  "Requerimento",
  "Moção",
  "Emenda",
];

const TEMAS = [
  "Plano Plurianual – PPA",
  "Lei de Diretrizes Orçamentárias – LDO",
  "Lei Orçamentária Anual – LOA",
  "Legislação de Pessoal",
  "Legislação de Diárias",
  "Código Municipal de Saúde",
  "Código Municipal de Meio Ambiente",
  "Código Sanitário",
  "Código de Obras",
  "Código de Posturas",
  "Código Tributário",
  "Plano Diretor",
  "Estatuto do Servidor Público",
  "ISSQN (ISS)",
  "Código de Ética da Câmara",
  "Nenhum dos temas abaixo",
];

const TIPOS_2_VOTACOES = [
  "Projeto de Lei Complementar",
  "Projeto de Emenda à Lei Orgânica",
];

const STATUS_TRAMITE = [
  "Em análise",
  "Em comissão",
  "Em jurídico",
  "Em pauta",
  "Primeira votação",
  "Segunda votação",
  "Em votação",
  "Votada",
];

// STATUS QUE PODEM SER ADITADOS MANUALMENTE
const STATUS_MANUAL = [
  "Arquivada",
  "Retirada de Pauta",
  "Promulgada / Sancionada",
  "Transformada em Lei",
  "Veto Total",
  "Veto Parcial"
];

export default function CadastroProjeto() {
  // Formulário
  const [tipoProjeto, setTipoProjeto] = useState("");
  const [tema, setTema] = useState("");
  const [modalidadeVotacao, setModalidadeVotacao] = useState("");
  const [numeroProjeto, setNumeroProjeto] = useState("");
  const [identificacaoProjeto, setIdentificacaoProjeto] = useState("");
  const [titulo, setTitulo] = useState("");
  const [autor, setAutor] = useState("");
  const [descricao, setDescricao] = useState("");
  const [data, setData] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfName, setPdfName] = useState("");
  const pdfInputRef = useRef();

  // Para comissão
  const [comissoes, setComissoes] = useState([]);
  const [comissaoSelecionada, setComissaoSelecionada] = useState("");
  const [idMateriaComissao, setIdMateriaComissao] = useState(null);

  // Listas
  const [materias, setMaterias] = useState([]);
  const [busca, setBusca] = useState("");

  // ADITAR STATUS MANUAL
  const [modalAditarId, setModalAditarId] = useState(null);
  const [novoStatusAditado, setNovoStatusAditado] = useState("");
  const [novaJustificativaAditado, setNovaJustificativaAditado] = useState("");

  useEffect(() => {
    carregarMaterias();
  }, []);

  useEffect(() => {
    async function carregarComissoes() {
      const snap = await getDocs(collection(db, "comissoes"));
      setComissoes(snap.docs.map(doc => ({ id: doc.id, nome: doc.data().nome })));
    }
    carregarComissoes();
  }, []);

  async function carregarMaterias() {
    try {
      const querySnapshot = await getDocs(collection(db, "materias"));
      const lista = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setMaterias(lista);
    } catch (error) {
      console.error("Erro ao carregar matérias:", error);
    }
  }

  const handleSalvar = async (e) => {
    e.preventDefault();
    if (!tipoProjeto) return alert("Selecione o tipo de projeto!");
    if (!tema) return alert("Selecione o tema!");
    if (!modalidadeVotacao) return alert("Selecione a modalidade de votação!");
    if (tipoProjeto !== "Emenda" && !numeroProjeto.trim())
      return alert("Preencha o número do projeto!");
    if (tipoProjeto === "Emenda" && !identificacaoProjeto.trim())
      return alert("Preencha a identificação do projeto para a emenda!");
    if (!titulo.trim() || !autor.trim() || !descricao.trim() || !data)
      return alert("Preencha todos os campos obrigatórios!");

    // Upload do PDF (se houver)
    let pdfUrl = "";
    if (pdfFile) {
      const pdfStorageRef = storageRef(
        storage,
        `materias/${Date.now()}_${pdfFile.name}`
      );
      const snapshot = await uploadBytes(pdfStorageRef, pdfFile);
      pdfUrl = await getDownloadURL(snapshot.ref);
    }

    const docData = {
      tipoProjeto,
      tema,
      modalidadeVotacao,
      numeroProjeto: tipoProjeto !== "Emenda" ? numeroProjeto : "",
      identificacaoProjeto: tipoProjeto === "Emenda" ? identificacaoProjeto : "",
      titulo,
      autor,
      descricao,
      data,
      status: "Em análise",
      intersticioQuebrado: false,
      intersticioData: null,
      intersticioUsuario: null,
      pdfUrl: pdfUrl || "",
      pdfName: pdfFile ? pdfFile.name : "",
      comissaoFinalizada: false,
      comissaoDestino: "",
      parecerComissao: ""
    };

    try {
      if (editingId) {
        await setDoc(doc(db, "materias", editingId), docData);
      } else {
        await addDoc(collection(db, "materias"), docData);
      }
      limparCampos();
      await carregarMaterias();
    } catch (error) {
      console.error("Erro ao salvar:", error);
      alert("Erro ao salvar. Veja o console.");
    }
  };

  function limparCampos() {
    setTipoProjeto("");
    setTema("");
    setModalidadeVotacao("");
    setNumeroProjeto("");
    setIdentificacaoProjeto("");
    setTitulo("");
    setAutor("");
    setDescricao("");
    setData("");
    setEditingId(null);
    setPdfFile(null);
    setPdfName("");
    if (pdfInputRef.current) pdfInputRef.current.value = "";
  }

  // EDITAR
  const handleEditar = (materia) => {
    setTipoProjeto(materia.tipoProjeto);
    setTema(materia.tema);
    setModalidadeVotacao(materia.modalidadeVotacao || "");
    setNumeroProjeto(materia.numeroProjeto || "");
    setIdentificacaoProjeto(materia.identificacaoProjeto || "");
    setTitulo(materia.titulo);
    setAutor(materia.autor || "");
    setDescricao(materia.descricao);
    setData(materia.data);
    setEditingId(materia.id);
    setPdfFile(null);
    setPdfName(materia.pdfName || "");
    if (pdfInputRef.current) pdfInputRef.current.value = "";
  };

  // EXCLUIR
  const handleExcluir = async (id) => {
    if (window.confirm("Deseja realmente excluir esta matéria?")) {
      await deleteDoc(doc(db, "materias", id));
      await carregarMaterias();
    }
  };

  // ATUALIZA STATUS e status de comissão
  async function atualizarStatus(materia, novoStatus, extra = {}) {
    // Só pode mandar para comissão se não tiver sido finalizada na comissão!
    if (
      STATUS_TRAMITE.indexOf(materia.status) >= STATUS_TRAMITE.indexOf("Em pauta") &&
      novoStatus !== "Primeira votação" &&
      novoStatus !== "Segunda votação"
    ) {
      alert("Matéria já em pauta. Só pode ser alterada pelo painel de votação.");
      return;
    }
    const update = {
      ...materia,
      status: novoStatus,
      ...extra,
    };

    // Se finalizando a comissão, deixa registrado!
    if (novoStatus === "Ativa") {
      update.comissaoFinalizada = true;
    }
    await setDoc(doc(db, "materias", materia.id), update);
    await carregarMaterias();
  }

  // ADITAR STATUS MANUAL
  async function salvarStatusAditado(materia) {
    const update = {
      ...materia,
      statusAditado: novoStatusAditado,
      justificativaAditado: novaJustificativaAditado,
      dataAditado: new Date().toISOString()
    };
    await setDoc(doc(db, "materias", materia.id), update);
    setModalAditarId(null);
    setNovoStatusAditado("");
    setNovaJustificativaAditado("");
    await carregarMaterias();
  }

  // BLOQUEIO DE EDIÇÃO/EXCLUSÃO
  const podeEditar = (mat) =>
    STATUS_TRAMITE.indexOf(mat.status) < STATUS_TRAMITE.indexOf("Em pauta");

  // FILTRO
  const materiasFiltradas = materias.filter(
    (m) =>
      (busca === "" ||
        (m.numeroProjeto || "").toString().includes(busca) ||
        (m.titulo || "").toLowerCase().includes(busca.toLowerCase()) ||
        (m.descricao || "").toLowerCase().includes(busca.toLowerCase()))
  );

  return (
    <div className="cadastroprojeto-container">
      {/* Topo institucional */}
      <div className="topo-institucional-geral centralizar-topo">
        <img
          src={panelConfig.logoPath}
          alt="Logo Câmara"
          className="logo-camara-institucional"
        />
        <div className="nomes-institucional">
          <div className="nome-camara-grande">{panelConfig.nomeCamara}</div>
        </div>
      </div>

      <form className="form-cadastroprojeto" onSubmit={handleSalvar}>
        {/* Primeira linha */}
        <div className="linha-campos">
          <div className="campo-form">
            <label>Tipo de Projeto*</label>
            <select
              value={tipoProjeto}
              onChange={e => {
                setTipoProjeto(e.target.value);
                setNumeroProjeto("");
                setIdentificacaoProjeto("");
              }}
              required
            >
              <option value="">Selecione...</option>
              {TIPOS_PROJETO.map((tipo) => (
                <option key={tipo} value={tipo}>
                  {tipo}
                </option>
              ))}
            </select>
          </div>
          <div className="campo-form">
            <label>Tema*</label>
            <select
              value={tema}
              onChange={e => setTema(e.target.value)}
              required
            >
              <option value="">Selecione o tema...</option>
              {TEMAS.map((tema) => (
                <option key={tema} value={tema}>
                  {tema}
                </option>
              ))}
            </select>
          </div>
        </div>
        {/* Segunda linha */}
        <div className="linha-campos">
          <div className="campo-form">
            <label>Modalidade de Votação*</label>
            <select
              value={modalidadeVotacao}
              onChange={e => setModalidadeVotacao(e.target.value)}
              required
            >
              <option value="">Selecione a modalidade...</option>
              {MODALIDADES_VOTACAO.map((mod) => (
                <option key={mod} value={mod}>
                  {mod}
                </option>
              ))}
            </select>
          </div>
          {/* CAMPO NÚMERO — universal, exceto para Emenda */}
          {tipoProjeto !== "Emenda" && (
            <div className="campo-form">
              <label>Número*</label>
              <input
                type="number"
                value={numeroProjeto}
                onChange={e => setNumeroProjeto(e.target.value)}
                required
              />
            </div>
          )}
          {tipoProjeto === "Emenda" && (
            <div className="campo-form">
              <label>Identificação do Projeto*</label>
              <input
                type="text"
                value={identificacaoProjeto}
                onChange={e => setIdentificacaoProjeto(e.target.value)}
                required
              />
            </div>
          )}
          <div className="campo-form">
            <label>Anexar PDF da matéria</label>
            <input
              type="file"
              accept="application/pdf"
              ref={pdfInputRef}
              onChange={e => {
                if (e.target.files[0]) {
                  setPdfFile(e.target.files[0]);
                  setPdfName(e.target.files[0].name);
                } else {
                  setPdfFile(null);
                  setPdfName("");
                }
              }}
            />
            {pdfName && (
              <div style={{ fontSize: 12, marginTop: 2, color: "#226" }}>
                {pdfName}
              </div>
            )}
          </div>
        </div>
        {/* Terceira linha */}
        <div className="linha-campos">
          <div className="campo-form">
            <label>Título*</label>
            <input
              type="text"
              value={titulo}
              onChange={e => setTitulo(e.target.value)}
              required
            />
          </div>
          <div className="campo-form">
            <label>Autor*</label>
            <input
              type="text"
              value={autor}
              onChange={e => setAutor(e.target.value)}
              required
            />
          </div>
        </div>
        {/* Quarta linha */}
        <div className="linha-campos">
          <div className="campo-form" style={{ flex: 2 }}>
            <label>Descrição*</label>
            <textarea
              value={descricao}
              onChange={e => setDescricao(e.target.value)}
              required
            />
          </div>
          <div className="campo-form" style={{ flex: 1 }}>
            <label>Data*</label>
            <input
              type="date"
              value={data}
              onChange={e => setData(e.target.value)}
              required
            />
          </div>
        </div>
        <div className="botoes-form">
          <button type="submit">{editingId ? "Atualizar" : "Salvar"}</button>
        </div>
      </form>

      {/* Filtro */}
      <div className="filtro-materias">
        <h3>Buscar Matérias</h3>
        <input
          type="text"
          placeholder="Buscar por número, título ou assunto"
          value={busca}
          onChange={e => setBusca(e.target.value)}
          style={{ maxWidth: 300 }}
        />
      </div>

      {/* TABELA DE MATÉRIAS */}
      <div className="table-materias-simples">
        <table>
          <thead>
            <tr>
              <th>Lote</th>
              <th>Identificação</th>
              <th>Matéria</th>
              <th>Modalidade</th>
              <th>Status</th>
              <th>Pareceres</th>
              <th>Parecer Comissão</th>
              <th>PDF</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {materiasFiltradas.map((m) => (
              <tr key={m.id}>
                <td>
                  {m.loteId ? m.loteId : "-"}
                </td>
                <td>
                  {m.tipoProjeto === "Requerimento" && m.numeroProjeto
                    ? `REQ-${String(m.numeroProjeto).padStart(3, "0")}/${m.data
                        ? m.data.split("-")[0]
                        : ""}`
                    : m.tipoProjeto === "Moção" && m.numeroProjeto
                    ? `MOÇ-${String(m.numeroProjeto).padStart(3, "0")}/${m.data
                        ? m.data.split("-")[0]
                        : ""}`
                    : m.tipoProjeto === "Emenda" && m.identificacaoProjeto
                    ? `EMD-${m.identificacaoProjeto}`
                    : m.tipoProjeto?.startsWith("Projeto de Lei")
                    ? `PL-${m.id.substring(0, 3).toUpperCase()}`
                    : m.tipoProjeto}
                </td>
                <td>
                  <b>
                    {m.tipoProjeto}{" "}
                    {m.numeroProjeto || m.identificacaoProjeto
                      ? m.numeroProjeto || m.identificacaoProjeto
                      : ""}
                  </b>
                  <div style={{ fontSize: 13, color: "#555", marginTop: 4 }}>
                    {m.titulo}
                  </div>
                  <div style={{ fontSize: 12, color: "#888" }}>
                    {m.descricao?.length > 80
                      ? m.descricao.substring(0, 80) + "..."
                      : m.descricao}
                  </div>
                </td>
                <td>
                  {m.modalidadeVotacao}
                </td>
                <td>
                  <span className={`status-materia status-${(m.status || "").replace(/\s/g, "-").toLowerCase()}`}>
                    {m.status}
                  </span>
                  {/* Mostra status manual se houver */}
                  {m.statusAditado && (
                    <div className="tag-status-aditado" style={{ color: "#b60", fontWeight: "bold" }}>
                      {m.statusAditado}
                      <span style={{ fontWeight: 400, fontSize: 11, color: "#666", display: "block" }}>
                        {m.justificativaAditado && "Motivo: " + m.justificativaAditado}
                      </span>
                      <span style={{ fontWeight: 400, fontSize: 11, color: "#999" }}>
                        {m.dataAditado && " em " + new Date(m.dataAditado).toLocaleString("pt-BR")}
                      </span>
                    </div>
                  )}
                  {m.intersticioQuebrado && (
                    <div className="tag-intersticio">
                      Interstício Quebrado
                      {m.intersticioData && (
                        <span style={{ display: "block", fontSize: 11 }}>
                          em {new Date(m.intersticioData).toLocaleString()}
                        </span>
                      )}
                    </div>
                  )}
                </td>
                <td>
                  {m.pareceres && m.pareceres.length > 0 ? (
                    m.pareceres.map((p, idx) => (
                      <div key={idx} style={{ fontSize: 13, color: "#254" }}>
                        <b>{p.tipo}</b>: {p.texto}
                      </div>
                    ))
                  ) : (
                    <span style={{ color: "#aaa" }}>Nenhum</span>
                  )}
                </td>
                {/* Parecer da Comissão */}
                <td>
                  {m.parecerComissao ? (
                    <span style={{ color: "#2a5" }}>{m.parecerComissao}</span>
                  ) : (
                    <span style={{ color: "#aaa" }}>-</span>
                  )}
                </td>
                {/* NOVA COLUNA PDF */}
                <td>
                  {m.pdfUrl ? (
                    <a href={m.pdfUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: "#1b3ab6" }}>
                      {m.pdfName ? m.pdfName : "Visualizar PDF"}
                    </a>
                  ) : (
                    <span style={{ color: "#aaa" }}>-</span>
                  )}
                </td>
                <td style={{ minWidth: 200, position: "relative" }}>
                  {podeEditar(m) && (
                    <>
                      <button
                        className="btn-tabela"
                        onClick={() => handleEditar(m)}
                        title="Editar"
                      >
                        <FaEdit size={14} />
                      </button>
                      <button
                        className="btn-tabela"
                        onClick={() => handleExcluir(m.id)}
                        title="Excluir"
                      >
                        <FaTrash color="#a00" size={14} />
                      </button>
                      {m.status === "Em análise" && !m.comissaoFinalizada && (
                        <>
                          <button
                            className="btn-tabela"
                            onClick={() => setIdMateriaComissao(m.id)}
                            title="Enviar para Comissão"
                          >
                            Comissão
                          </button>
                          {/* Modal/Select para escolher comissão */}
                          {idMateriaComissao === m.id && (
                            <div style={{
                              position: "absolute", background: "#fff", border: "1px solid #ccc", padding: 14, zIndex: 10, boxShadow: "0 6px 18px #0002"
                            }}>
                              <label>
                                Selecione a comissão:
                                <select
                                  value={comissaoSelecionada}
                                  onChange={e => setComissaoSelecionada(e.target.value)}
                                  style={{ marginLeft: 10, minWidth: 120 }}
                                >
                                  <option value="">...</option>
                                  {comissoes.map(c => (
                                    <option key={c.id} value={c.id}>{c.nome}</option>
                                  ))}
                                </select>
                              </label>
                              <button
                                style={{ marginLeft: 10, background: "#1e88e5", color: "#fff", borderRadius: 4, padding: "3px 10px" }}
                                disabled={!comissaoSelecionada}
                                onClick={async () => {
                                  if (!comissaoSelecionada) return;
                                  await atualizarStatus(m, "Em comissão", { comissaoDestino: comissaoSelecionada });
                                  setIdMateriaComissao(null);
                                  setComissaoSelecionada("");
                                }}
                              >
                                Enviar
                              </button>
                              <button style={{ marginLeft: 8 }} onClick={() => setIdMateriaComissao(null)}>Cancelar</button>
                            </div>
                          )}
                          <button
                            className="btn-tabela"
                            style={{ background: "#b4e7ff", color: "#1e2e3d" }}
                            onClick={() => atualizarStatus(m, "Em pauta")}
                            title="Ir para Pauta (direto)"
                          >
                            Pauta
                          </button>
                        </>
                      )}
                      {m.status === "Em comissão" && (
                        <>
                          <button
                            className="btn-tabela"
                            onClick={() => atualizarStatus(m, "Em jurídico")}
                            title="Enviar para Jurídico"
                          >
                            Jurídico
                          </button>
                          <button
                            className="btn-tabela"
                            style={{ background: "#b4e7ff", color: "#1e2e3d" }}
                            onClick={() => atualizarStatus(m, "Em pauta")}
                            title="Ir para Pauta (direto)"
                          >
                            Pauta
                          </button>
                        </>
                      )}
                      {m.status === "Em jurídico" && (
                        <button
                          className="btn-tabela"
                          onClick={() => atualizarStatus(m, "Em pauta")}
                          title="Liberar para Pauta"
                        >
                          Pauta
                        </button>
                      )}
                      {m.status === "Em pauta" && (
                        <button
                          className="btn-tabela"
                          onClick={() => atualizarStatus(m, "Primeira votação")}
                          title="Enviar para 1ª Votação"
                        >
                          1ª Votação
                        </button>
                      )}
                      {TIPOS_2_VOTACOES.includes(m.tipoProjeto) &&
                        m.status === "Primeira votação" &&
                        !m.intersticioQuebrado && (
                          <button
                            className="btn-tabela"
                            style={{ background: "#ffe494", color: "#222" }}
                            onClick={async () => {
                              if (
                                window.confirm(
                                  "Confirma a quebra do interstício? A matéria irá para 2ª votação!"
                                )
                              ) {
                                await atualizarStatus(
                                  m,
                                  "Segunda votação",
                                  {
                                    intersticioQuebrado: true,
                                    intersticioData: new Date().toISOString(),
                                    intersticioUsuario: "admin",
                                  }
                                );
                              }
                            }}
                            title="Quebrar Interstício"
                          >
                            Quebrar Interstício
                          </button>
                        )}
                      {TIPOS_2_VOTACOES.includes(m.tipoProjeto) &&
                        m.status === "Segunda votação" && (
                          <span style={{ color: "#999", fontSize: 13 }}>
                            (Aguardar painel de votação)
                          </span>
                        )}
                      {!TIPOS_2_VOTACOES.includes(m.tipoProjeto) &&
                        m.status === "Primeira votação" && (
                          <span style={{ color: "#999", fontSize: 13 }}>
                            (Aguardar painel de votação)
                          </span>
                        )}
                    </>
                  )}
                  {!podeEditar(m) && (
                    <>
                      <span style={{ color: "#999", fontSize: 13 }}>
                        (Trâmite finalizado ou em votação)
                      </span>
                      <button
                        className="btn-tabela"
                        style={{ background: "#fbe4a6", color: "#8b6c02", marginLeft: 8 }}
                        onClick={() => {
                          setModalAditarId(m.id);
                          setNovoStatusAditado(m.statusAditado || "");
                          setNovaJustificativaAditado(m.justificativaAditado || "");
                        }}
                        title="Aditar Status Manual"
                      >
                        Aditar Status Manual
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {materiasFiltradas.length === 0 && (
              <tr>
                <td colSpan={9} style={{ textAlign: "center", color: "#888" }}>
                  Nenhuma matéria encontrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL ADITAR STATUS MANUAL */}
      {modalAditarId && (
        <div
          style={{
            position: "fixed", left: 0, top: 0, width: "100vw", height: "100vh",
            background: "#0008", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50
          }}
          onClick={() => setModalAditarId(null)}
        >
          <div
            style={{
              background: "#fff", borderRadius: 10, padding: 32, minWidth: 400, boxShadow: "0 8px 40px #2226",
              position: "relative"
            }}
            onClick={e => e.stopPropagation()}
          >
            <h3>Aditar Status Manual</h3>
            <label>Status Final*</label>
            <select
              value={novoStatusAditado}
              onChange={e => setNovoStatusAditado(e.target.value)}
              style={{ width: "100%", marginBottom: 14 }}
            >
              <option value="">Selecione o status...</option>
              {STATUS_MANUAL.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
            <label>Justificativa (opcional)</label>
            <textarea
              value={novaJustificativaAditado}
              onChange={e => setNovaJustificativaAditado(e.target.value)}
              rows={3}
              style={{ width: "100%", marginBottom: 16 }}
            />
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button
                style={{ background: "#b4e7ff", color: "#1e2e3d", borderRadius: 4, padding: "5px 16px" }}
                onClick={() => setModalAditarId(null)}
              >
                Cancelar
              </button>
              <button
                style={{ background: "#2ca94e", color: "#fff", borderRadius: 4, padding: "5px 16px" }}
                disabled={!novoStatusAditado}
                onClick={() => {
                  const mat = materias.find(m => m.id === modalAditarId);
                  salvarStatusAditado(mat);
                }}
              >
                Salvar Status
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
