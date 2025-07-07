import React, { useEffect, useState, useRef } from "react";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  setDoc,
  addDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import TopoInstitucional from "./TopoInstitucional";
import { FaArrowUp, FaArrowDown } from "react-icons/fa";
import "./Votacao.css";
import panelConfig from "../config/panelConfig.json";

// ---------------------
// REGRAS DE QUÓRUM
const QUORUM_OPTIONS = [
  { label: "Quórum Simples", value: "simples", regra: "Maioria simples dos presentes (n/2 + 1)", formula: n => Math.ceil(n / 2) },
  { label: "Quórum de Suspensão", value: "suspensao", regra: "1/3 dos vereadores", formula: n => Math.ceil(n / 3) },
  { label: "Quórum de Votação", value: "votacao", regra: "Maioria absoluta (50%+1 dos membros)", formula: n => Math.ceil(n / 2) + 1 },
  { label: "Quórum Qualificado", value: "qualificado", regra: "2/3 dos membros", formula: n => Math.ceil(n * 2 / 3) },
];

export default function Votacao() {
  // ESTADOS GERAIS
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

  // --------- TRIBUNA INTEGRAÇÃO FIRESTORE ---------
  const [oradores, setOradores] = useState([]);
  const [tempoPadrao, setTempoPadrao] = useState(180);
  const [oradorAtivoIdx, setOradorAtivoIdx] = useState(-1);
  const [tempoRestante, setTempoRestante] = useState(0);
  const [cronometroAtivo, setCronometroAtivo] = useState(false);
  const intervalRef = useRef(null);
  const [resumoFala, setResumoFala] = useState("");
  const [bancoHoras, setBancoHoras] = useState({});

  // Legislatura / Sessão
  const [legislaturas, setLegislaturas] = useState([]);
  const [legislaturaSelecionada, setLegislaturaSelecionada] = useState(null);
  const [numeroSessaoOrdinaria, setNumeroSessaoOrdinaria] = useState(0);
  const [numeroSessaoLegislativa, setNumeroSessaoLegislativa] = useState(0);

  // IA
  const [ataCorrigida, setAtaCorrigida] = useState("");
  const [carregandoAta, setCarregandoAta] = useState(false);
  const [perguntaIA, setPerguntaIA] = useState("");
  const [respostaIA, setRespostaIA] = useState("");
  const [carregandoPergunta, setCarregandoPergunta] = useState(false);

  // INICIALIZAÇÃO E FIREBASE
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

  // ------ PUXA OS ORADORES DA TRIBUNA DA SESSÃO ------
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
      setHabilitados(
        Array.isArray(sessao.presentes)
          ? sessao.presentes.map((p) => (p.id ? p.id : p))
          : []
      );
      setTipoVotacao(sessao.tipoVotacao || "Simples");
      setModalidade(sessao.modalidade || "Unica");
      // ----------- PUXA TRIBUNA DA SESSÃO! -----------
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

  // --------- CONTROLE DE TRIBUNA (SOMENTE ALTERAR/CRONÔMETRO) ---------
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

  async function encerrarFala() {
    if (oradorAtivoIdx < 0) return;
    setCronometroAtivo(false);
    const orador = oradores[oradorAtivoIdx];
    if (orador.id && !orador.externo) {
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

    // --- Salvar toda a tribuna no painelAtivo ---
    try {
      await updateDoc(doc(db, "painelAtivo", "ativo"), {
        tribunaAtual: {
          oradores: lista,
          oradorAtivoIdx,
          horarioEncerramento: new Date().toISOString(),
        }
      });
    } catch (e) {
      console.error("Erro ao salvar tribuna no painelAtivo:", e);
    }
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

  // --------- CONTROLE DE SESSÃO/VOTAÇÃO ---------
  const alterarStatusSessao = async (novoStatus) => {
    if (!sessaoAtiva) return;
    const sessaoRef = doc(db, "sessoes", sessaoAtiva.id);
    await updateDoc(sessaoRef, { status: novoStatus });
    setSessaoAtiva((prev) => ({ ...prev, status: novoStatus }));
    await updateDoc(doc(db, "painelAtivo", "ativo"), {
      statusSessao: novoStatus,
    });
    if (novoStatus === "Encerrada") {
      await montarESalvarAtaCompleta(
        sessaoAtiva,
        vereadores,
        habilitados,
        materias,
        materiasSelecionadas,
        oradores
      );
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

  // ----------- IA -----------

  async function montarESalvarAtaCompleta(sessaoAtiva, vereadores, habilitados, materias, materiasSelecionadas, oradores) {
    // Busca painel ativo para pegar votações e tribuna
    const painelRef = doc(db, "painelAtivo", "ativo");
    let painelData = {};
    try {
      const painelSnap = await getDocs(collection(db, "painelAtivo"));
      painelData = painelSnap.docs.find(doc => doc.id === "ativo")?.data() || {};
    } catch (e) {}

    const presentes = vereadores.filter(v => habilitados.includes(v.id));
    const materiasAta = materiasSelecionadas.map(id => materias.find(m => m.id === id)).filter(Boolean);
    const tribuna = painelData.tribunaAtual?.oradores || oradores;
    const mesaDiretora = sessaoAtiva?.mesa || [];
    const topo = panelConfig?.nomeCamara || "Câmara Municipal";
    const cidade = panelConfig?.cidade || "";
    const dataSessao = sessaoAtiva?.data || new Date().toLocaleDateString();
    const horaSessao = sessaoAtiva?.hora || new Date().toLocaleTimeString();

    let ataTexto = `\n${topo}\n${cidade}\nATA DA SESSÃO PLENÁRIA\n\n`;
    ataTexto += `Aos ${dataSessao}, às ${horaSessao}, realizou-se a sessão plenária sob a presidência de ${mesaDiretora[0]?.vereador || sessaoAtiva?.presidente || "-"}.\n`;

    ataTexto += `\nPresentes:\n`;
    ataTexto += presentes.length
      ? presentes.map(v => `- ${v.nome} (${v.partido})`).join("\n")
      : "-";
    ataTexto += `\n`;

    if (materiasAta.length) {
      ataTexto += `\nOrdem do Dia:\n`;
      materiasAta.forEach((m, i) => {
        ataTexto += `${i + 1}. ${m.titulo || m.descricao || "Sem título"} (${m.tipo || "-"}) - Autor: ${m.autor || "-"} - Status: ${m.status}\n`;
      });
    }

    if (tribuna && tribuna.length) {
      ataTexto += `\nTribuna (Falas em tempo real):\n`;
      tribuna.forEach(o => {
        if (o.fala) {
          ataTexto += `- ${o.nome} (${o.partido}) às ${o.horario || "-"}:\n`;
          if (Array.isArray(o.fala)) {
            ataTexto += o.fala.map(f => `    ${f}`).join("\n") + "\n";
          } else {
            ataTexto += `    ${o.fala}\n`;
          }
        }
      });
    }

    if (painelData.votacaoAtual?.votos) {
      ataTexto += `\nResultados das Votações:\n`;
      Object.entries(painelData.votacaoAtual.votos).forEach(([id, voto]) => {
        const ver = vereadores.find(v => v.id === id);
        ataTexto += `- ${ver?.nome || id} (${ver?.partido || "-"}) votou: ${voto}\n`;
      });
    }

    ataTexto += `\nNada mais havendo a tratar, a sessão foi encerrada pelo presidente ${mesaDiretora[0]?.vereador || sessaoAtiva?.presidente || "-"}, às ${new Date().toLocaleTimeString()}.\n`;

    ataTexto += `\n\nAssinaturas da Mesa Diretora:\n\n`;
    mesaDiretora.forEach((m) => {
      ataTexto += `______________________________    ${m.vereador} (${m.cargo})\n\n`;
    });

    // --- Salva a ATA nos locais corretos ---
    try {
      // 1. Salva no painelAtivo/ativo (campo ataCompleta)
      await updateDoc(painelRef, { ataCompleta: ataTexto });

      // 2. Salva na sessão atual (campo ata)
      if (sessaoAtiva?.id) {
        await updateDoc(doc(db, "sessoes", sessaoAtiva.id), { ata: ataTexto });
      }

      // 3. Salva na coleção atas
      const idSessao = sessaoAtiva?.id || null;
      const novaAta = {
        idSessao,
        dataCriacao: new Date().toISOString(),
        ataCompleta: ataTexto,
        mesaDiretora: mesaDiretora,
        assinaturas: [],
        presentes: presentes.map(v => ({ id: v.id, nome: v.nome, partido: v.partido })),
        materias: materiasAta,
        tribuna: tribuna,
        votacoes: painelData.votacaoAtual?.votos || {},
      };
      if (idSessao) {
        await setDoc(doc(db, "atas", idSessao), novaAta, { merge: true });
      } else {
        await addDoc(collection(db, "atas"), novaAta);
      }
    } catch (e) {
      console.error("Erro ao salvar ATA:", e);
    }
  }

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
                        <button onClick={() => usarSaldoHoras(idx)} style={{ marginLeft: 8 }} title="Usar saldo">
                          Usar Saldo
                        </button>
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
