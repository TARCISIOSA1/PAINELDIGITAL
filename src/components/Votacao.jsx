import React, { useEffect, useState, useRef } from "react";
import {
  collection, getDocs, doc, updateDoc, setDoc, addDoc, getDoc
} from "firebase/firestore";
import { db } from "../firebase";
import TopoInstitucional from "./TopoInstitucional";
import { FaArrowUp, FaArrowDown } from "react-icons/fa";
import "./Votacao.css";
import panelConfig from "../config/panelConfig.json";

const QUORUM_OPTIONS = [
  { label: "Quórum Simples", value: "simples", regra: "Maioria simples dos presentes (n/2 + 1)", formula: n => Math.ceil(n / 2) },
  { label: "Quórum de Suspensão", value: "suspensao", regra: "1/3 dos vereadores", formula: n => Math.ceil(n / 3) },
  { label: "Quórum de Votação", value: "votacao", regra: "Maioria absoluta (50%+1 dos membros)", formula: n => Math.ceil(n / 2) + 1 },
  { label: "Quórum Qualificado", value: "qualificado", regra: "2/3 dos membros", formula: n => Math.ceil(n * 2 / 3) },
];

// FUNÇÃO PARA SALVAR TUDO NO painelAtivo/ativo
async function salvarPainelAtivoCompleto({
  sessaoAtiva,
  numeroSessaoOrdinaria,
  numeroSessaoLegislativa,
  legislaturaSelecionada,
  vereadores,
  habilitados,
  materias,
  oradores,
  oradorAtivoIdx,
  tempoRestante,
  resumoFala,
  cronometroAtivo,
  bancoHoras,
  tipoVotacao,
  quorumTipo,
  quorumMinimo,
  modalidade,
  tempoVotacao,
  votos,
  painelRTC,
  observacoes,
  pauta
}) {
  await setDoc(doc(db, "painelAtivo", "ativo"), {
    numeroSessaoOrdinaria: numeroSessaoOrdinaria || "",
    numeroSessaoLegislativa: numeroSessaoLegislativa || "",
    legislatura: sessaoAtiva?.idLegislatura || "",
    legislaturaDescricao: legislaturaSelecionada?.descricao || "",
    presidente: sessaoAtiva?.mesa?.[0]?.vereador || sessaoAtiva?.presidente || "",
    tipo: sessaoAtiva?.tipo || "",
    data: sessaoAtiva?.data || "",
    hora: sessaoAtiva?.hora || "",
    statusSessao: sessaoAtiva?.status || "",
    local: sessaoAtiva?.local || "",
    pauta: pauta || sessaoAtiva?.pauta || "",
    observacoes: observacoes || sessaoAtiva?.observacoes || "",
    mesaDiretora: (sessaoAtiva?.mesa || []).map(m => ({
      nome: m.vereador,
      cargo: m.cargo,
      id: m.id || "",
    })),
    parlamentares: vereadores.map(v => ({
      id: v.id,
      nome: v.nome,
      partido: v.partido,
      foto: v.foto || "",
      presente: habilitados.includes(v.id),
    })),
    ordemDoDia: (materias || []).map(m => ({
      id: m.id,
      titulo: m.titulo || m.descricao || "",
      tipo: m.tipo || "",
      autor: m.autor || "",
      status: m.status || "",
    })),
    ata: sessaoAtiva?.ata || "",
    tribuna: {
      oradores: (oradores || []).map((o, idx) => ({
        id: o.id,
        nome: o.nome,
        partido: o.partido,
        tempoFala: o.tempoFala,
        saldo: o.saldo,
        fala: o.fala || "",
        horario: o.horario || "",
        ordem: idx + 1,
        externo: !!o.externo,
      })),
      oradorAtivoIdx,
      tempoRestante,
      resumoFala,
      cronometroAtivo,
      bancoHoras: bancoHoras || {},
    },
    tipoVotacao: tipoVotacao || "",
    quorumTipo: quorumTipo || "",
    quorumMinimo: quorumMinimo || 0,
    modalidade: modalidade || "",
    tempoVotacao: tempoVotacao || "",
    habilitados: habilitados || [],
    votos: votos || {},
    rtc: painelRTC || null,
    atualizadoEm: new Date().toISOString(),
  }, { merge: true });
}

export default function Votacao() {
  // ----------------------- ESTADOS PRINCIPAIS ----------------------
  const [aba, setAba] = useState("Controle de Sessão");
  const [sessaoAtiva, setSessaoAtiva] = useState(null);
  const [materias, setMaterias] = useState([]);
  const [materiasSelecionadas, setMateriasSelecionadas] = useState([]);
  const [vereadores, setVereadores] = useState([]);
  const [habilitados, setHabilitados] = useState([]);
  const [tipoVotacao, setTipoVotacao] = useState("Simples");
  const [modalidade, setModalidade] = useState("Unica");
  const [statusVotacao, setStatusVotacao] = useState("Preparando");
  const [quorumTipo, setQuorumTipo] = useState("simples");
  const [quorumMinimo, setQuorumMinimo] = useState(0);
  const [tempoVotacao, setTempoVotacao] = useState(""); // opcional

  // --------------------- TRIBUNA E SALDO ---------------------
  const [oradores, setOradores] = useState([]);
  const [tempoPadrao, setTempoPadrao] = useState(180);
  const [oradorAtivoIdx, setOradorAtivoIdx] = useState(-1);
  const [tempoRestante, setTempoRestante] = useState(0);
  const [cronometroAtivo, setCronometroAtivo] = useState(false);
  const [resumoFala, setResumoFala] = useState("");
  const [bancoHoras, setBancoHoras] = useState({});
  const [tempoExtra, setTempoExtra] = useState(0);

  // -------------------- PRESENÇA/LEGISLATURA --------------------
  const [legislaturas, setLegislaturas] = useState([]);
  const [legislaturaSelecionada, setLegislaturaSelecionada] = useState(null);
  const [numeroSessaoOrdinaria, setNumeroSessaoOrdinaria] = useState(0);
  const [numeroSessaoLegislativa, setNumeroSessaoLegislativa] = useState(0);

  // --------------------- IA E ATA ---------------------
  const [abaIApergunta, setAbaIApergunta] = useState("");
  const [abaIAresposta, setAbaIAresposta] = useState("");
  const [ataEditor, setAtaEditor] = useState("");
  const [assinaturas, setAssinaturas] = useState([]);
  const [carregandoAta, setCarregandoAta] = useState(false);

  const intervalRef = useRef(null);

  // ------------------ INICIALIZAÇÃO ------------------
  useEffect(() => {
    carregarSessaoAtivaOuPrevista();
    carregarVereadores();
    carregarBancoHoras();
  }, []);

  useEffect(() => {
    const carregarLegislaturaEContagem = async () => {
      const snapshot = await getDocs(collection(db, "legislaturas"));
      const lista = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const ativa = lista.find(l => l.status === "Ativa");
      setLegislaturas(lista);
      setLegislaturaSelecionada(ativa);
      if (!ativa) return;
      const sessoesSnap = await getDocs(collection(db, "sessoes"));
      const sessoes = sessoesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const sessoesDaLegislatura = sessoes.filter(s => s.idLegislatura === ativa.id && s.tipo === "Ordinária");
      const anoAtual = new Date().getFullYear();
      const numeroLegislativa = anoAtual - parseInt(ativa.anoInicio) + 1;
      setNumeroSessaoOrdinaria(sessoesDaLegislatura.length + 1);
      setNumeroSessaoLegislativa(numeroLegislativa);
    };
    carregarLegislaturaEContagem();
  }, []);

  useEffect(() => {
    const opt = QUORUM_OPTIONS.find(o => o.value === quorumTipo);
    if (opt) setQuorumMinimo(opt.formula(vereadores.length));
  }, [quorumTipo, vereadores.length]);

  // SALVAMENTO COMPLETO AUTOMÁTICO
  useEffect(() => {
    if (!sessaoAtiva) return;
    salvarPainelAtivoCompleto({
      sessaoAtiva,
      numeroSessaoOrdinaria,
      numeroSessaoLegislativa,
      legislaturaSelecionada,
      vereadores,
      habilitados,
      materias,
      oradores,
      oradorAtivoIdx,
      tempoRestante,
      resumoFala,
      cronometroAtivo,
      bancoHoras,
      tipoVotacao,
      quorumTipo,
      quorumMinimo,
      modalidade,
      tempoVotacao,
      votos: {},        // Troque se tiver objeto de votos real
      painelRTC: null,  // Troque se usar RTC
      observacoes: sessaoAtiva?.observacoes || "",
      pauta: sessaoAtiva?.pauta || ""
    });
    // eslint-disable-next-line
  }, [
    sessaoAtiva,
    numeroSessaoOrdinaria,
    numeroSessaoLegislativa,
    legislaturaSelecionada,
    vereadores,
    habilitados,
    materias,
    oradores,
    oradorAtivoIdx,
    tempoRestante,
    resumoFala,
    cronometroAtivo,
    bancoHoras,
    tipoVotacao,
    quorumTipo,
    quorumMinimo,
    modalidade,
    tempoVotacao
  ]);

  // ------------------- LOAD DADOS -------------------
  const carregarSessaoAtivaOuPrevista = async () => {
    const snapshot = await getDocs(collection(db, "sessoes"));
    const lista = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    let sessao = lista.find((s) => s.status === "Ativa");
    if (!sessao) {
      sessao = lista.find(
        (s) => s.status === "Prevista" || s.status === "Suspensa" || s.status === "Pausada"
      );
    }
    if (sessao) {
      setSessaoAtiva(sessao);
      setMaterias(sessao.ordemDoDia || []);
      setMateriasSelecionadas(sessao.ordemDoDia?.filter(m => m.status !== "votada").map(m => m.id) || []);
      let habilitadosPainel = [];
      try {
        const painelAtivoSnap = await getDoc(doc(db, "painelAtivo", "ativo"));
        const painelData = painelAtivoSnap.exists() ? painelAtivoSnap.data() : {};
        if (painelData && Array.isArray(painelData.habilitados)) {
          habilitadosPainel = painelData.habilitados;
        }
      } catch {}
      if (habilitadosPainel.length > 0) {
        setHabilitados(habilitadosPainel);
      } else {
        setHabilitados(
          Array.isArray(sessao.presentes)
            ? sessao.presentes.map((p) => (p.id ? p.id : p))
            : []
        );
      }
      setTipoVotacao(sessao.tipoVotacao || "Simples");
      setModalidade(sessao.modalidade || "Unica");
      setTempoVotacao(sessao.tempoVotacao || "");
      if (Array.isArray(sessao.tribuna) && sessao.tribuna.length > 0) {
        setOradores(sessao.tribuna.map(o => ({
          ...o,
          saldo: 0,
          fala: o.fala || "",
          horario: "",
        })));
      } else {
        setOradores([]);
      }
    } else {
      setSessaoAtiva(null);
      setMaterias([]);
      setMateriasSelecionadas([]);
      setHabilitados([]);
      setTipoVotacao("Simples");
      setModalidade("Unica");
      setTempoVotacao("");
      setStatusVotacao("Preparando");
      setOradores([]);
    }
  };

  const carregarVereadores = async () => {
    const snap = await getDocs(collection(db, "parlamentares"));
    setVereadores(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
  };

  const carregarBancoHoras = async () => {
    const snap = await getDocs(collection(db, "bancoHoras"));
    const dados = {};
    snap.docs.forEach((doc) => {
      dados[doc.id] = doc.data().tempo || 0;
    });
    setBancoHoras(dados);
  };

 // ==================== TRIBUNA E FUNÇÕES ========================
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (cronometroAtivo && oradorAtivoIdx >= 0 && tempoRestante > 0) {
      intervalRef.current = setInterval(() => {
        setTempoRestante(prev => {
          const novo = prev > 0 ? prev - 1 : 0;
          if (novo === 0) {
            setCronometroAtivo(false);
            clearInterval(intervalRef.current);
          }
          return novo;
        });
      }, 1000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [cronometroAtivo, oradorAtivoIdx, tempoRestante]);

  // Salva a tribuna SEMPRE que qualquer coisa mudar (também é salva no painelAtivo completo)
  useEffect(() => {
    updateDoc(doc(db, "painelAtivo", "ativo"), {
      tribunaAtual: {
        oradores,
        oradorAtivoIdx,
        tempoRestante,
        resumoFala,
        cronometroAtivo
      }
    }).catch(()=>{});
  }, [oradores, oradorAtivoIdx, tempoRestante, resumoFala, cronometroAtivo]);

  function usarSaldoHoras(idx) {
    const orador = oradores[idx];
    const saldoAtual = bancoHoras[orador.id] || 0;
    if (saldoAtual > 0) {
      const lista = [...oradores];
      lista[idx].tempoFala = saldoAtual;
      setOradores(lista);
      setBancoHoras(prev => ({ ...prev, [orador.id]: 0 }));
      updateDoc(doc(db, "painelAtivo", "ativo"), {
        bancoHoras: { ...bancoHoras, [orador.id]: 0 }
      });
    }
  }

  function adicionarTempoExtra(idx) {
    if (tempoExtra > 0) {
      const lista = [...oradores];
      lista[idx].tempoFala += Number(tempoExtra);
      setOradores(lista);
      setTempoExtra(0);
    }
  }

  async function encerrarFala() {
    if (oradorAtivoIdx < 0) return;
    setCronometroAtivo(false);
    const orador = oradores[oradorAtivoIdx];
    if (orador.id && !orador.externo) {
      setBancoHoras(prev => ({
        ...prev,
        [orador.id]: tempoRestante
      }));
      await updateDoc(doc(db, "painelAtivo", "ativo"), {
        bancoHoras: { ...bancoHoras, [orador.id]: tempoRestante }
      });
    }
    const lista = [...oradores];
    lista[oradorAtivoIdx].saldo = tempoRestante;
    lista[oradorAtivoIdx].fala = resumoFala;
    lista[oradorAtivoIdx].horario = new Date().toLocaleTimeString();
    setOradores(lista);
    setTempoRestante(0);
    setResumoFala("");
  }

  function iniciarFala() {
    if (oradorAtivoIdx < 0) return;
    setTempoRestante(oradores[oradorAtivoIdx].tempoFala);
    setCronometroAtivo(true);
  }
  function pausarFala() {
    setCronometroAtivo(false);
  }
  function proximoOrador() {
    if (oradorAtivoIdx < oradores.length - 1) {
      setOradorAtivoIdx(oradorAtivoIdx + 1);
      setTempoRestante(oradores[oradorAtivoIdx + 1].tempoFala);
      setResumoFala("");
      setCronometroAtivo(false);
    }
  }
  function alterarTempoFala(idx, valor) {
    const lista = [...oradores];
    lista[idx].tempoFala = parseInt(valor) || tempoPadrao;
    setOradores(lista);
  }
  function zerarSaldos() {
    setBancoHoras({});
    setOradores(oradores.map(o => ({ ...o, saldo: 0 })));
    updateDoc(doc(db, "painelAtivo", "ativo"), { bancoHoras: {} });
  }

  // -------------- ZERAR PAINEL ATIVO ------------------
  async function zerarPainelAtivo() {
    await setDoc(doc(db, "painelAtivo", "ativo"), {
      statusSessao: "",
      dataHoraInicio: "",
      ordemDoDia: [],
      votacaoAtual: {},
      tribunaAtual: {},
      habilitados: [],
      ataCompleta: "",
      bancoHoras: {},
    }, { merge: false });
  }

  // --------------- CONTROLE DE SESSÃO/VOTAÇÃO ---------------
  const alterarStatusSessao = async (novoStatus) => {
    if (!sessaoAtiva) return;
    const sessaoRef = doc(db, "sessoes", sessaoAtiva.id);
    await updateDoc(sessaoRef, { status: novoStatus });
    setSessaoAtiva((prev) => ({ ...prev, status: novoStatus }));
    await updateDoc(doc(db, "painelAtivo", "ativo"), {
      statusSessao: novoStatus,
    });
    if (novoStatus === "Encerrada") {
      await zerarPainelAtivo();
    }
  };
  const iniciarSessao = async () => {
    if (!sessaoAtiva) return;
    const sessaoRef = doc(db, "sessoes", sessaoAtiva.id);
    await updateDoc(sessaoRef, { status: "Ativa" });
    setSessaoAtiva((prev) => ({ ...prev, status: "Ativa" }));
    const painelRef = doc(db, "painelAtivo", "ativo");
    const agora = new Date();
    await setDoc(
      painelRef,
      {
        statusSessao: "Ativa",
        dataHoraInicio: agora.toISOString(),
      },
      { merge: true }
    );
    for (let id of Object.keys(bancoHoras)) {
      await setDoc(doc(db, "bancoHoras", id), { tempo: 0 }, { merge: true });
    }
    await zerarPainelAtivo();
  };

  function moverMateria(idx, direcao) {
    setMaterias((prev) => {
      const nova = [...prev];
      if (
        (direcao === -1 && idx === 0) ||
        (direcao === 1 && idx === nova.length - 1)
      )
        return nova;
      [nova[idx], nova[idx + direcao]] = [nova[idx + direcao], nova[idx]];
      if (sessaoAtiva) {
        const sessaoRef = doc(db, "sessoes", sessaoAtiva.id);
        updateDoc(sessaoRef, { ordemDoDia: nova });
        updateDoc(doc(db, "painelAtivo", "ativo"), { ordemDoDia: nova });
      }
      return nova;
    });
  }

  const iniciarVotacao = async () => {
    if (!sessaoAtiva || materiasSelecionadas.length === 0) return;
    if (habilitados.length < quorumMinimo) {
      alert("Quórum mínimo não atingido!");
      return;
    }
    let novaOrdem = (materias || []).map((m) =>
      materiasSelecionadas.includes(m.id) ? { ...m, status: "em_votacao" } : m
    );
    setMaterias(novaOrdem);
    const sessaoRef = doc(db, "sessoes", sessaoAtiva.id);
    await updateDoc(sessaoRef, { ordemDoDia: novaOrdem });
    for (let id of materiasSelecionadas) {
      const materiaRef = doc(db, "materias", id);
      await updateDoc(materiaRef, { status: "em_votacao" }).catch(() => { });
    }
    const painelRef = doc(db, "painelAtivo", "ativo");
    await setDoc(
      painelRef,
      {
        ordemDoDia: novaOrdem,
        votacaoAtual: {
          materias: novaOrdem
            .filter((m) => materiasSelecionadas.includes(m.id))
            .map((m) => ({
              id: m.id,
              titulo: m.titulo || m.descricao || "Sem título",
              tipo: m.tipo || "Não definido",
              autor: m.autor || "-",
              status: "em_votacao",
            })),
          tipo: tipoVotacao,
          status: "em_votacao",
          habilitados,
          votos: {},
          tempoVotacao: tempoVotacao || "",
        },
        statusSessao: sessaoAtiva.status || "Ativa",
      },
      { merge: true }
    );
    setStatusVotacao("Em Andamento");
  };

  const pausarVotacao = async () => {
    setStatusVotacao("Pausada");
    await updateDoc(doc(db, "painelAtivo", "ativo"), {
      "votacaoAtual.status": "pausada",
    }).catch(() => { });
  };

  const retomarVotacao = async () => {
    setStatusVotacao("Em Andamento");
    await updateDoc(doc(db, "painelAtivo", "ativo"), {
      "votacaoAtual.status": "em_votacao",
    }).catch(() => { });
  };

  const encerrarVotacao = async () => {
    if (!sessaoAtiva || materiasSelecionadas.length === 0) return;
    let novaOrdem = (materias || []).map((m) =>
      materiasSelecionadas.includes(m.id) ? { ...m, status: "votada" } : m
    );
    setMaterias(novaOrdem);
    const sessaoRef = doc(db, "sessoes", sessaoAtiva.id);
    await updateDoc(sessaoRef, { ordemDoDia: novaOrdem });
    for (let id of materiasSelecionadas) {
      const materiaRef = doc(db, "materias", id);
      await updateDoc(materiaRef, { status: "votada" }).catch(() => { });
    }
    await updateDoc(doc(db, "painelAtivo", "ativo"), {
      ordemDoDia: novaOrdem,
      "votacaoAtual.status": "votada",
    }).catch(() => { });
    setStatusVotacao("Preparando");
    setMateriasSelecionadas((prev) => prev.filter((id) => {
      const mat = novaOrdem.find((m) => m.id === id);
      return mat && mat.status !== "votada";
    }));
  };

  const toggleMateria = (id) => {
    if (modalidade === "Lote") {
      setMateriasSelecionadas((prev) =>
        prev.includes(id)
          ? prev.filter((m) => m !== id)
          : [...prev, id]
      );
    } else {
      setMateriasSelecionadas([id]);
    }
  };

  // ----------- IA e ATA -----------
  async function perguntarIA() {
    setAbaIAresposta("Consultando IA...");
    const res = await fetch("http://localhost:3334/api/pergunte", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pergunta: abaIApergunta }),
    });
    const json = await res.json();
    setAbaIAresposta(json.resposta || "Sem resposta da IA.");
  }

  // ATA - construtor e salvar só em "atas"
  async function salvarAta() {
    setCarregandoAta(true);
    const ataFinal = {
      ataCompleta: ataEditor,
      idSessao: sessaoAtiva?.id || null,
      dataCriacao: new Date().toISOString(),
      presentes: vereadores.filter(v => habilitados.includes(v.id)).map(v => ({
        id: v.id, nome: v.nome, partido: v.partido
      })),
      assinaturas,
      mesaDiretora: sessaoAtiva?.mesa || [],
    };
    if (sessaoAtiva?.id) {
      await setDoc(doc(db, "atas", sessaoAtiva.id), ataFinal, { merge: true });
    } else {
      await addDoc(collection(db, "atas"), ataFinal);
    }
    setCarregandoAta(false);
    alert("ATA salva com sucesso!");
  }

  function gerarTextoPadraoAta() {
    const topo = panelConfig?.nomeCamara || "Câmara Municipal";
    const cidade = panelConfig?.cidade || "";
    const dataSessao = sessaoAtiva?.data || new Date().toLocaleDateString();
    const horaSessao = sessaoAtiva?.hora || new Date().toLocaleTimeString();
    const presidente = sessaoAtiva?.mesa?.[0]?.vereador || sessaoAtiva?.presidente || "-";
    let texto = `\n${topo}\n${cidade}\nATA DA SESSÃO PLENÁRIA\n\n`;
    texto += `Aos ${dataSessao}, às ${horaSessao}, realizou-se a sessão plenária sob a presidência de ${presidente}.\n\n`;
    texto += `Presentes:\n`;
    texto += vereadores.filter(v => habilitados.includes(v.id))
      .map(v => `- ${v.nome} (${v.partido})`).join("\n") || "-";
    texto += "\n\n";
    texto += "Ordem do Dia:\n";
    materias.forEach((m, i) => {
      texto += `${i + 1}. ${m.titulo || m.descricao || "Sem título"} (${m.tipo || "-"}) - Autor: ${m.autor || "-"} - Status: ${m.status}\n`;
    });
    texto += "\nNada mais havendo a tratar, a sessão foi encerrada.\n";
    texto += "\nAssinaturas da Mesa Diretora:\n\n";
    (sessaoAtiva?.mesa || []).forEach((m) => {
      texto += `______________________________    ${m.vereador} (${m.cargo})\n\n`;
    });
    setAtaEditor(texto);
  }

  // ----------- RENDER DE ABAS -----------
  function renderConteudoAba() {
    switch (aba) {
      case "Controle de Sessão":
        return (
          <div className="bloco-dados-gerais">
            <h3>Dados da Sessão</h3>
            <b>Número da Sessão Plenária:</b> {numeroSessaoOrdinaria}ª<br />
            <b>Número da Sessão Legislativa:</b> {numeroSessaoLegislativa}ª<br />
            <b>Tipo:</b> {sessaoAtiva?.tipo || "-"} <br />
            <b>Data:</b> {sessaoAtiva?.data || "-"}<br />
            <b>Hora:</b> {sessaoAtiva?.hora || "-"}<br />
            <b>Status:</b> {sessaoAtiva?.status || "-"}<br />
            <b>Legislatura:</b> {legislaturaSelecionada?.descricao || "-"}
            <hr />
            <b>Mesa Diretora:</b>
            <ul>
              {sessaoAtiva?.mesa?.length > 0
                ? sessaoAtiva.mesa.map((m, i) => (
                  <li key={i}>
                    {m.vereador} <span style={{ color: "#888" }}>({m.cargo})</span>
                  </li>
                ))
                : <li>-</li>
              }
            </ul>
            <hr />
            <div style={{ margin: "16px 0" }}>
              <h4>Botões de Controle da Sessão</h4>
              {sessaoAtiva?.status !== "Ativa" && (
                <button className="botao-verde" onClick={iniciarSessao}>
                  ▶ Iniciar Sessão
                </button>
              )}
              {sessaoAtiva?.status === "Ativa" && (
                <button className="botao-vermelho" onClick={() => alterarStatusSessao("Encerrada")}>
                  🛑 Encerrar Sessão
                </button>
              )}
              <button className="botao-cinza" onClick={() => alterarStatusSessao("Suspensa")}>
                ⏸ Suspender Sessão
              </button>
              <button className="botao-cinza" onClick={() => alterarStatusSessao("Pausada")}>
                ⏸ Pausar Sessão
              </button>
              <button className="botao-verde" onClick={() => alterarStatusSessao("Ativa")}>
                ▶ Retomar Sessão
              </button>
            </div>
          </div>
        );
      case "Controle de Votação":
        const quorumObj = QUORUM_OPTIONS.find(o => o.value === quorumTipo);
        return (
          <div>
            <div className="bloco-config-votacao" style={{ margin: "20px 0", padding: 12, background: "#f8fafc", borderRadius: 8 }}>
              <h4>⚙️ Configuração da Votação</h4>
              <div style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
                <label>
                  <strong>Tipo de Votação:</strong>{" "}
                  <select value={tipoVotacao} onChange={e => setTipoVotacao(e.target.value)} style={{ padding: "2px 8px" }}>
                    <option>Simples</option>
                    <option>Nominal</option>
                    <option>Secreta</option>
                    <option>Aclamação</option>
                    <option>Destaque</option>
                    <option>Escrutínio</option>
                  </select>
                </label>
                <label>
                  <strong>Modalidade:</strong>{" "}
                  <select value={modalidade} onChange={e => setModalidade(e.target.value)} style={{ padding: "2px 8px" }}>
                    <option>Unica</option>
                    <option>Lote</option>
                  </select>
                </label>
                <label>
                  <strong>Quórum Legal:</strong>{" "}
                  <select value={quorumTipo} onChange={e => setQuorumTipo(e.target.value)} style={{ padding: "2px 8px" }}>
                    {QUORUM_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
                  <span style={{ marginLeft: 8, color: "#3a3", fontWeight: 600 }}>
                    ({quorumMinimo} vereadores) <span style={{ color: "#888", fontWeight: 400 }} title={quorumObj.regra}>• {quorumObj.regra}</span>
                  </span>
                </label>
                <label>
                  <strong>Tempo de Votação (opcional, min):</strong>
                  <input
                    type="number"
                    value={tempoVotacao}
                    onChange={e => setTempoVotacao(e.target.value)}
                    style={{ width: 60, marginLeft: 8 }}
                  />
                </label>
              </div>
            </div>
            <div className="controle-votacao">
              <h4>🛠 Controle da Votação (Status: {statusVotacao})</h4>
              <button className="botao-cinza" onClick={pausarVotacao}>
                ⏸ Pausar Votação
              </button>
              <button className="botao-verde" onClick={retomarVotacao}>
                ▶ Retomar Votação
              </button>
              <button className="botao-azul" onClick={iniciarVotacao}>
                ▶ Iniciar Votação
              </button>
              <button className="botao-verde" onClick={encerrarVotacao}>
                ✅ Encerrar Votação
              </button>
            </div>
            <hr />
            <div className="materias">
              <h4>📄 Matérias da Ordem do Dia</h4>
              <ul>
                {materias.map((m, idx) => (
                  <li
                    key={m.id}
                    className={materiasSelecionadas.includes(m.id) ? "materia-selecionada" : ""}
                    style={{ display: "flex", alignItems: "center", marginBottom: 6 }}
                  >
                    <input
                      type={modalidade === "Lote" ? "checkbox" : "radio"}
                      name="materias"
                      checked={materiasSelecionadas.includes(m.id)}
                      onChange={() => {
                        if (m.status !== "votada") toggleMateria(m.id);
                      }}
                      disabled={m.status === "votada" || sessaoAtiva?.status !== "Ativa"}
                    />
                    <span
                      style={{
                        color:
                          m.status === "votada"
                            ? "#aaa"
                            : m.status === "em_votacao"
                              ? "#2465d6"
                              : "#202",
                        fontWeight: m.status === "em_votacao" ? "bold" : "normal",
                        marginLeft: 8,
                        marginRight: 12,
                        flex: 1,
                      }}
                    >
                      {m.titulo} ({m.tipo}) - Status: {m.status}
                    </span>
                    <button
                      style={{
                        background: "none",
                        border: "none",
                        cursor: idx === 0 ? "not-allowed" : "pointer",
                        opacity: idx === 0 ? 0.3 : 1,
                        fontSize: 15,
                      }}
                      onClick={() => moverMateria(idx, -1)}
                      disabled={idx === 0}
                      title="Subir"
                      type="button"
                    >
                      <FaArrowUp />
                    </button>
                    <button
                      style={{
                        background: "none",
                        border: "none",
                        cursor: idx === materias.length - 1 ? "not-allowed" : "pointer",
                        opacity: idx === materias.length - 1 ? 0.3 : 1,
                        fontSize: 15,
                      }}
                      onClick={() => moverMateria(idx, 1)}
                      disabled={idx === materias.length - 1}
                      title="Descer"
                      type="button"
                    >
                      <FaArrowDown />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <hr />
            <div className="habilitacao">
              <h4>👥 Habilitação de Vereadores</h4>
              <ul>
                {vereadores.map((p) => (
                  <li key={p.id}>
                    <input
                      type="checkbox"
                      checked={habilitados.includes(p.id)}
                      onChange={() => {
                        const novo = habilitados.includes(p.id)
                          ? habilitados.filter((x) => x !== p.id)
                          : [...habilitados, p.id];
                        setHabilitados(novo);
                        updateDoc(doc(db, "painelAtivo", "ativo"), {
                          habilitados: novo
                        });
                      }}
                    />
                    <img
                      src={p.foto || "/default.png"}
                      width="30"
                      alt={p.nome}
                      style={{ verticalAlign: "middle", margin: "0 5px" }}
                    />
                    {p.nome} ({p.partido})
                  </li>
                ))}
              </ul>
            </div>
          </div>
        );
      case "Controle de Tribuna":
        return (
          <div className="tribuna-bloco">
            <h4>Tribuna — Oradores da Sessão</h4>
            <table className="tribuna-table" style={{ width: "100%", marginBottom: 18 }}>
              <thead>
                <tr>
                  <th>Ordem</th>
                  <th>Nome</th>
                  <th>Partido</th>
                  <th>Tempo Fala (s)</th>
                  <th>Saldo (s)</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {oradores.map((o, idx) => (
                  <tr key={o.id} style={{ background: idx === oradorAtivoIdx ? "#e3ffe3" : undefined }}>
                    <td>{idx + 1}</td>
                    <td>{o.nome}</td>
                    <td>{o.partido}</td>
                    <td>
                      <input
                        type="number"
                        value={o.tempoFala}
                        onChange={e => alterarTempoFala(idx, e.target.value)}
                        style={{ width: 60 }}
                        disabled={idx !== oradorAtivoIdx}
                      />
                      {!o.externo && (
                        <>
                          <button onClick={() => usarSaldoHoras(idx)} style={{ marginLeft: 8 }} title="Usar saldo">
                            Usar Saldo
                          </button>
                          <input
                            type="number"
                            value={tempoExtra}
                            onChange={e => setTempoExtra(e.target.value)}
                            style={{ width: 60, marginLeft: 8 }}
                            placeholder="Tempo extra"
                          />
                          <button onClick={() => adicionarTempoExtra(idx)} style={{ marginLeft: 8 }}>
                            + Tempo Extra
                          </button>
                        </>
                      )}
                    </td>
                    <td>{o.saldo || 0}</td>
                    <td>
                      <button onClick={() => setOradorAtivoIdx(idx)}>▶ Iniciar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {oradorAtivoIdx >= 0 && (
              <div style={{ padding: 12, border: "1px solid #ccc", borderRadius: 8, marginBottom: 12 }}>
                <h5>Orador Ativo: {oradores[oradorAtivoIdx].nome} ({oradores[oradorAtivoIdx].partido})</h5>
                <p>
                  Tempo restante: {tempoRestante}s{" "}
                  <button onClick={cronometroAtivo ? pausarFala : iniciarFala}>
                    {cronometroAtivo ? "Pausar" : "Iniciar"}
                  </button>
                  <button onClick={encerrarFala} style={{ marginLeft: 10 }}>Encerrar Fala</button>
                  <button onClick={proximoOrador} style={{ marginLeft: 10 }}>Próximo Orador</button>
                </p>
                <textarea
                  placeholder="Digite o resumo da fala..."
                  value={resumoFala}
                  onChange={e => setResumoFala(e.target.value)}
                  style={{ width: "100%", minHeight: 40, marginTop: 10 }}
                />
              </div>
            )}
            <div>
              <b>Resumos das Falas:</b>
              <ul>
                {oradores.filter(o => o.fala).map((o, idx) => (
                  <li key={idx}><b>{o.nome}:</b> {o.fala} <span style={{ color: "#888" }}>{o.horario || ""}</span></li>
                ))}
              </ul>
            </div>
            <button onClick={zerarSaldos} style={{ marginTop: 18, color: "#a00" }}>
              Zerar Saldos (ao Encerrar Sessão)
            </button>
          </div>
        );
      case "Controle de Presença":
        return (
          <div>
            <h4>Registro de Presença dos Vereadores</h4>
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
                        checked={habilitados.includes(v.id)}
                        onChange={() => {
                          const novo = habilitados.includes(v.id)
                            ? habilitados.filter((x) => x !== v.id)
                            : [...habilitados, v.id];
                          setHabilitados(novo);
                          updateDoc(doc(db, "painelAtivo", "ativo"), {
                            habilitados: novo
                          });
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      case "IA":
        return (
          <div className="painel-ia-institucional">
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <span style={{ fontSize: 26, color: "#1460a0" }}>🤖</span>
              <h3 style={{ margin: 0 }}>Recursos de Inteligência Artificial</h3>
            </div>
            <div className="area-ia-flex">
              <div style={{ flex: 1, marginRight: 18 }}>
                <b>Pergunte à IA:</b>
                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  <input
                    type="text"
                    value={abaIApergunta}
                    onChange={e => setAbaIApergunta(e.target.value)}
                    placeholder="Ex: Quem foi o último orador?"
                    style={{ flex: 1 }}
                  />
                  <button onClick={perguntarIA} disabled={!abaIApergunta}>
                    Perguntar
                  </button>
                </div>
                {abaIAresposta && (
                  <div className="ia-bloco-resposta" style={{ marginTop: 8 }}>
                    {abaIAresposta}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      case "ATA":
        return (
          <div className="ata-construtor">
            <h3>Construtor de ATA</h3>
            <button onClick={gerarTextoPadraoAta} style={{ marginBottom: 10 }}>
              Gerar texto padrão
            </button>
            <textarea
              style={{ width: "100%", minHeight: 200, marginBottom: 8 }}
              value={ataEditor}
              onChange={e => setAtaEditor(e.target.value)}
              placeholder="Texto da ata da sessão..."
            />
            <div>
              <b>Assinaturas:</b>
              <ul>
                {(sessaoAtiva?.mesa || []).map((m, idx) => (
                  <li key={idx}>
                    <label>
                      <input
                        type="checkbox"
                        checked={assinaturas.includes(m.vereador)}
                        onChange={() => {
                          setAssinaturas(a =>
                            a.includes(m.vereador)
                              ? a.filter(x => x !== m.vereador)
                              : [...a, m.vereador]
                          );
                        }}
                      />
                      {m.vereador} ({m.cargo})
                    </label>
                  </li>
                ))}
              </ul>
            </div>
            <button onClick={salvarAta} disabled={carregandoAta}>
              {carregandoAta ? "Salvando..." : "Salvar ATA"}
            </button>
          </div>
        );
      default:
        return null;
    }
  }

  // ----------- RENDER PRINCIPAL -----------
  return (
    <div className="votacao-container">
      <TopoInstitucional
        legislatura={legislaturaSelecionada}
        sessao={sessaoAtiva}
        presidente={sessaoAtiva?.presidente}
        data={sessaoAtiva?.data}
      />
      <h2 className="painel-titulo">Painel de Controle de Sessões Plenárias</h2>
      <div className="abas-votacao">
        {[
          "Controle de Sessão",
          "Controle de Votação",
          "Controle de Tribuna",
          "Controle de Presença",
          "IA",
          "ATA"
        ].map(tab => (
          <button
            key={tab}
            className={`aba-btn ${aba === tab ? "ativo" : ""}`}
            onClick={() => setAba(tab)}
          >{tab}</button>
        ))}
      </div>
      <div className="conteudo-aba">
        {/* RENDERIZE AQUI SUAS ABAS/JSX, CONFORME JÁ ESTAVA NO SEU CÓDIGO */}
      </div>
    </div>
  );
}
