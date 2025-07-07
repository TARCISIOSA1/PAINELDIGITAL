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

  // Votação e Tribuna — agora tribuna é oradores (lista)
  const [votacao, setVotacao] = useState([]);
  const [tribuna, setTribuna] = useState([]); // lista de oradores, não mais só falas!
  const [atas, setAtas] = useState([]);
  const [videos, setVideos] = useState([]);
  const [audios, setAudios] = useState([]);

  // --- CAMPOS ORADORES DA TRIBUNA ---
  const [parlamentares, setParlamentares] = useState([]); // lista para o select
  const [tempoFalaDefault, setTempoFalaDefault] = useState(300);

  // Carrega dados iniciais
  useEffect(() => {
    carregarSessoes();
    carregarPautas();
    carregarLegislaturas();
    carregarComissoes();
    carregarVereadores();
  }, []);

  // Carrega parlamentares para select da tribuna
  useEffect(() => {
    getDocs(collection(db, "parlamentares")).then(snap => {
      setParlamentares(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
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
    setTribuna([]); // oradores
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
      tribuna, // agora é lista de oradores
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
    setTribuna(sessao.tribuna || []); // oradores
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

  // ======== BLOCO ORADORES TRIBUNA ========
  function adicionarOrador(id) {
    if (!id || tribuna.some(o => o.id === id)) return;
    const p = parlamentares.find(p => p.id === id);
    if (p) setTribuna([
      ...tribuna,
      { id: p.id, nome: p.nome, partido: p.partido, foto: p.foto, tempoFala: tempoFalaDefault }
    ]);
  }
  function removerOrador(idx) {
    setTribuna(tribuna.filter((_, i) => i !== idx));
  }
  function moverOrador(idx, dir) {
    if ((dir === -1 && idx === 0) || (dir === 1 && idx === tribuna.length - 1)) return;
    const nova = [...tribuna];
    const temp = nova[idx];
    nova[idx] = nova[idx + dir];
    nova[idx + dir] = temp;
    setTribuna(nova);
  }
  function alterarTempo(idx, val) {
    const nova = [...tribuna];
    nova[idx].tempoFala = parseInt(val) || 0;
    setTribuna(nova);
  }
  // ====== FIM BLOCO ORADORES ======

  // EXIBIÇÃO DAS ABAS
  function renderConteudoAba() {
    switch (aba) {
      // ...demais abas iguais...
      case "Tribuna":
        return (
          <div>
            <h4>Oradores da Tribuna</h4>
            <div style={{ marginBottom: 10 }}>
              <label>Adicionar orador:</label>
              <select onChange={e => adicionarOrador(e.target.value)} value="">
                <option value="">Selecione...</option>
                {parlamentares.filter(p => !tribuna.some(o => o.id === p.id)).map(p => (
                  <option key={p.id} value={p.id}>{p.nome} ({p.partido})</option>
                ))}
              </select>
              <span style={{ marginLeft: 16, fontSize: 13 }}>
                Tempo padrão:{" "}
                <input
                  type="number"
                  value={tempoFalaDefault}
                  onChange={e => setTempoFalaDefault(parseInt(e.target.value) || 0)}
                  style={{ width: 60, marginLeft: 5 }}
                />{" "}
                segundos
              </span>
            </div>
            {tribuna.length > 0 &&
              <table className="tabela-oradores-tribuna">
                <thead>
                  <tr>
                    <th>Ordem</th>
                    <th>Nome</th>
                    <th>Partido</th>
                    <th>Tempo de Fala (s)</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {tribuna.map((o, idx) => (
                    <tr key={o.id}>
                      <td>
                        <button type="button" onClick={() => moverOrador(idx, -1)} disabled={idx === 0}>▲</button>
                        <button type="button" onClick={() => moverOrador(idx, 1)} disabled={idx === tribuna.length - 1}>▼</button>
                      </td>
                      <td>{o.nome}</td>
                      <td>{o.partido}</td>
                      <td>
                        <input
                          type="number"
                          value={o.tempoFala}
                          onChange={e => alterarTempo(idx, e.target.value)}
                          style={{ width: 60 }}
                        />
                      </td>
                      <td>
                        <button type="button" onClick={() => removerOrador(idx)}>Remover</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            }
            <hr />
            <div><b>Tribuna — falas dos vereadores:</b></div>
            <ul>
              {tribuna && tribuna.length > 0 ? (
                tribuna.map((f, idx) => (
                  <li key={idx}>{f.vereador || f.nome}: {f.fala || ""} <span style={{ color: "#888" }}>{f.horario || ""}</span></li>
                ))
              ) : (
                <li>Nenhum orador registrado.</li>
              )}
            </ul>
          </div>
        );
      // ...restante das abas não muda...
      // Cole aqui os outros cases IGUAL está no seu código original
      case "Dados Básicos":
      case "Mesa Diretora":
      case "Presença":
      case "Pautas":
      case "Resumo":
      case "Votação":
      case "Atas":
      case "Vídeo/Áudio":
        // tudo igual ao seu código já enviado!
        return renderConteudoAbaOriginal(aba);
      default:
        return null;
    }
  }

  // Função para manter as demais abas iguais (mantém seu código original)
  function renderConteudoAbaOriginal(aba) {
    // Cole aqui TODO o código dos seus outros cases IGUAL você já tem.
    // Ou, se preferir, apenas retorne null para demonstrativo:
    return null;
  }

  // RENDERIZAÇÃO PRINCIPAL
  return (
    <div className="sessao-container" style={{ maxWidth: 1000, margin: "auto" }}>
      <TopoInstitucional />
      <h2 style={{ marginBottom: 10, textAlign: "center" }}>Cadastro de Sessão Plenária</h2>
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
      {/* Tabela de sessões: permanece igual ao seu código original */}
      {/* ... */}
    </div>
  );
}
