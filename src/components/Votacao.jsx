import React, { useEffect, useState, useRef } from "react";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  setDoc,
  addDoc,
  getDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import TopoInstitucional from "./TopoInstitucional";
import { FaArrowUp, FaArrowDown } from "react-icons/fa";
import "./Votacao.css";

const QUORUM_OPTIONS = [
  { label: "Quórum Simples", value: "simples", regra: "Maioria simples dos presentes (n/2 + 1)", formula: n => Math.ceil(n / 2) },
  { label: "Quórum de Suspensão", value: "suspensao", regra: "1/3 dos vereadores", formula: n => Math.ceil(n / 3) },
  { label: "Quórum de Votação", value: "votacao", regra: "Maioria absoluta (50%+1 dos membros)", formula: n => Math.ceil(n / 2) + 1 },
  { label: "Quórum Qualificado", value: "qualificado", regra: "2/3 dos membros", formula: n => Math.ceil(n * 2 / 3) },
];

export default function Votacao() {
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

  // TRIBUNA
  const [tempoFala, setTempoFala] = useState(180);
  const [tempoRestante, setTempoRestante] = useState(180);
  const [cronometroAtivo, setCronometroAtivo] = useState(false);
  const intervalRef = useRef(null);
  const [oradorSelecionado, setOradorSelecionado] = useState("");
  const [bancoHoras, setBancoHoras] = useState({});
  const [usarSaldo, setUsarSaldo] = useState(false);
  const [bancoUsarTempo, setBancoUsarTempo] = useState(0);
  const [tempoSalvo, setTempoSalvo] = useState(false);

  // Legislatura / Sessão
  const [legislaturas, setLegislaturas] = useState([]);
  const [legislaturaSelecionada, setLegislaturaSelecionada] = useState(null);
  const [numeroSessaoOrdinaria, setNumeroSessaoOrdinaria] = useState(0);
  const [numeroSessaoLegislativa, setNumeroSessaoLegislativa] = useState(0);

  // IA/ATA
  const [ataCorrigida, setAtaCorrigida] = useState("");
  const [carregandoAta, setCarregandoAta] = useState(false);
  const [perguntaIA, setPerguntaIA] = useState("");
  const [respostaIA, setRespostaIA] = useState("");
  const [carregandoPergunta, setCarregandoPergunta] = useState(false);

  function gerarDadosSessaoPainel() {
    return {
      data: sessaoAtiva?.data || "",
      hora: sessaoAtiva?.hora || "",
      local: sessaoAtiva?.local || "",
      presidente: sessaoAtiva?.presidente || "",
      secretario: sessaoAtiva?.secretario || "",
      tipo: sessaoAtiva?.tipo || "",
      titulo: sessaoAtiva?.titulo || "",
      legislatura: legislaturaSelecionada?.descricao || "",
      numeroSessaoPlenaria: numeroSessaoOrdinaria || "",
      numeroSessaoLegislativa: numeroSessaoLegislativa || "",
    };
  }

  // ---------- INICIALIZAÇÃO/FIREBASE ----------
  useEffect(() => {
    carregarSessaoAtivaOuPrevista();
    carregarVereadores();
    carregarBancoHoras();
    buscarHabilitadosPainel(); // busca do Firestore ao abrir!
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
      const sessoes = sessoesSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      const sessoesDaLegislatura = sessoes.filter(
        s => s.idLegislatura === ativa.id && s.tipo === "Ordinária"
      );
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

  // Busca habilitados do painelAtivo ao abrir
  async function buscarHabilitadosPainel() {
    try {
      const docSnap = await getDoc(doc(db, "painelAtivo", "ativo"));
      const v = docSnap.data()?.votacaoAtual?.habilitados || [];
      setHabilitados(Array.isArray(v) ? v : []);
    } catch { setHabilitados([]); }
  }

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
      // NÃO setHabilitados aqui! Só pela função buscarHabilitadosPainel()
      setTipoVotacao(sessao.tipoVotacao || "Simples");
      setModalidade(sessao.modalidade || "Unica");
    } else {
      setSessaoAtiva(null);
      setMaterias([]);
      setMateriasSelecionadas([]);
      setHabilitados([]);
      setTipoVotacao("Simples");
      setModalidade("Unica");
      setStatusVotacao("Preparando");
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

  // ATUALIZA PAINEL CAMPOS GERAIS
  async function atualizarPainelCamposGerais(statusSessaoCustom = null) {
    const painelRef = doc(db, "painelAtivo", "ativo");
    await setDoc(
      painelRef,
      {
        ...gerarDadosSessaoPainel(),
        statusSessao: statusSessaoCustom || sessaoAtiva?.status || "Ativa",
      },
      { merge: true }
    );
  }

  // ---------- HABILITADOS: PERSISTE SEMPRE ----------
  const atualizarHabilitadosPainel = async (novo) => {
    // Atualiza painelAtivo/ativo
    await updateDoc(doc(db, "painelAtivo", "ativo"), {
      "votacaoAtual.habilitados": novo,
    });
    // Atualiza presentes na sessão (opcional, mas útil)
    if (sessaoAtiva) {
      const sessaoRef = doc(db, "sessoes", sessaoAtiva.id);
      await updateDoc(sessaoRef, { presentes: vereadores.filter(v => novo.includes(v.id)).map(v => ({ id: v.id, nome: v.nome })) });
    }
  };

  // ---------- CONTROLE DE SESSÃO ----------
  const alterarStatusSessao = async (novoStatus) => {
    if (!sessaoAtiva) return;
    const sessaoRef = doc(db, "sessoes", sessaoAtiva.id);
    await updateDoc(sessaoRef, { status: novoStatus });
    setSessaoAtiva((prev) => ({ ...prev, status: novoStatus }));
    await atualizarPainelCamposGerais(novoStatus);
    if (novoStatus === "Encerrada") {
      await encerrarTudoZerarAtaSalvar();
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
        ...gerarDadosSessaoPainel(),
        statusSessao: "Ativa",
        dataHoraInicio: agora.toISOString(),
      },
      { merge: true }
    );
    for (let id of Object.keys(bancoHoras)) {
      await setDoc(doc(db, "bancoHoras", id), { tempo: 0 }, { merge: true });
    }
  };

  // ---------- CONTROLE DE MATÉRIAS/VOTAÇÃO ----------
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
    let materiaAtual = null;
    if (novaOrdem.length === 1) materiaAtual = novaOrdem[0];
    else if (materiasSelecionadas.length === 1)
      materiaAtual = novaOrdem.find(m => m.id === materiasSelecionadas[0]);
    await setDoc(
      painelRef,
      {
        ...gerarDadosSessaoPainel(),
        ordemDoDia: novaOrdem,
        votacaoAtual: {
          materias: novaOrdem.filter((m) => materiasSelecionadas.includes(m.id)).map((m) => ({
            id: m.id,
            titulo: m.titulo || m.descricao || "Sem título",
            tipo: m.tipo || "Não definido",
            autor: m.autor || "-",
            status: m.status,
          })),
          materia: materiaAtual?.titulo || materiaAtual?.descricao || "",
          tipo: tipoVotacao,
          status: "em_votacao",
          habilitados,
          votos: {},
          autor: materiaAtual?.autor || "",
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
    // Busca votos atuais
    let votosSnap = {};
    try {
      const painelSnap = await getDoc(doc(db, "painelAtivo", "ativo"));
      votosSnap = painelSnap.data()?.votacaoAtual?.votos || {};
    } catch { votosSnap = {}; }
    let sim = 0, nao = 0, abstencao = 0;
    Object.values(votosSnap).forEach(v => {
      if (v.voto === "Sim") sim++;
      else if (v.voto === "Não") nao++;
      else if (v.voto === "Abstenção") abstencao++;
    });

    await updateDoc(doc(db, "painelAtivo", "ativo"), {
      ...gerarDadosSessaoPainel(),
      ordemDoDia: novaOrdem,
      "votacaoAtual.status": "votada",
      resultadoFinal: { sim, nao, abstencao },
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

  // ---------- ATA AUTOMÁTICA ----------
  async function gerarAtaCorrigida() {
    setCarregandoAta(true);
    setAtaCorrigida("Gerando ata automática...");
    const sessaoId = sessaoAtiva?.id;
    const data = sessaoAtiva?.data;
    // Pega toda a votação atual do painel
    let painel = {};
    try {
      const snap = await getDoc(doc(db, "painelAtivo", "ativo"));
      painel = snap.data() || {};
    } catch { painel = {}; }
    // Monta texto simplificado para salvar
    let ataTexto = `ATA DA SESSÃO\n\n`;
    ataTexto += `Data: ${painel.data || ""}\nHora: ${painel.hora || ""}\nLocal: ${painel.local || ""}\nTipo: ${painel.tipo || ""}\nPresidente: ${painel.presidente || ""}\nSecretário: ${painel.secretario || ""}\nLegislatura: ${painel.legislatura || ""}\n`;
    ataTexto += `\nMesa Diretora: `;
    if (sessaoAtiva?.mesa?.length)
      ataTexto += sessaoAtiva.mesa.map(m => `${m.vereador} (${m.cargo})`).join(", ");
    ataTexto += `\n\nPresentes:\n`;
    if (painel.votacaoAtual?.habilitados?.length && vereadores?.length)
      ataTexto += vereadores.filter(v => painel.votacaoAtual.habilitados.includes(v.id)).map(v => `${v.nome} (${v.partido})`).join(", ");
    ataTexto += `\n\nMatérias da Ordem do Dia:\n`;
    if (painel.ordemDoDia?.length)
      painel.ordemDoDia.forEach(m => { ataTexto += `- ${m.titulo} (${m.tipo}) Status: ${m.status}\n`; });
    ataTexto += `\nVOTAÇÃO:\n`;
    if (painel.votacaoAtual?.votos && vereadores?.length) {
      Object.entries(painel.votacaoAtual.votos).forEach(([k, v]) => {
        let vereador = vereadores.find(x => x.id === v.vereador_id);
        ataTexto += `${vereador?.nome || v.vereador_id}: ${v.voto}\n`;
      });
    }
    ataTexto += `\nResultado Final:\nSim: ${painel.resultadoFinal?.sim || 0}\nNão: ${painel.resultadoFinal?.nao || 0}\nAbstenção: ${painel.resultadoFinal?.abstencao || 0}\n\n--- FIM DA ATA ---`;
    setAtaCorrigida(ataTexto);

    // Salva na coleção ATAS
    if (sessaoId) {
      await addDoc(collection(db, "atas"), {
        sessaoId,
        data: painel.data,
        ataTexto,
        geradaEm: new Date().toISOString(),
      });
    }
    setCarregandoAta(false);
  }

  // ---------- ENCERRA TUDO/ZERA ----------
  async function encerrarTudoZerarAtaSalvar() {
    // Gera e salva ata antes de zerar
    await gerarAtaCorrigida();

    // Zera habilitados no painel
    await updateDoc(doc(db, "painelAtivo", "ativo"), {
      "votacaoAtual.habilitados": [],
      habilitados: [],
      statusSessao: "Encerrada",
    });
    // Zera estados locais
    setSessaoAtiva(null);
    setMaterias([]);
    setMateriasSelecionadas([]);
    setHabilitados([]);
    setTipoVotacao("Simples");
    setModalidade("Unica");
    setStatusVotacao("Preparando");
    setRespostaIA("");
    setAtaCorrigida("");
    for (let id of Object.keys(bancoHoras)) {
      await setDoc(doc(db, "bancoHoras", id), { tempo: 0 }, { merge: true });
    }
  }

  async function perguntarIA() {
    setCarregandoPergunta(true);
    setRespostaIA("Consultando IA...");
    const res = await fetch("http://localhost:3334/api/pergunte", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pergunta: perguntaIA }),
    });
    const json = await res.json();
    setRespostaIA(json.resposta || "Sem resposta da IA.");
    setCarregandoPergunta(false);
  }

  // ---------- TRIBUNA ----------
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (cronometroAtivo && tempoRestante > 0) {
      const painelRef = doc(db, "painelAtivo", "ativo");
      updateDoc(painelRef, {
        "tribunaAtual.cronometroAtivo": true,
        "tribunaAtual.tempoRestante": tempoRestante,
        "tribunaAtual.status": "Em andamento",
      }).catch((err) => { });
      intervalRef.current = setInterval(() => {
        setTempoRestante((prevTempo) => {
          const novoTempo = prevTempo > 0 ? prevTempo - 1 : 0;
          updateDoc(painelRef, {
            "tribunaAtual.tempoRestante": novoTempo,
          }).catch((err) => { });
          if (novoTempo === 0) {
            clearInterval(intervalRef.current);
            setCronometroAtivo(false);
            updateDoc(painelRef, {
              "tribunaAtual.cronometroAtivo": false,
            }).catch((err) => { });
          }
          return novoTempo;
        });
      }, 1000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [cronometroAtivo, tempoRestante]);

  const iniciarOuRetomarTribuna = async () => {
    if (!oradorSelecionado) {
      alert("Selecione um orador antes de iniciar a tribuna.");
      return;
    }
    let tempoParaUsar = tempoFala;
    if (usarSaldo && oradorSelecionado !== "externo") {
      const saldoTotal = bancoHoras[oradorSelecionado] || 0;
      tempoParaUsar =
        bancoUsarTempo > 0 && bancoUsarTempo <= saldoTotal
          ? bancoUsarTempo
          : saldoTotal > 0
            ? saldoTotal
            : tempoFala;
      if (saldoTotal > 0) {
        const novoSaldo = saldoTotal - tempoParaUsar;
        await setDoc(
          doc(db, "bancoHoras", oradorSelecionado),
          { tempo: novoSaldo },
          { merge: true }
        );
        setBancoHoras((prev) => ({ ...prev, [oradorSelecionado]: novoSaldo }));
      }
    }
    setTempoRestante(tempoParaUsar);
    setCronometroAtivo(true);
    const painelRef = doc(db, "painelAtivo", "ativo");
    let dadosOrador;
    if (oradorSelecionado === "externo") {
      dadosOrador = { nome: "Orador Externo", partido: "Sem partido", fotoURL: "" };
    } else {
      const vereador = vereadores.find((p) => p.id === oradorSelecionado);
      dadosOrador = { nome: vereador?.nome || "", partido: vereador?.partido || "", fotoURL: vereador?.foto || "" };
    }
    await setDoc(
      painelRef,
      {
        ...gerarDadosSessaoPainel(),
        tribunaAtual: {
          ...dadosOrador,
          tempoInicial: tempoParaUsar,
          tempoRestante: tempoParaUsar,
          saldoHoras: bancoHoras[oradorSelecionado] || 0,
          cronometroAtivo: true,
          status: "Em andamento",
          legenda: [],
        },
      },
      { merge: true }
    );
    setTempoSalvo(false);
  };

  const pausarTribuna = async () => {
    setCronometroAtivo(false);
    const painelRef = doc(db, "painelAtivo", "ativo");
    await updateDoc(painelRef, {
      "tribunaAtual.cronometroAtivo": false,
      "tribunaAtual.tempoRestante": tempoRestante,
    }).catch(() => { });
  };

  const encerrarTempo = async () => {
    if (tempoSalvo || !cronometroAtivo) return;
    setCronometroAtivo(false);

    if (oradorSelecionado && oradorSelecionado !== "externo" && !usarSaldo) {
      const saldoAnterior = bancoHoras[oradorSelecionado] || 0;
      const novoSaldo = saldoAnterior + tempoRestante;
      await setDoc(
        doc(db, "bancoHoras", oradorSelecionado),
        { tempo: novoSaldo },
        { merge: true }
      );
      setBancoHoras((prev) => ({ ...prev, [oradorSelecionado]: novoSaldo }));
    }

    setTempoRestante(0);
    setTempoSalvo(true);
    const painelRef = doc(db, "painelAtivo", "ativo");
    await updateDoc(painelRef, {
      "tribunaAtual.tempoRestante": 0,
      "tribunaAtual.cronometroAtivo": false,
    }).catch(() => { });
  };

  const encerrarTribuna = async () => {
    setCronometroAtivo(false);
    const painelRef = doc(db, "painelAtivo", "ativo");
    await updateDoc(painelRef, {
      tribunaAtual: {
        nome: "",
        partido: "",
        fotoURL: "",
        tempoInicial: 0,
        tempoRestante: 0,
        cronometroAtivo: false,
        status: "Tribuna Finalizada",
        legenda: [],
      },
    }).catch(() => { });
    setTempoRestante(tempoFala);
    setTempoSalvo(false);
  };

  // ---------- RENDER DE ABAS ----------
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
                        atualizarHabilitadosPainel(novo);
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
          <div className="tribuna">
            <h4>🎤 Tribuna</h4>
            <label style={{ display: "block", marginBottom: "8px" }}>
              Orador:
              <select
                value={oradorSelecionado}
                onChange={(e) => { setOradorSelecionado(e.target.value); setBancoUsarTempo(0); }}
                style={{ marginLeft: "5px" }}
              >
                <option value="">Selecione</option>
                {vereadores
                  .filter((p) => habilitados.includes(p.id))
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome} ({p.partido}) – Saldo: {bancoHoras[p.id] || 0}s
                    </option>
                  ))}
                <option value="externo">Orador Externo</option>
              </select>
            </label>
            <label style={{ display: "block", marginBottom: "8px" }}>
              <input
                type="checkbox"
                checked={usarSaldo}
                onChange={(e) => setUsarSaldo(e.target.checked)}
              />{" "}
              Usar saldo de horas acumuladas
            </label>
            {usarSaldo && oradorSelecionado && oradorSelecionado !== "externo" && (
              <label style={{ display: "block", marginBottom: "8px" }}>
                Tempo do Banco a usar (s):{" "}
                <input
                  type="number"
                  value={bancoUsarTempo}
                  min="0"
                  max={bancoHoras[oradorSelecionado] || 0}
                  onChange={(e) => setBancoUsarTempo(Number(e.target.value))}
                  style={{ width: "80px", marginLeft: "5px" }}
                />
              </label>
            )}
            <label style={{ display: "block", marginBottom: "8px" }}>
              Tempo de Fala (s):{" "}
              <input
                type="number"
                value={tempoFala}
                onChange={(e) => setTempoFala(Number(e.target.value))}
                style={{ width: "80px", marginLeft: "5px" }}
              />
            </label>
            <p style={{ fontSize: "18px", margin: "10px 0" }}>
              Tempo Restante: {Math.floor(tempoRestante / 60)}:
              {("0" + (tempoRestante % 60)).slice(-2)}
            </p>
            {oradorSelecionado && oradorSelecionado !== "externo" && (
              <p style={{ marginBottom: "10px" }}>
                🕒 Saldo de Horas no Banco: {bancoHoras[oradorSelecionado] || 0}s
              </p>
            )}
            <button className="botao-verde" onClick={() => cronometroAtivo ? pausarTribuna() : iniciarOuRetomarTribuna()}>
              {cronometroAtivo ? "⏸ Pausar" : "▶ Iniciar"}
            </button>
            <button className="botao-azul" onClick={encerrarTempo} disabled={tempoSalvo || !cronometroAtivo} style={{
              opacity: tempoSalvo || !cronometroAtivo ? 0.5 : 1,
              cursor: tempoSalvo || !cronometroAtivo ? "not-allowed" : "pointer",
            }}>
              🔚 Encerrar Tempo
            </button>
            <button className="botao-vermelho" onClick={encerrarTribuna}>
              🛑 Encerrar Tribuna
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
                          atualizarHabilitadosPainel(novo);
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
                <b>Gerar Ata Corrigida:</b><br />
                <button className="botao-azul" onClick={gerarAtaCorrigida} disabled={carregandoAta}>
                  {carregandoAta ? "Gerando..." : "Gerar Ata"}
                </button>
                {ataCorrigida && (
                  <div className="ia-bloco-resposta">
                    <pre style={{ whiteSpace: "pre-wrap" }}>{ataCorrigida}</pre>
                  </div>
                )}
              </div>
              <div style={{ flex: 1 }}>
                <b>Pergunte à IA:</b>
                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  <input
                    type="text"
                    value={perguntaIA}
                    onChange={e => setPerguntaIA(e.target.value)}
                    placeholder="Ex: Quem foi o último orador?"
                    style={{ flex: 1 }}
                  />
                  <button onClick={perguntarIA} disabled={carregandoPergunta || !perguntaIA}>
                    {carregandoPergunta ? "Aguarde..." : "Perguntar"}
                  </button>
                </div>
                {respostaIA && (
                  <div className="ia-bloco-resposta">
                    {respostaIA}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  }

  // ---------- RENDER PRINCIPAL ----------
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
        {["Controle de Sessão", "Controle de Votação", "Controle de Tribuna", "Controle de Presença", "IA"].map(tab => (
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
