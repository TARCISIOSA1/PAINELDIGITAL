import React, { useEffect, useState, useRef } from "react";
import {
  collection,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  setDoc,
  addDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import TopoInstitucional from "./TopoInstitucional";
import { FaArrowUp, FaArrowDown } from "react-icons/fa";
import panelConfig from "../config/panelConfig.json";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import "./Votacao.css";

// ---------------------
// REGRAS DE QUÓRUM
const QUORUM_OPTIONS = [
  { label: "Quórum Simples", value: "simples", regra: "Maioria simples dos presentes (n/2 + 1)", formula: n => Math.ceil(n / 2) },
  { label: "Quórum de Suspensão", value: "suspensao", regra: "1/3 dos vereadores", formula: n => Math.ceil(n / 3) },
  { label: "Quórum de Votação", value: "votacao", regra: "Maioria absoluta (50%+1 dos membros)", formula: n => Math.ceil(n / 2) + 1 },
  { label: "Quórum Qualificado", value: "qualificado", regra: "2/3 dos membros", formula: n => Math.ceil(n * 2 / 3) },
];

// ---------------------
// Função de persistência completa
async function atualizarPainelAtivo(
  sessao,
  materias,
  habilitados,
  statusSessao,
  votacaoAtualExtra = {},
  tribunaAtual = {}
) {
  if (!sessao) return;
  const painelRef = doc(db, "painelAtivo", "ativo");
  await setDoc(
    painelRef,
    {
      // Sessão
      idSessao: sessao.id,
      statusSessao: statusSessao || sessao.status,
      titulo: sessao.titulo || "-",
      data: sessao.data || "",
      hora: sessao.hora || "",
      presidente: sessao.presidente || "",
      secretario: sessao.secretario || "",

      // Ordem do dia e presença
      ordemDoDia: materias || [],
      presentes: sessao.presentes || [],

      // Votação
      votacaoAtual: {
        idSessao: sessao.id,
        statusSessao: statusSessao || sessao.status || "preparando",
        materia: materias?.find(m => m.status === "em_votacao")?.titulo || "",
        idMateria: materias?.find(m => m.status === "em_votacao")?.id || "",
        tipo: sessao.tipoVotacao || "Simples",
        autor: materias?.find(m => m.status === "em_votacao")?.autor || "-",
        status: votacaoAtualExtra.status || "preparando",
        habilitados: votacaoAtualExtra.habilitados || habilitados || [],
        votos: votacaoAtualExtra.votos || {},
        tempoVotacao: votacaoAtualExtra.tempoVotacao || tempoVotacao || 60,
        ...votacaoAtualExtra
      },

      // Tribuna
      tribunaAtual: {
        nome: tribunaAtual.nome || "",
        partido: tribunaAtual.partido || "",
        tempoRestante: tribunaAtual.tempoRestante || 0,
        cronometroAtivo: tribunaAtual.cronometroAtivo || false,
        textoBruto: tribunaAtual.textoBruto || "",
        ...tribunaAtual
      }
    },
    { merge: true }
  );
}

export default function Votacao() {
  // ------------------------ ESTADOS GERAIS ------------------------
  const [aba, setAba] = useState("Controle de Sessão");
  const [sessaoAtiva, setSessaoAtiva] = useState(null);
  const [materias, setMaterias] = useState([]);
  const [materiasSelecionadas, setMateriasSelecionadas] = useState([]);
  const [materiaSelecionada, setMateriaSelecionada] = useState(null);
  const [vereadores, setVereadores] = useState([]);
  const [habilitados, setHabilitados] = useState([]);
  const [tipoVotacao, setTipoVotacao] = useState("Simples");
  const [modalidade, setModalidade] = useState("Unica");
  const [statusVotacao, setStatusVotacao] = useState("Preparando");
  const [quorumTipo, setQuorumTipo] = useState("simples");
  const [quorumMinimo, setQuorumMinimo] = useState(0);
  const [tempoVotacao, setTempoVotacao] = useState(60);
  const [tempoRestante, setTempoRestante] = useState(60);
  const tempoVotacaoInterval = useRef(null);
  const [ataCorrigida, setAtaCorrigida] = useState("");
  const [carregandoAta, setCarregandoAta] = useState(false);

  // Tribuna
  const [oradorSelecionado, setOradorSelecionado] = useState("");
  const [tempoFala, setTempoFala] = useState(180);
  const [tempoRestanteTribuna, setTempoRestanteTribuna] = useState(180);
  const [cronometroAtivoTribuna, setCronometroAtivoTribuna] = useState(false);
  const tribunaInterval = useRef(null);
  const [bancoHoras, setBancoHoras] = useState({});
  const [usarSaldo, setUsarSaldo] = useState(false);
  const [bancoUsarTempo, setBancoUsarTempo] = useState(0);
  const [tempoSalvo, setTempoSalvo] = useState(false);

  // Legislatura
  const [legislaturas, setLegislaturas] = useState([]);
  const [legislaturaSelecionada, setLegislaturaSelecionada] = useState(null);
  const [numeroSessaoOrdinaria, setNumeroSessaoOrdinaria] = useState(0);
  const [numeroSessaoLegislativa, setNumeroSessaoLegislativa] = useState(0);

  // --------------------- LOADS INIT ---------------------
  useEffect(() => {
    carregarSessaoAtivaOuPrevista();
    carregarVereadores();
    carregarBancoHoras();
  }, []);

  useEffect(() => {
    const opt = QUORUM_OPTIONS.find(o => o.value === quorumTipo);
    if (opt) setQuorumMinimo(opt.formula(vereadores.length));
  }, [quorumTipo, vereadores.length]);

  // Persistência habilitados
  useEffect(() => {
    async function syncHabilitados() {
      const painelDoc = await getDoc(doc(db, "painelAtivo", "ativo"));
      if (painelDoc.exists() && painelDoc.data()?.votacaoAtual?.habilitados) {
        setHabilitados(painelDoc.data().votacaoAtual.habilitados);
      }
    }
    syncHabilitados();
  }, [sessaoAtiva]);

  // ----------------- FUNÇÕES DE FIRESTORE -----------------
  async function carregarSessaoAtivaOuPrevista() {
    const snapshot = await getDocs(collection(db, "sessoes"));
    const lista = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    let sessao = lista.find(s => s.status === "Ativa");
    if (!sessao) sessao = lista.find(s => ["Prevista","Suspensa","Pausada"].includes(s.status));
    if (sessao) {
      setSessaoAtiva(sessao);
      setMaterias(sessao.ordemDoDia || []);
      setMateriasSelecionadas(sessao.ordemDoDia?.filter(m => m.status !== "votada").map(m => m.id) || []);
      setTipoVotacao(sessao.tipoVotacao || "Simples");
      setModalidade(sessao.modalidade || "Unica");
      setMateriaSelecionada(sessao.ordemDoDia?.find(m => m.status === "em_votacao")?.id || null);
      if (sessao.presentes?.length) {
        setHabilitados(sessao.presentes.map(p => p.id));
        await atualizarPainelAtivo(sessao, sessao.ordemDoDia || [], sessao.presentes.map(p => p.id), sessao.status);
      }
    } else {
      setSessaoAtiva(null);
      setMaterias([]);
      setMateriasSelecionadas([]);
      setTipoVotacao("Simples");
      setModalidade("Unica");
      setStatusVotacao("Preparando");
      setHabilitados([]);
    }
  }

  async function carregarVereadores() {
    const snap = await getDocs(collection(db, "parlamentares"));
    setVereadores(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }

  async function carregarBancoHoras() {
    const snap = await getDocs(collection(db, "bancoHoras"));
    const dados = {};
    snap.docs.forEach(d => { dados[d.id] = d.data().tempo || 0; });
    setBancoHoras(dados);
  }

  // ---------------- CONTROLE DE SESSÃO ----------------
  async function alterarStatusSessao(novoStatus) {
    if (!sessaoAtiva) return;
    await updateDoc(doc(db, "sessoes", sessaoAtiva.id), { status: novoStatus });
    setSessaoAtiva(prev => ({ ...prev, status: novoStatus }));
    await atualizarPainelAtivo(sessaoAtiva, materias, habilitados, novoStatus);
    if (novoStatus === "Encerrada") await gerarAtaCorrigida();
  }

  async function iniciarSessao() {
    if (!sessaoAtiva) return;
    await updateDoc(doc(db, "sessoes", sessaoAtiva.id), { status: "Ativa" });
    setSessaoAtiva(prev => ({ ...prev, status: "Ativa" }));
    await atualizarPainelAtivo(sessaoAtiva, materias, habilitados, "Ativa");
  }

  // ------------- HABILITADOS -------------
  async function handleHabilitar(id) {
    const novo = habilitados.includes(id) ? habilitados.filter(x => x !== id) : [...habilitados, id];
    setHabilitados(novo);
    await atualizarPainelAtivo(sessaoAtiva, materias, novo, sessaoAtiva.status);
  }

  // ------------- VOTAÇÃO -------------
  async function iniciarVotacao() {
    if (!sessaoAtiva || !materiaSelecionada) return;
    if (habilitados.length < quorumMinimo) { alert("Quórum mínimo não atingido!"); return; }
    const novaOrdem = materias.map(m => m.id===materiaSelecionada ? {...m, status: "em_votacao"} : m);
    setMaterias(novaOrdem);
    await updateDoc(doc(db, "sessoes", sessaoAtiva.id), { ordemDoDia: novaOrdem });
    await atualizarPainelAtivo(sessaoAtiva, novaOrdem, habilitados, sessaoAtiva.status, { status: "em_votacao", tempoVotacao, habilitados, votos: {} });
    setStatusVotacao("Em Andamento"); setTempoRestante(tempoVotacao);
    clearInterval(tempoVotacaoInterval.current);
    tiempo
