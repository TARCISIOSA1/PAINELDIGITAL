// PAINEL DE CONTROLE//
// ========================== PARTE 1/4 ==========================
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

/* ===================== COMPONENTE: LEGENDA WHISPER ===================== */
function LegendaWhisper({ orador, ativa, onLegenda }) {
  const [legenda, setLegenda] = useState("");
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    setLegenda("");
    if (!ativa) {
      stopRecording();
      return;
    }
    startRecording();
    return () => { stopRecording(); };
  }, [ativa, orador?.id]);

  async function startRecording() {
    if (!orador) return;
    if (!navigator.mediaDevices?.getUserMedia) return alert("Áudio não suportado.");
    streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorderRef.current = new window.MediaRecorder(streamRef.current, { mimeType: "audio/webm" });
    let chunks = [];
    mediaRecorderRef.current.ondataavailable = (e) => {
      chunks.push(e.data);
    };
    mediaRecorderRef.current.onstop = async () => {
      const blob = new Blob(chunks, { type: "audio/webm" });
      chunks = [];
      const formData = new FormData();
      formData.append("file", blob, "audio.webm");
      formData.append("orador", orador.nome || "Orador");
      try {
        const r = await fetch("http://localhost:3333/api/whisper", {
          method: "POST",
          body: formData,
        });
        const { textoCorrigido } = await r.json();
        setLegenda(textoCorrigido);
        onLegenda && onLegenda(`${orador.nome || "Orador"}: ${textoCorrigido}`);
      } catch (err) {
        setLegenda("Erro ao transcrever áudio.");
      }
    };
    mediaRecorderRef.current.start();
    setLegenda("Gravando...");
  }

  function stopRecording() {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    }
  }

  return (
    <div style={{ marginTop: 10, marginBottom: 10 }}>
      <div>
        <b>Legenda IA:</b>{" "}
        <span style={{ background: "#eee", padding: 4, borderRadius: 4 }}>
          {legenda || <i>(Sem legenda no momento)</i>}
        </span>
      </div>
    </div>
  );
}

/* ===================== FUNÇÃO: SALVAR PAINEL ATIVO COMPLETO ===================== */
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
  pauta,
  pedidosTribuna,
  transferenciasTempo
}) {
  try {
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
        transferenciasTempo: transferenciasTempo || [],
      },
      pedidosTribuna: pedidosTribuna || [],
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
  } catch (err) {
    alert("Erro ao salvar painel ativo: " + err.message);
  }
}
// ========================== PARTE 2/4 ==========================

/* ===================== COMPONENTE PRINCIPAL: VOTACAO ===================== */
export default function Votacao() {
  // ================= ESTADOS =================
  // --- Estados Gerais da Sessão
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
  const [tempoVotacao, setTempoVotacao] = useState("");

  // --- Estados da Tribuna
  const [oradores, setOradores] = useState([]);
  const [tempoPadrao] = useState(180);
  const [oradorAtivoIdx, setOradorAtivoIdx] = useState(-1);
  const [tempoRestante, setTempoRestante] = useState(0);
  const [cronometroAtivo, setCronometroAtivo] = useState(false);
  const [resumoFala, setResumoFala] = useState("");
  const [bancoHoras, setBancoHoras] = useState({});
  const [pedidosTribuna, setPedidosTribuna] = useState([]);
  const [transferenciasTempo, setTransferenciasTempo] = useState([]);

  // --- Outros estados auxiliares
  const [legislaturas, setLegislaturas] = useState([]);
  const [legislaturaSelecionada, setLegislaturaSelecionada] = useState(null);
  const [numeroSessaoOrdinaria, setNumeroSessaoOrdinaria] = useState(0);
  const [numeroSessaoLegislativa, setNumeroSessaoLegislativa] = useState(0);
  const [abaIApergunta, setAbaIApergunta] = useState("");
  const [abaIAresposta, setAbaIAresposta] = useState("");
  const [ataEditor, setAtaEditor] = useState("");
  const [assinaturas, setAssinaturas] = useState([]);
  const [carregandoAta, setCarregandoAta] = useState(false);

  const intervalRef = useRef(null);

  // ===================== USEEFFECTS =====================
  // Carrega sessão, legislatura, vereadores e banco de horas ao iniciar
  useEffect(() => {
    async function carregarSessaoAtivaOuPrevista() {
      try {
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
      } catch (err) {
        alert("Erro ao carregar sessão ativa: " + err.message);
      }
    }

    async function carregarLegislaturaEContagem() {
      try {
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
      } catch (err) {
        alert("Erro ao carregar legislatura: " + err.message);
      }
    }

    async function carregarVereadores() {
      try {
        const snap = await getDocs(collection(db, "parlamentares"));
        setVereadores(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      } catch (err) {
        alert("Erro ao carregar vereadores: " + err.message);
      }
    }

    async function carregarBancoHoras() {
      try {
        const snap = await getDocs(collection(db, "bancoHoras"));
        const dados = {};
        snap.docs.forEach((doc) => {
          dados[doc.id] = doc.data().tempo || 0;
        });
        setBancoHoras(dados);
      } catch {}
    }

    carregarSessaoAtivaOuPrevista();
    carregarLegislaturaEContagem();
    carregarVereadores();
    carregarBancoHoras();
  }, []);

  // Carrega painelAtivo (dados sincronizados do Firestore)
  useEffect(() => {
    async function carregarPainelAtivo() {
      const painelSnap = await getDoc(doc(db, "painelAtivo", "ativo"));
      if (painelSnap.exists()) {
        const data = painelSnap.data();
        setPedidosTribuna(data.pedidosTribuna || []);
        setTransferenciasTempo(data.tribuna?.transferenciasTempo || []);
        setOradores(data.tribuna?.oradores || []);
        setOradorAtivoIdx(data.tribuna?.oradorAtivoIdx ?? -1);
        setTempoRestante(data.tribuna?.tempoRestante ?? 0);
        setCronometroAtivo(data.tribuna?.cronometroAtivo ?? false);
        setResumoFala(data.tribuna?.resumoFala ?? "");
        setBancoHoras(data.tribuna?.bancoHoras ?? {});
      }
    }
    carregarPainelAtivo();
  }, []);

  // Atualiza quorumMinimo sempre que muda o tipo de quorum ou número de vereadores
  useEffect(() => {
    const opt = QUORUM_OPTIONS.find(o => o.value === quorumTipo);
    if (opt) setQuorumMinimo(opt.formula(vereadores.length));
  }, [quorumTipo, vereadores.length]);

  // Salva tudo no painelAtivo sempre que qualquer coisa importante muda
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
      votos: {},
      painelRTC: null,
      observacoes: sessaoAtiva?.observacoes || "",
      pauta: sessaoAtiva?.pauta || "",
      pedidosTribuna,
      transferenciasTempo
    });
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
    tempoVotacao,
    pedidosTribuna,
    transferenciasTempo
  ]);

  // Cronômetro da tribuna
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

  // Salva tribunaAtual no painelAtivo sempre que os principais dados mudam
  useEffect(() => {
    updateDoc(doc(db, "painelAtivo", "ativo"), {
      tribunaAtual: {
        oradores,
        oradorAtivoIdx,
        tempoRestante,
        resumoFala,
        cronometroAtivo
      }
    }).catch(() => {});
  }, [oradores, oradorAtivoIdx, tempoRestante, resumoFala, cronometroAtivo]);

// ========================== PARTE 3/4 ==========================

  // ===================== FUNÇÕES DE FLUXO =====================

  // ---------- Aceitar pedido de fala ----------
  function aceitarPedidoFala(idx) {
    const pedido = pedidosTribuna[idx];
    const tempo = parseInt(prompt("Tempo de fala (segundos) para este orador?", "120"), 10);
    if (!tempo || tempo < 1) return;
    setPedidosTribuna(pt => pt.map((p, i) =>
      i === idx ? { ...p, status: "Aceito" } : p
    ));
    setOradores(prev =>
      prev.some(o => o.id === pedido.id)
        ? prev
        : [...prev, {
          id: pedido.id,
          nome: pedido.nome,
          partido: pedido.partido,
          tempoFala: tempo,
          saldo: 0,
          fala: "",
          externo: false,
        }]
    );
  }

  // ---------- Negar pedido de fala ----------
  function negarPedidoFala(idx) {
    setPedidosTribuna(pt => pt.map((p, i) =>
      i === idx ? { ...p, status: "Rejeitado" } : p
    ));
  }

  // ---------- Adicionar orador extra (manual) ----------
  function adicionarOradorExtra() {
    const nome = prompt("Nome do orador externo:");
    if (!nome) return;
    setOradores(prev => [...prev, {
      id: "extra-" + Date.now(),
      nome,
      partido: "-",
      tempoFala: 120,
      saldo: 0,
      fala: "",
      externo: true
    }]);
  }

  // ---------- Adicionar pequena tribuna ----------
  function pequenaTribuna(idx) {
    const lista = [...oradores];
    lista[idx].tempoFala = 60;
    lista[idx].fala = "[Pequena Tribuna]";
    setOradores(lista);
  }

  // ---------- Iniciar fala do orador ----------
  function iniciarFala() {
    if (oradorAtivoIdx < 0) return;
    setTempoRestante(oradores[oradorAtivoIdx].tempoFala);
    setCronometroAtivo(true);
  }

  // ---------- Pausar fala do orador ----------
  function pausarFala() {
    setCronometroAtivo(false);
  }

  // ---------- Encerrar fala do orador ----------
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

  // ---------- Próximo orador ----------
  function proximoOrador() {
    if (oradorAtivoIdx < oradores.length - 1) {
      setOradorAtivoIdx(oradorAtivoIdx + 1);
      setTempoRestante(oradores[oradorAtivoIdx + 1].tempoFala);
      setResumoFala("");
      setCronometroAtivo(false);
    }
  }

  // ---------- Alterar tempo de fala do orador ----------
  function alterarTempoFala(idx, valor) {
    const lista = [...oradores];
    lista[idx].tempoFala = parseInt(valor) || tempoPadrao;
    setOradores(lista);
  }

  // ---------- Zerar saldos de todos os oradores ----------
  function zerarSaldos() {
    setBancoHoras({});
    setOradores(oradores.map(o => ({ ...o, saldo: 0 })));
    updateDoc(doc(db, "painelAtivo", "ativo"), { bancoHoras: {} });
  }

  // ---------- Ceder tempo entre oradores ----------
  async function cederTempo() {
    if (oradorAtivoIdx < 0) return;
    const outros = oradores.filter((_, i) => i !== oradorAtivoIdx);
    if (outros.length === 0) return alert("Nenhum outro orador para receber tempo.");
    const escolhido = prompt("ID do orador que vai receber tempo:\n" +
      outros.map(o => `${o.nome} (${o.id})`).join("\n"));
    const idxEscolhido = oradores.findIndex(o => o.id === escolhido);
    if (idxEscolhido < 0) return alert("Orador não encontrado.");
    const tempo = parseInt(prompt("Quantos segundos quer ceder? (Total disponível: " + tempoRestante + ")"), 10);
    if (!tempo || tempo <= 0 || tempo > tempoRestante) return alert("Tempo inválido.");
    const novaLista = [...oradores];
    novaLista[oradorAtivoIdx].tempoFala -= tempo;
    novaLista[idxEscolhido].tempoFala += tempo;
    setOradores(novaLista);
    setTempoRestante(r => r - tempo);
    setTransferenciasTempo(prev => [...prev, {
      de: oradores[oradorAtivoIdx].nome,
      para: oradores[idxEscolhido].nome,
      tempo,
      horario: new Date().toISOString()
    }]);
    setResumoFala(f => f + ` [${oradores[oradorAtivoIdx].nome} cedeu ${tempo}s para ${oradores[idxEscolhido].nome}]`);
    await updateDoc(doc(db, "painelAtivo", "ativo"), {
      "tribunaAtual.cedencias": [
        ...(oradores[oradorAtivoIdx].cedencias || []),
        {
          de: oradores[oradorAtivoIdx].nome,
          para: oradores[idxEscolhido].nome,
          tempo
        }
      ]
    });
  }

  // ---------- Zerar painelAtivo (apagar tudo da sessão no painelAtivo) ----------
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

  // ---------- Alterar status da sessão ----------
  async function alterarStatusSessao(novoStatus) {
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
  }

  // ---------- Iniciar sessão ----------
  async function iniciarSessao() {
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
  }

  // ---------- Mover matéria na ordem do dia ----------
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

  // ---------- Iniciar votação ----------
  async function iniciarVotacao() {
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
  }

  // ---------- Pausar votação ----------
  async function pausarVotacao() {
    setStatusVotacao("Pausada");
    await updateDoc(doc(db, "painelAtivo", "ativo"), {
      "votacaoAtual.status": "pausada",
    }).catch(() => { });
  }

  // ---------- Retomar votação ----------
  async function retomarVotacao() {
    setStatusVotacao("Em Andamento");
    await updateDoc(doc(db, "painelAtivo", "ativo"), {
      "votacaoAtual.status": "em_votacao",
    }).catch(() => { });
  }

  // ---------- Encerrar votação ----------
  async function encerrarVotacao() {
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
  }

  // ---------- Selecionar/deselecionar matéria ----------
  function toggleMateria(id) {
    if (modalidade === "Lote") {
      setMateriasSelecionadas((prev) =>
        prev.includes(id)
          ? prev.filter((m) => m !== id)
          : [...prev, id]
      );
    } else {
      setMateriasSelecionadas([id]);
    }
  }

  // ---------- Perguntar para IA (chatbot institucional) ----------
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

  // ---------- Salvar ata (minuta) ----------
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

  // ---------- Gerar texto padrão da ata ----------
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
// ========================== PARTE 4/4 ==========================

  // ===================== RENDER: ABAS DO PAINEL =====================
  function renderConteudoAba() {
    switch (aba) {

      // ================== ABA 1: CONTROLE DE SESSÃO ==================
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

      // ================== ABA 2: CONTROLE DE VOTAÇÃO ==================
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
                    ({quorumMinimo} vereadores) <span style={{ color: "#888", fontWeight: 400 }} title={quorumObj?.regra}>{quorumObj?.regra}</span>
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

      // ================== ABA 3: CONTROLE DE TRIBUNA ==================
      case "Controle de Tribuna":
        return (
          <div className="tribuna-bloco">
            <h4>Tribuna — Oradores da Sessão</h4>
            {/* LISTA DE PEDIDOS DE FALA */}
            <div>
              <b>Pedidos de Fala:</b>
              <ul>
                {pedidosTribuna.length === 0 && <li style={{ color: "#888" }}>(Sem pedidos de fala)</li>}
                {pedidosTribuna.map((p, idx) => (
                  <li key={p.id}>
                    <img src={p.foto || "/default.png"} alt={p.nome} width={28} style={{ borderRadius: 14, marginRight: 6, verticalAlign: "middle" }} />
                    <b>{p.nome}</b>
                    {" "}
                    {p.status === "Em Análise" && (
                      <>
                        <button onClick={() => aceitarPedidoFala(idx)} style={{ marginLeft: 10, color: "green" }}>Aceitar</button>
                        <button onClick={() => negarPedidoFala(idx)} style={{ marginLeft: 6, color: "red" }}>Negar</button>
                      </>
                    )}
                    {p.status !== "Em Análise" && <span style={{ marginLeft: 8, color: "#888" }}>{p.status}</span>}
                  </li>
                ))}
              </ul>
            </div>
            {/* TABELA DE ORADORES */}
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
                          <button onClick={() => pequenaTribuna(idx)} style={{ marginLeft: 8 }}>+ Pequena Tribuna</button>
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
            {/* BOTÃO ADICIONAR ORADOR EXTRA */}
            <button style={{ marginBottom: 8 }} onClick={adicionarOradorExtra}>
              + Orador Externo
            </button>
            {/* BLOCO DE CONTROLE DO ORADOR ATIVO */}
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
                  <button
                    style={{ marginLeft: 10, background: "#e66", color: "#fff" }}
                    onClick={async () => {
                      setOradorAtivoIdx(-1);
                      setTempoRestante(0);
                      setCronometroAtivo(false);
                      await updateDoc(doc(db, "painelAtivo", "ativo"), {
                        "tribunaAtual.ativa": false
                      });
                    }}
                  >Encerrar Tribuna</button>
                  <button
                    style={{ marginLeft: 10, background: "#fb0" }}
                    onClick={cederTempo}
                  >Ceder Tempo</button>
                </p>
                {/* LEGENDA DE ÁUDIO IA */}
                <LegendaWhisper
                  orador={oradores[oradorAtivoIdx]}
                  ativa={cronometroAtivo}
                  onLegenda={async (texto) => {
                    setResumoFala(texto);
                    const lista = [...oradores];
                    lista[oradorAtivoIdx].fala = texto;
                    setOradores(lista);
                    await updateDoc(doc(db, "painelAtivo", "ativo"), {
                      "tribunaAtual.oradores": lista,
                      "tribunaAtual.resumoFala": texto
                    });
                  }}
                />
                <textarea
                  placeholder="Digite/resumo da fala (ou use a legenda)..."
                  value={resumoFala}
                  onChange={e => setResumoFala(e.target.value)}
                  style={{ width: "100%", minHeight: 40, marginTop: 10 }}
                />
              </div>
            )}
            {/* RESUMOS DAS FALAS E TRANSFERÊNCIAS */}
            <div>
              <b>Resumos das Falas:</b>
              <ul>
                {oradores.filter(o => o.fala).map((o, idx) => (
                  <li key={idx}><b>{o.nome}:</b> {o.fala} <span style={{ color: "#888" }}>{o.horario || ""}</span></li>
                ))}
              </ul>
              {transferenciasTempo?.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <b>Transferências de Tempo:</b>
                  <ul>
                    {transferenciasTempo.map((t, i) => (
                      <li key={i}>{t.de} cedeu {t.tempo}s para {t.para} ({new Date(t.horario).toLocaleTimeString()})</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            {/* BOTÃO ZERAR SALDOS */}
            <button onClick={zerarSaldos} style={{ marginTop: 18, color: "#a00" }}>
              Zerar Saldos (ao Encerrar Sessão)
            </button>
          </div>
        );

      // ================== ABA 4: CONTROLE DE PRESENÇA ==================
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

      // ================== ABA 5: INTELIGÊNCIA ARTIFICIAL ==================
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

      // ================== ABA 6: ATA ==================
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

      // ================== ABA PADRÃO ==================
      default:
        return null;
    }
  }

  // ===================== LAYOUT PRINCIPAL =====================
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
        {renderConteudoAba()}
      </div>
    </div>
  );
}

// ========================== FIM DO ARQUIVO ==========================
