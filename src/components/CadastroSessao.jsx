import React, { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  doc,
  addDoc,
  query,
  where
} from "firebase/firestore";
import { db } from "../firebase";
import TopoInstitucional from "./TopoInstitucional";
import { FaTrash, FaEdit } from "react-icons/fa";
import "./CadastroSessao.css";

// Cargos padrão para Mesa Diretora
const CARGOS_MESA = [
  "Presidente",
  "Vice-Presidente",
  "Secretário",
  "2º Secretário",
  "3º Secretário",
];

// Abas do cadastro
const ABAS = [
  "Dados Básicos",
  "Mesa Diretora",
  "Presença",
  "Pautas",
  "Votação",
  "Resumo",
  "Tribuna",
  "Atas",
  "Vídeo/Áudio"
];

export default function CadastroSessao() {
  // ABA ATIVA
  const [aba, setAba] = useState("Dados Básicos");

  // Sessão campos principais
  const [data, setData] = useState("");
  const [hora, setHora] = useState("");
  const [horaTermino, setHoraTermino] = useState("");
  const [tipo, setTipo] = useState("Ordinária");
  const [status, setStatus] = useState("Prevista");
  const [local, setLocal] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [mesa, setMesa] = useState([]);
  const [novoVereador, setNovoVereador] = useState("");
  const [novoCargo, setNovoCargo] = useState("");
  const [sessoes, setSessoes] = useState([]);
  const [pautas, setPautas] = useState([]);
  const [pautaId, setPautaId] = useState("");
  const [resumoVisivelId, setResumoVisivelId] = useState(null);
  const [pautaSelecionada, setPautaSelecionada] = useState(null);
  const [ordemDoDia, setOrdemDoDia] = useState([]);
  const [legislaturas, setLegislaturas] = useState([]);
  const [idLegislatura, setIdLegislatura] = useState("");
  const [legislaturaSelecionada, setLegislaturaSelecionada] = useState(null);
  const [numeroSessaoOrdinaria, setNumeroSessaoOrdinaria] = useState(1);
  const [comissoes, setComissoes] = useState([]);
  const [comissaoId, setComissaoId] = useState("");
  const [resumoSessao, setResumoSessao] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [detalheVisivelId, setDetalheVisivelId] = useState(null);

  // Presença
  const [vereadores, setVereadores] = useState([]);
  const [presentes, setPresentes] = useState([]);

  // Votação e Tribuna — simulação básica
  const [votacao, setVotacao] = useState([]);
  const [tribuna, setTribuna] = useState([]);
  const [atas, setAtas] = useState([]);
  const [videos, setVideos] = useState([]);
  const [audios, setAudios] = useState([]);

  // Carrega dados iniciais
  useEffect(() => {
    carregarSessoes();
    carregarPautas();
    carregarLegislaturas();
    carregarComissoes();
    carregarVereadores();
    // Aqui você pode carregar atas, vídeos, áudios, etc. de acordo com o banco
  }, []);

  // Atualiza número da sessão automática
  useEffect(() => {
    if (!data || !tipo || !idLegislatura || sessoes.length === 0) {
      setNumeroSessaoOrdinaria(1);
      return;
    }
    const anoSessao = new Date(data).getFullYear();
    const sessoesMesmoAnoTipo = sessoes.filter(
      (s) =>
        s.tipo === tipo &&
        s.idLegislatura === idLegislatura &&
        new Date(s.data).getFullYear() === anoSessao
    );
    setNumeroSessaoOrdinaria(sessoesMesmoAnoTipo.length + 1);
  }, [data, tipo, idLegislatura, sessoes]);

  useEffect(() => {
    const pauta = pautas.find((p) => p.id === pautaId);
    setPautaSelecionada(pauta || null);
    setOrdemDoDia(pauta?.itens || []);
  }, [pautaId, pautas]);

  useEffect(() => {
    const leg = legislaturas.find((l) => l.id === idLegislatura);
    setLegislaturaSelecionada(leg || null);
  }, [idLegislatura, legislaturas]);

  // Resumo automático, mas editável
  useEffect(() => {
    if (!data || !hora || !legislaturaSelecionada || !pautaSelecionada) return;
    const numeroLabel = `${numeroSessaoOrdinaria}ª Sessão Plenária ${tipo} - ${legislaturaSelecionada.numero}ª Legislatura (${legislaturaSelecionada.anoInicio}–${legislaturaSelecionada.anoTermino})`;
    const materiasTexto = (ordemDoDia || [])
      .map(
        (m, i) =>
          `  ${i + 1}. ${m.titulo || m.descricao || "Sem título"} (${m.tipo || "Matéria"})`
      )
      .join("\n");
    const resumo = `
${numeroLabel}
Data: ${data} às ${hora} até ${horaTermino || "-"}
Local: ${local}
Status da Sessão: ${status}
Pauta: ${pautaSelecionada?.titulo || "-"}
Matérias na Ordem do Dia:
${materiasTexto || "Nenhuma matéria adicionada."}
    `.trim();
    setResumoSessao(resumo);
  }, [
    tipo,
    status,
    data,
    hora,
    horaTermino,
    local,
    pautaSelecionada,
    legislaturaSelecionada,
    ordemDoDia,
    numeroSessaoOrdinaria,
  ]);

  // Carregar do Firestore
  async function carregarSessoes() {
    setIsLoading(true);
    const querySnapshot = await getDocs(collection(db, "sessoes"));
    setSessoes(querySnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() })));
    setIsLoading(false);
  }
  async function carregarPautas() {
    const snap = await getDocs(collection(db, "pautas"));
    setPautas(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  }
  async function carregarLegislaturas() {
    const snapshot = await getDocs(collection(db, "legislaturas"));
    const lista = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    setLegislaturas(lista);
    const ativa = lista.find(l => l.status === "Ativa");
    setIdLegislatura(ativa?.id || "");
    setLegislaturaSelecionada(ativa || null);
  }
  async function carregarComissoes() {
    const snapshot = await getDocs(collection(db, "comissoes"));
    setComissoes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  }
  async function carregarVereadores() {
    const snapshot = await getDocs(collection(db, "parlamentares"));
    setVereadores(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  }

  // Limpar formulário
  function limparFormulario() {
    setData("");
    setHora("");
    setHoraTermino("");
    setTipo("Ordinária");
    setStatus("Prevista");
    setLocal("");
    setObservacoes("");
    setMesa([]);
    setPautaId("");
    setPautaSelecionada(null);
    setOrdemDoDia([]);
    setEditingId(null);
    setComissaoId("");
    setResumoSessao("");
    setPresentes([]);
    setVotacao([]);
    setTribuna([]);
    setAtas([]);
    setVideos([]);
    setAudios([]);
  }

  // Salvar Sessão
  async function salvarSessao(e) {
    e.preventDefault();
    if (!data || !hora || !idLegislatura) {
      alert("Preencha todos os campos obrigatórios!");
      return;
    }
    const idParaSalvar = editingId
      ? editingId
      : new Date().toISOString().replace(/[:.]/g, "-");
    const sessao = {
      data,
      hora,
      horaTermino,
      tipo,
      status,
      local,
      mesa,
      idLegislatura,
      numeroSessaoOrdinaria,
      comissaoId,
      observacoes,
      pautaId,
      pautaTitulo: pautaSelecionada?.titulo || "",
      ordemDoDia,
      resumoSessao,
      presentes,
      votacao,
      tribuna,
      atas,
      videos,
      audios,
      ultimaEdicao: {
        usuario: "admin",
        data: new Date().toISOString(),
      },
    };
    try {
      if (editingId) {
        await updateDoc(doc(db, "sessoes", editingId), sessao);
      } else {
        await setDoc(doc(db, "sessoes", idParaSalvar), sessao);
      }
      limparFormulario();
      carregarSessoes();
    } catch (error) {
      alert("Erro ao salvar sessão");
    }
  }

  // Editar Sessão
  function editarSessao(sessao) {
    setData(sessao.data);
    setHora(sessao.hora);
    setHoraTermino(sessao.horaTermino || "");
    setTipo(sessao.tipo);
    setStatus(sessao.status);
    setLocal(sessao.local || "");
    setMesa(sessao.mesa || []);
    setPautaId(sessao.pautaId || "");
    setPautaSelecionada(pautas.find((p) => p.id === sessao.pautaId) || null);
    setOrdemDoDia(sessao.ordemDoDia || []);
    setIdLegislatura(sessao.idLegislatura || "");
    setComissaoId(sessao.comissaoId || "");
    setObservacoes(sessao.observacoes || "");
    setResumoSessao(sessao.resumoSessao || "");
    setEditingId(sessao.id);
    setPresentes(sessao.presentes || []);
    setVotacao(sessao.votacao || []);
    setTribuna(sessao.tribuna || []);
    setAtas(sessao.atas || []);
    setVideos(sessao.videos || []);
    setAudios(sessao.audios || []);
  }

  // Remover Sessão
  async function removerSessao(id) {
    if (window.confirm("Deseja remover esta sessão?")) {
      await deleteDoc(doc(db, "sessoes", id));
      carregarSessoes();
    }
  }

  // Adicionar membro à Mesa Diretora
  function adicionarMembroMesa() {
    if (!novoVereador.trim() || !novoCargo) return;
    setMesa((old) => [
      ...old,
      { vereador: novoVereador, cargo: novoCargo },
    ]);
    setNovoVereador("");
    setNovoCargo("");
  }
  function removerMembroMesa(idx) {
    setMesa((old) => old.filter((_, i) => i !== idx));
  }

  // PRESENÇA: Marcar vereador como presente
  function marcarPresenca(vereadorId) {
    setPresentes((old) =>
      old.includes(vereadorId)
        ? old.filter((id) => id !== vereadorId)
        : [...old, vereadorId]
    );
  }

  // EXIBIÇÃO DAS ABAS
  function renderConteudoAba() {
    switch (aba) {
      case "Dados Básicos":
        return (
          <div className="linha-campos">
            <div className="campo-form">
              <label>Data*</label>
              <input
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
                required
              />
            </div>
            <div className="campo-form">
              <label>Hora de início*</label>
              <input
                type="time"
                value={hora}
                onChange={(e) => setHora(e.target.value)}
                required
              />
            </div>
            <div className="campo-form">
              <label>Hora de término</label>
              <input
                type="time"
                value={horaTermino}
                onChange={(e) => setHoraTermino(e.target.value)}
              />
            </div>
            <div className="campo-form">
              <label>Tipo de Sessão*</label>
              <select value={tipo} onChange={(e) => setTipo(e.target.value)} required>
                <option value="Ordinária">Ordinária</option>
                <option value="Extraordinária">Extraordinária</option>
                <option value="Solene">Solene</option>
              </select>
            </div>
            <div className="campo-form">
              <label>Status da Sessão*</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} required>
                <option value="Prevista">Prevista</option>
                <option value="Ativa">Ativa</option>
                <option value="Pausada">Pausada</option>
                <option value="Suspensa">Suspensa</option>
                <option value="Finalizada">Finalizada</option>
                <option value="Realizada">Realizada</option>
                <option value="Cancelada">Cancelada</option>
              </select>
            </div>
            <div className="campo-form">
              <label>Local</label>
              <input
                type="text"
                value={local}
                onChange={(e) => setLocal(e.target.value)}
              />
            </div>
            <div className="campo-form">
              <label>Observações</label>
              <input
                type="text"
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
              />
            </div>
            <div className="campo-form">
              <label>Legislatura*</label>
              <select
                value={idLegislatura}
                onChange={(e) => setIdLegislatura(e.target.value)}
                required
              >
                <option value="">Selecione a Legislatura</option>
                {legislaturas.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.numero}ª Legislatura ({l.anoInicio}–{l.anoTermino})
                  </option>
                ))}
              </select>
            </div>
          </div>
        );
      case "Mesa Diretora":
        return (
          <div className="mesa-sessao">
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Mesa Diretora</div>
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8 }}>
              <select
                value={novoVereador}
                onChange={e => setNovoVereador(e.target.value)}
                style={{ width: 200 }}
              >
                <option value="">Selecione o vereador</option>
                {vereadores.map((v) => (
                  <option key={v.id} value={v.nome}>{v.nome}</option>
                ))}
              </select>
              <select
                value={novoCargo}
                onChange={e => setNovoCargo(e.target.value)}
                style={{ width: 180 }}
              >
                <option value="">Cargo</option>
                {CARGOS_MESA.map((cargo) => (
                  <option key={cargo} value={cargo}>{cargo}</option>
                ))}
              </select>
              <button
                type="button"
                className="btn-mesa-adicionar"
                onClick={adicionarMembroMesa}
              >
                + Incluir Membro
              </button>
            </div>
            <table className="mesa-table">
              <thead>
                <tr>
                  <th>Vereador</th>
                  <th>Cargo</th>
                  <th>Excluir</th>
                </tr>
              </thead>
              <tbody>
                {mesa.map((m, idx) => (
                  <tr key={idx}>
                    <td>{m.vereador}</td>
                    <td>{m.cargo}</td>
                    <td>
                      <button
                        type="button"
                        className="btn-tabela"
                        onClick={() => removerMembroMesa(idx)}
                      >
                        <FaTrash color="#a00" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      case "Presença":
        return (
          <div>
            <div><b>Marcar presença dos vereadores:</b></div>
            <table className="presenca-table">
              <thead>
                <tr>
                  <th>Vereador</th>
                  <th>Presente?</th>
                </tr>
              </thead>
              <tbody>
                {vereadores.map((v) => (
                  <tr key={v.id}>
                    <td>{v.nome}</td>
                    <td>
                      <input
                        type="checkbox"
                        checked={presentes.includes(v.id)}
                        onChange={() => marcarPresenca(v.id)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      case "Pautas":
        return (
          <div>
            <label>Pauta*</label>
            <select
              value={pautaId}
              onChange={(e) => setPautaId(e.target.value)}
              required
              style={{ minWidth: 200 }}
            >
              <option value="">Selecione a pauta</option>
              {pautas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.titulo}
                </option>
              ))}
            </select>
            <div style={{ marginTop: 14 }}>
              <label>Ordem do Dia (itens da pauta):</label>
              <ul style={{ paddingLeft: 20, background: "#f6f8fa", borderRadius: 6 }}>
                {ordemDoDia && ordemDoDia.length > 0 ? (
                  ordemDoDia.map((item, idx) => (
                    <li key={idx}>
                      {item.titulo || item.tituloMateria || item.tituloAta || item.id} <span style={{ color: "#888" }}>({item.tipo})</span>
                    </li>
                  ))
                ) : (
                  <li>Nenhum item na pauta.</li>
                )}
              </ul>
            </div>
          </div>
        );
      case "Resumo":
        return (
          <div>
            <label>Resumo da Sessão (editável):</label>
           <textarea
  name="resumoSessao"
  id="resumoSessao"
  value={resumoSessao}
  onChange={(e) => setResumoSessao(e.target.value)}
  style={{
    width: "100%",
    backgroundColor: "#f4f4f4",
    border: "1px solid #ccc",
    padding: "8px",
    marginBottom: "12px",
    fontFamily: "monospace",
    whiteSpace: "pre-wrap",
    fontSize: 15,
  }}
/>

          </div>
        );
      case "Votação":
        return (
          <div>
            {/* Aqui exiba matérias, votos, etc. conforme estrutura das matérias, apenas exemplo visual */}
            <div><b>Votação — integração com matérias da pauta:</b></div>
            <ul>
              {ordemDoDia && ordemDoDia.length > 0 ? (
                ordemDoDia.map((item, idx) => (
                  <li key={idx}>{item.titulo} — <span style={{ color: "#888" }}>{item.statusVotacao || "Em aberto"}</span></li>
                ))
              ) : (
                <li>Nenhum item para votar.</li>
              )}
            </ul>
          </div>
        );
      case "Tribuna":
        return (
          <div>
            {/* Apenas simulação, preencha com falas reais conforme integrações */}
            <div><b>Tribuna — falas dos vereadores:</b></div>
            <ul>
              {tribuna && tribuna.length > 0 ? (
                tribuna.map((f, idx) => (
                  <li key={idx}>{f.vereador}: {f.fala} <span style={{ color: "#888" }}>{f.horario}</span></li>
                ))
              ) : (
                <li>Nenhuma fala registrada.</li>
              )}
            </ul>
          </div>
        );
      case "Atas":
        return (
          <div>
            <div><b>Atas da Sessão:</b></div>
            <ul>
              {atas && atas.length > 0 ? (
                atas.map((a, idx) => (
                  <li key={idx}>{a.texto || "Ata não detalhada"} <span style={{ color: "#888" }}>{a.data}</span></li>
                ))
              ) : (
                <li>Nenhuma ata vinculada ainda.</li>
              )}
            </ul>
          </div>
        );
      case "Vídeo/Áudio":
        return (
          <div>
            <div><b>Vídeos e Áudios da Sessão:</b></div>
            <ul>
              {[...(videos || []), ...(audios || [])].length > 0 ? (
                [...(videos || []), ...(audios || [])].map((m, idx) => (
                  <li key={idx}><a href={m.url} target="_blank" rel="noopener noreferrer">{m.titulo || m.nomeArquivo}</a></li>
                ))
              ) : (
                <li>Nenhum vídeo ou áudio adicionado.</li>
              )}
            </ul>
          </div>
        );
      default:
        return null;
    }
  }

  return (
    <div className="sessao-container" style={{ maxWidth: 1000, margin: "auto" }}>
      <TopoInstitucional />
      <h2 style={{ marginBottom: 10, textAlign: "center" }}>Cadastro de Sessão Plenária</h2>

      {/* ABAS */}
      <div className="abas-sessao">
        {ABAS.map((nome) => (
          <button
            key={nome}
            className={aba === nome ? "aba ativa" : "aba"}
            onClick={() => setAba(nome)}
          >
            {nome}
          </button>
        ))}
      </div>
      <form className="form-sessao" onSubmit={salvarSessao}>
        <div className="conteudo-aba">{renderConteudoAba()}</div>
        <div className="botoes-form">
          <button type="submit" style={{ marginRight: 10 }}>
            {editingId ? "Atualizar Sessão" : "Salvar Sessão"}
          </button>
          <button type="button" onClick={limparFormulario}>
            Limpar
          </button>
        </div>
      </form>

      <hr style={{ margin: "36px 0 16px 0" }} />
      <h3 style={{ marginBottom: 12 }}>Sessões Plenárias Cadastradas</h3>
      <div className="table-sessoes-institucional">
        <table>
          <thead>
            <tr>
              <th>Tipo</th>
              <th>Data</th>
              <th>Hora</th>
              <th>Status</th>
              <th>Pauta</th>
              <th>Mesa</th>
              <th>Ações</th>
            </tr>
          </thead>
<tbody>
  {isLoading ? (
    <tr><td colSpan={7} style={{ textAlign: "center" }}>Carregando...</td></tr>
  ) : sessoes.length === 0 ? (
    <tr><td colSpan={7} style={{ textAlign: "center", color: "#999" }}>Nenhuma sessão encontrada.</td></tr>
  ) : (
    sessoes.map(sessao => (
      <React.Fragment key={sessao.id}>
        <tr>
          <td>{sessao.tipo}</td>
          <td>{sessao.data}</td>
          <td>{sessao.hora}</td>
          <td>
            <span className={`status-sessao status-${sessao.status?.toLowerCase()}`}>
              {sessao.status}
            </span>
          </td>
          <td>{sessao.pautaTitulo || "-"}</td>
          <td>
            <div style={{ fontSize: 13 }}>
              {sessao.mesa && sessao.mesa.length > 0
                ? sessao.mesa.map((m, i) =>
                  <div key={i}>{m.vereador} <span style={{ color: "#888" }}>({m.cargo})</span></div>)
                : <span style={{ color: "#ccc" }}>-</span>
              }
            </div>
          </td>
          <td>
            <button
              className="btn-tabela"
              style={{ background: "#555", marginRight: 6 }}
              onClick={() => setDetalheVisivelId(detalheVisivelId === sessao.id ? null : sessao.id)}
            >Detalhes</button>
            <button className="btn-tabela" title="Editar" onClick={() => editarSessao(sessao)}>
              <FaEdit />
            </button>
            <button className="btn-tabela" title="Excluir" onClick={() => removerSessao(sessao.id)}>
              <FaTrash />
            </button>
          </td>
        </tr>
        {detalheVisivelId === sessao.id && (
          <tr>
            <td colSpan={7}>
              <div style={{
                background: "#f4f4f4",
                padding: 16,
                border: "1px solid #ddd",
                borderRadius: 5,
                fontSize: 14,
                whiteSpace: "pre-wrap",
                margin: "8px 0",
                color: "#333"
              }}>
                <b>Tipo:</b> {sessao.tipo}<br />
                <b>Data:</b> {sessao.data} &nbsp; <b>Hora:</b> {sessao.hora} - {sessao.horaTermino}<br />
                <b>Status:</b> {sessao.status}<br />
                <b>Local:</b> {sessao.local}<br />
                <b>Legislatura:</b> {sessao.idLegislatura}<br />
                <b>Pauta:</b> {sessao.pautaTitulo || "-"}<br />
                <b>Ordem do Dia:</b>
                <ul>
                  {(sessao.ordemDoDia && sessao.ordemDoDia.length > 0)
                    ? sessao.ordemDoDia.map((item, idx) =>
                      <li key={idx}>
                        {item.titulo || item.tituloMateria || item.tituloAta || item.id}
                        {item.tipo && <span style={{ color: "#888" }}> ({item.tipo})</span>}
                      </li>
                    )
                    : <li>Nenhum item cadastrado.</li>
                  }
                </ul>
                <b>Mesa Diretora:</b>
                <ul>
                  {sessao.mesa && sessao.mesa.length > 0
                    ? sessao.mesa.map((m, i) =>
                      <li key={i}>{m.vereador} <span style={{ color: "#888" }}>({m.cargo})</span></li>)
                    : <li>Não cadastrada.</li>
                  }
                </ul>
                <b>Observações:</b> {sessao.observacoes || "-"}<br />
                <b>Resumo Automático:</b>
                <div style={{
                  background: "#fff",
                  border: "1px solid #ececec",
                  padding: 8,
                  margin: "8px 0",
                  borderRadius: 4,
                  fontFamily: "monospace"
                }}>
                  {sessao.resumoSessao || "Sem resumo salvo."}
                </div>
              </div>
            </td>
          </tr>
        )}
      </React.Fragment>
    ))
  )}
</tbody>

        </table>
      </div>
    </div>
  );
}
