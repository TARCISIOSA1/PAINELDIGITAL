import React, { useEffect, useState, useRef } from "react";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  setDoc,
  getDoc,
  onSnapshot,
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
  const [tempoFala, setTempoFala] = useState(180);
  const [tempoRestante, setTempoRestante] = useState(180);
  const [cronometroAtivo, setCronometroAtivo] = useState(false);
  const intervalRef = useRef(null);
  const [oradorSelecionado, setOradorSelecionado] = useState("");
  const [bancoHoras, setBancoHoras] = useState({});
  const [usarSaldo, setUsarSaldo] = useState(false);
  const [bancoUsarTempo, setBancoUsarTempo] = useState(0);
  const [tempoSalvo, setTempoSalvo] = useState(false);
  const [legislaturas, setLegislaturas] = useState([]);
  const [legislaturaSelecionada, setLegislaturaSelecionada] = useState(null);
  const [numeroSessaoOrdinaria, setNumeroSessaoOrdinaria] = useState(0);
  const [numeroSessaoLegislativa, setNumeroSessaoLegislativa] = useState(0);
  const [ataCorrigida, setAtaCorrigida] = useState("");
  const [carregandoAta, setCarregandoAta] = useState(false);
  const [perguntaIA, setPerguntaIA] = useState("");
  const [respostaIA, setRespostaIA] = useState("");
  const [carregandoPergunta, setCarregandoPergunta] = useState(false);

  // ON SNAPSHOT: sempre pega habilitados do banco em tempo real
  useEffect(() => {
    const painelRef = doc(db, "painelAtivo", "ativo");
    const unsub = onSnapshot(painelRef, (snap) => {
      const data = snap.data();
      if (data && data.votacaoAtual && data.votacaoAtual.habilitados) {
        setHabilitados(data.votacaoAtual.habilitados);
      }
    });
    return () => unsub();
  }, []);

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
      // NÃO setHabilitados aqui! Agora o estado é do onSnapshot.
      setTipoVotacao(sessao.tipoVotacao || "Simples");
      setModalidade(sessao.modalidade || "Unica");
    } else {
      setSessaoAtiva(null);
      setMaterias([]);
      setMateriasSelecionadas([]);
      // NÃO setHabilitados aqui!
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

  // ---------------- CONTROLE DE SESSÃO ----------------
  const alterarStatusSessao = async (novoStatus) => {
    if (!sessaoAtiva) return;
    const sessaoRef = doc(db, "sessoes", sessaoAtiva.id);
    await updateDoc(sessaoRef, { status: novoStatus });
    setSessaoAtiva((prev) => ({ ...prev, status: novoStatus }));
    await updateDoc(doc(db, "painelAtivo", "ativo"), {
      statusSessao: novoStatus,
    });
    if (novoStatus === "Encerrada") {
      // Gera ata automaticamente
      await gerarAtaCorrigida();
      // Limpa tudo ao encerrar
      setSessaoAtiva(null);
      setMaterias([]);
      setMateriasSelecionadas([]);
      setTipoVotacao("Simples");
      setModalidade("Unica");
      setStatusVotacao("Preparando");
      setRespostaIA("");
      setAtaCorrigida("");
      // Zera habilitados (zera Firestore também)
      await updateDoc(doc(db, "painelAtivo", "ativo"), {
        "votacaoAtual.habilitados": [],
        votacaoAtual: {},
      });
      // Zera banco de horas
      for (let id of Object.keys(bancoHoras)) {
        await setDoc(doc(db, "bancoHoras", id), { tempo: 0 }, { merge: true });
      }
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
    // Zera banco de horas ao iniciar
    for (let id of Object.keys(bancoHoras)) {
      await setDoc(doc(db, "bancoHoras", id), { tempo: 0 }, { merge: true });
    }
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

  async function gerarAtaCorrigida() {
    setCarregandoAta(true);
    setAtaCorrigida("Gerando ata automática...");
    const sessaoId = sessaoAtiva?.id;
    const data = sessaoAtiva?.data;
    const res = await fetch("http://localhost:3334/api/atasFalas/gerarAtaCorrigida", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessaoId, data }),
    });
    const json = await res.json();
    setAtaCorrigida(json.ataCorrigida || "Falha ao gerar ata.");
    setCarregandoAta(false);
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
      dadosOrador = { nome: "Orador Externo", partido: "Sem partido" };
    } else {
      const vereador = vereadores.find((p) => p.id === oradorSelecionado);
      dadosOrador = { nome: vereador?.nome || "", partido: vereador?.partido || "" };
    }
    await setDoc(
      painelRef,
      {
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

  // -------------- HABILITAR/DESHABILITAR VEREADOR (SALVA NO FIRESTORE) --------------
  const handleHabilitar = async (id) => {
    const novo = habilitados.includes(id)
      ? habilitados.filter((x) => x !== id)
      : [...habilitados, id];
    // Salva direto no banco
    await updateDoc(doc(db, "painelAtivo", "ativo"), {
      "votacaoAtual.habilitados": novo,
    });
    // O onSnapshot já atualiza o estado local em todas as telas
  };

  function renderConteudoAba() {
    switch (aba) {
      case "Controle de Sessão":
        // ... (igual ao seu, mantido)
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
            {/* ...configurações de votação... */}
            <div className="habilitacao">
              <h4>👥 Habilitação de Vereadores</h4>
              <ul>
                {vereadores.map((p) => (
                  <li key={p.id}>
                    <input
                      type="checkbox"
                      checked={habilitados.includes(p.id)}
                      onChange={() => handleHabilitar(p.id)}
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
      // ...demais cases iguais ao seu original...
      default:
        return null;
    }
  }

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
