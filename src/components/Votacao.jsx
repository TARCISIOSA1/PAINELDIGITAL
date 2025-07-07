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

// ---------------------
// REGRAS DE QUÓRUM
const QUORUM_OPTIONS = [
  { label: "Quórum Simples", value: "simples", regra: "Maioria simples dos presentes (n/2 + 1)", formula: n => Math.ceil(n / 2) },
  { label: "Quórum de Suspensão", value: "suspensao", regra: "1/3 dos vereadores", formula: n => Math.ceil(n / 3) },
  { label: "Quórum de Votação", value: "votacao", regra: "Maioria absoluta (50%+1 dos membros)", formula: n => Math.ceil(n / 2) + 1 },
  { label: "Quórum Qualificado", value: "qualificado", regra: "2/3 dos membros", formula: n => Math.ceil(n * 2 / 3) },
];

// -----------------------------------------------------
// COMPONENTE PRINCIPAL
export default function Votacao() {
  // ------------ ESTADOS PAINEL SESSÃO/VOTAÇÃO ------------
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

  // ------------ TRIBUNA 100% ------------
  const [oradores, setOradores] = useState([]);
  const [tempoPadrao, setTempoPadrao] = useState(180);
  const [oradorAtivoIdx, setOradorAtivoIdx] = useState(-1);
  const [tempoRestante, setTempoRestante] = useState(0);
  const [cronometroAtivo, setCronometroAtivo] = useState(false);
  const intervalRef = useRef(null);
  const [novoOrador, setNovoOrador] = useState("");
  const [resumoFala, setResumoFala] = useState("");
  const [bancoHoras, setBancoHoras] = useState({});
  const [editarTempo, setEditarTempo] = useState(tempoPadrao);

  // ---- RESTANTE DO PAINEL ----
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

  // INCLUIR MESA DIRETORA NO PAINEL
  function gerarDadosSessaoPainel() {
    const presidenteMesa = sessaoAtiva?.mesa?.find(m => m.cargo.toLowerCase().includes("presidente"))?.vereador || sessaoAtiva?.presidente || "";
    const secretarioMesa = sessaoAtiva?.mesa?.find(m => m.cargo.toLowerCase().includes("secretário"))?.vereador || sessaoAtiva?.secretario || "";
    return {
      data: sessaoAtiva?.data || "",
      hora: sessaoAtiva?.hora || "",
      local: sessaoAtiva?.local || "",
      presidente: presidenteMesa,
      secretario: secretarioMesa,
      tipo: sessaoAtiva?.tipo || "",
      legislatura: legislaturaSelecionada?.descricao || "",
      numeroSessaoPlenaria: numeroSessaoOrdinaria || "",
      numeroSessaoLegislativa: numeroSessaoLegislativa || "",
      mesa: sessaoAtiva?.mesa || [],
    };
  }

  // ---------- INICIALIZAÇÃO/FIREBASE ----------
  useEffect(() => {
    carregarSessaoAtivaOuPrevista();
    carregarVereadores();
    carregarBancoHoras();
    buscarHabilitadosPainel();
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
      setTipoVotacao(sessao.tipoVotacao || "Simples");
      setModalidade(sessao.modalidade || "Unica");
      await setDoc(doc(db, "painelAtivo", "ativo"), {
        ...gerarDadosSessaoPainel(sessao),
        statusSessao: sessao.status || "Ativa",
      }, { merge: true });
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

  // ---------- HABILITADOS: PERSISTE SEMPRE ----------
  const atualizarHabilitadosPainel = async (novo) => {
    await updateDoc(doc(db, "painelAtivo", "ativo"), {
      "votacaoAtual.habilitados": novo,
    });
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
    await gerarAtaCorrigida();
    await updateDoc(doc(db, "painelAtivo", "ativo"), {
      "votacaoAtual.habilitados": [],
      habilitados: [],
      statusSessao: "Encerrada",
    });
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

  // ---------- CRONÔMETRO TRIBUNA ----------
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

  // ---------- FUNÇÕES TRIBUNA ----------
  function iniciarFala() {
    if (oradorAtivoIdx < 0) return;
    setTempoRestante(oradores[oradorAtivoIdx].tempoFala);
    setCronometroAtivo(true);
  }
  function pausarFala() {
    setCronometroAtivo(false);
  }
  function encerrarFala() {
    if (oradorAtivoIdx < 0) return;
    setCronometroAtivo(false);
    const orador = oradores[oradorAtivoIdx];
    if (!orador.externo) {
      const saldoAntigo = bancoHoras[orador.id] || 0;
      setBancoHoras(prev => ({
        ...prev,
        [orador.id]: saldoAntigo + tempoRestante
      }));
    }
    const lista = [...oradores];
    lista[oradorAtivoIdx].saldo = (lista[oradorAtivoIdx].saldo || 0) + tempoRestante;
    lista[oradorAtivoIdx].fala = resumoFala;
    lista[oradorAtivoIdx].horario = new Date().toLocaleTimeString();
    setOradores(lista);
    setTempoRestante(0);
    setResumoFala("");
  }
  function proximoOrador() {
    if (oradorAtivoIdx < oradores.length - 1) {
      setOradorAtivoIdx(oradorAtivoIdx + 1);
      setTempoRestante(oradores[oradorAtivoIdx + 1].tempoFala);
      setResumoFala("");
      setCronometroAtivo(false);
    }
  }
  function adicionarOrador() {
    if (!novoOrador) return;
    let orador = null;
    if (novoOrador === "externo") {
      orador = { id: "externo-" + Date.now(), nome: "Orador Externo", partido: "-", externo: true };
    } else {
      const vereador = vereadores.find(v => v.id === novoOrador);
      if (!vereador) return;
      orador = {
        id: vereador.id,
        nome: vereador.nome,
        partido: vereador.partido,
        externo: false
      };
    }
    setOradores(prev => [
      ...prev,
      {
        ...orador,
        tempoFala: tempoPadrao,
        saldo: 0,
        fala: "",
        horario: ""
      }
    ]);
    setNovoOrador("");
  }
  function removerOrador(idx) {
    setOradores(oradores.filter((_, i) => i !== idx));
    if (oradorAtivoIdx === idx) setOradorAtivoIdx(-1);
  }
  function alterarTempoFala(idx, valor) {
    const lista = [...oradores];
    lista[idx].tempoFala = parseInt(valor) || tempoPadrao;
    setOradores(lista);
  }
  function usarSaldoHoras(idx) {
    const orador = oradores[idx];
    const saldo = bancoHoras[orador.id] || 0;
    if (saldo > 0) {
      const lista = [...oradores];
      lista[idx].tempoFala = saldo;
      setOradores(lista);
      setBancoHoras(prev => ({ ...prev, [orador.id]: 0 }));
    }
  }
  function zerarSaldos() {
    setBancoHoras({});
    setOradores(oradores.map(o => ({ ...o, saldo: 0 })));
  }

  // ---------- RENDER DE ABAS ----------
  function renderConteudoAba() {
    switch (aba) {
      case "Controle de Sessão":
        return (
          <div>
            <h4>Controle da Sessão</h4>
            <p>Status: <b>{sessaoAtiva?.status || "Nenhuma ativa"}</b></p>
            <button onClick={iniciarSessao} disabled={!sessaoAtiva || sessaoAtiva.status === "Ativa"}>Iniciar Sessão</button>
            <button onClick={() => alterarStatusSessao("Encerrada")} disabled={!sessaoAtiva || sessaoAtiva.status === "Encerrada"} style={{ marginLeft: 10, color: "#a00" }}>
              Encerrar Sessão
            </button>
            <hr />
            <b>Ordem do Dia:</b>
            <ul>
              {materias.map((m, i) => (
                <li key={m.id}>
                  <b>{m.titulo || m.descricao || m.id}</b> ({m.tipo || "Sem tipo"}) - Status: {m.status}
                  <button onClick={() => moverMateria(i, -1)} disabled={i === 0}><FaArrowUp /></button>
                  <button onClick={() => moverMateria(i, 1)} disabled={i === materias.length - 1}><FaArrowDown /></button>
                </li>
              ))}
            </ul>
          </div>
        );
      case "Controle de Votação":
        return (
          <div>
            <h4>Controle de Votação</h4>
            <p>Status: <b>{statusVotacao}</b></p>
            <b>Matérias para votação:</b>
            <ul>
              {materias.map(m => (
                <li key={m.id}>
                  <input
                    type={modalidade === "Lote" ? "checkbox" : "radio"}
                    checked={materiasSelecionadas.includes(m.id)}
                    onChange={() => toggleMateria(m.id)}
                  />
                  {m.titulo || m.descricao || m.id} ({m.tipo || "Sem tipo"})
                </li>
              ))}
            </ul>
            <b>Habilitados para votar: {habilitados.length} / Quórum mínimo: {quorumMinimo}</b>
            <div style={{ margin: "10px 0" }}>
              <button onClick={iniciarVotacao} disabled={statusVotacao === "Em Andamento"}>Iniciar Votação</button>
              <button onClick={pausarVotacao} disabled={statusVotacao !== "Em Andamento"}>Pausar</button>
              <button onClick={retomarVotacao} disabled={statusVotacao !== "Pausada"}>Retomar</button>
              <button onClick={encerrarVotacao} style={{ marginLeft: 10, color: "#a00" }}>Encerrar</button>
            </div>
          </div>
        );
      case "Controle de Tribuna":
        return (
          <div className="tribuna-bloco">
            <h4>Tribuna — Controle de Oradores</h4>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <select value={novoOrador} onChange={e => setNovoOrador(e.target.value)} style={{ width: 240 }}>
                <option value="">Adicionar orador...</option>
                {vereadores.map(v => (
                  <option key={v.id} value={v.id}>{v.nome} ({v.partido})</option>
                ))}
                <option value="externo">Orador Externo</option>
              </select>
              <button onClick={adicionarOrador}>+ Adicionar</button>
              <span style={{ marginLeft: 14 }}>Tempo padrão:
                <input
                  type="number"
                  value={tempoPadrao}
                  onChange={e => setTempoPadrao(Number(e.target.value))}
                  style={{ width: 60, marginLeft: 5 }}
                /> s
              </span>
            </div>
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
                        <button onClick={() => usarSaldoHoras(idx)} style={{ marginLeft: 8 }} title="Usar saldo">
                          Usar Saldo
                        </button>
                      )}
                    </td>
                    <td>{o.saldo || 0}</td>
                    <td>
                      <button onClick={() => setOradorAtivoIdx(idx)}>▶ Iniciar</button>
                      <button onClick={() => removerOrador(idx)} style={{ color: "#a00", marginLeft: 6 }}>Remover</button>
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
            <h4>Controle de Presença</h4>
            <ul>
              {vereadores.map(v => (
                <li key={v.id}>
                  {v.nome} ({v.partido}) - <b>{habilitados.includes(v.id) ? "Presente" : "Ausente"}</b>
                  <button
                    onClick={() =>
                      atualizarHabilitadosPainel(
                        habilitados.includes(v.id)
                          ? habilitados.filter(id => id !== v.id)
                          : [...habilitados, v.id]
                      ).then(() => buscarHabilitadosPainel())
                    }
                    style={{ marginLeft: 10 }}
                  >
                    {habilitados.includes(v.id) ? "Remover" : "Adicionar"}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        );
      case "IA":
        return (
          <div>
            <h4>Assistente IA — Ata Automática & Perguntas</h4>
            <button onClick={gerarAtaCorrigida} disabled={carregandoAta}>Gerar Ata Automática</button>
            <pre style={{ background: "#f8f8f8", padding: 10, minHeight: 60 }}>{ataCorrigida}</pre>
            <hr />
            <input
              style={{ width: 280 }}
              type="text"
              placeholder="Perguntar algo à IA..."
              value={perguntaIA}
              onChange={e => setPerguntaIA(e.target.value)}
              disabled={carregandoPergunta}
            />
            <button onClick={perguntarIA} disabled={carregandoPergunta || !perguntaIA}>Perguntar</button>
            <div style={{ minHeight: 30, marginTop: 10, color: "#233" }}>
              {carregandoPergunta ? "Consultando IA..." : respostaIA}
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
        secretario={sessaoAtiva?.secretario}
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
