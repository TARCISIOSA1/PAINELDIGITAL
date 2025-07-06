import React, { useEffect, useState, useRef } from "react";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  setDoc,
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

// Utilitário para atualizar painelAtivo
async function atualizarPainelAtivo(sessao, materias, habilitados, statusSessao, votacaoAtualExtra = {}) {
  if (!sessao) return;
  const painelRef = doc(db, "painelAtivo", "ativo");
  await setDoc(
    painelRef,
    {
      titulo: sessao.titulo || "-",
      data: sessao.data || "",
      hora: sessao.hora || "",
      presidente: sessao.presidente || "",
      secretario: sessao.secretario || "",
      statusSessao: statusSessao || sessao.status || "-",
      ordemDoDia: materias || [],
      votacaoAtual: {
        materia: materias?.find(m => m.status === "em_votacao")?.titulo || "",
        tipo: sessao.tipoVotacao || "Simples",
        autor: materias?.find(m => m.status === "em_votacao")?.autor || "-",
        status: votacaoAtualExtra.status || "preparando",
        habilitados: habilitados || [],
        votos: votacaoAtualExtra.votos || {},
        tempoRestante: votacaoAtualExtra.tempoRestante || null,
        tempoTotal: votacaoAtualExtra.tempoTotal || null,
        materiasEmLote: votacaoAtualExtra.materiasEmLote || [],
        ...votacaoAtualExtra
      },
    },
    { merge: true }
  );
}

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

  // CONTROLE DE TEMPO DA VOTAÇÃO
  const [tempoVotacao, setTempoVotacao] = useState(120); // tempo padrão: 2 min
  const [cronometroVotacao, setCronometroVotacao] = useState(null);
  const [tempoRestanteVotacao, setTempoRestanteVotacao] = useState(120);

  // TRIBUNA e IA (sem alteração)
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

  // Estado de votos já computados
  const [votosComputados, setVotosComputados] = useState({});

  // --- INICIALIZAÇÃO ---
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

  // Atualiza quorumMinimo ao mudar tipo ou vereadores
  useEffect(() => {
    const opt = QUORUM_OPTIONS.find(o => o.value === quorumTipo);
    if (opt) setQuorumMinimo(opt.formula(vereadores.length));
  }, [quorumTipo, vereadores.length]);

  // --- Sincronizar sempre painelAtivo ---
  useEffect(() => {
    if (sessaoAtiva) {
      atualizarPainelAtivo(sessaoAtiva, materias, habilitados, sessaoAtiva.status, {
        votos: votosComputados
      });
    }
  }, [sessaoAtiva, materias, habilitados, votosComputados]);

  // --- INICIALIZAÇÃO DAS FUNÇÕES ---
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
    } else {
      setSessaoAtiva(null);
      setMaterias([]);
      setMateriasSelecionadas([]);
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

  // ---------------- CONTROLE DE SESSÃO (igual)
  const alterarStatusSessao = async (novoStatus) => {
    if (!sessaoAtiva) return;
    const sessaoRef = doc(db, "sessoes", sessaoAtiva.id);
    await updateDoc(sessaoRef, { status: novoStatus });
    setSessaoAtiva((prev) => ({ ...prev, status: novoStatus }));
    await atualizarPainelAtivo(
      { ...sessaoAtiva, status: novoStatus },
      materias,
      habilitados,
      novoStatus
    );
    if (novoStatus === "Encerrada") {
      await gerarAtaCorrigida();
      setSessaoAtiva(null);
      setMaterias([]);
      setMateriasSelecionadas([]);
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
        data: sessaoAtiva.data || "",
        hora: sessaoAtiva.hora || "",
        dataHoraInicio: agora.toISOString(),
        titulo: sessaoAtiva.titulo || "",
        presidente: sessaoAtiva.presidente || "",
        secretario: sessaoAtiva.secretario || "",
      },
      { merge: true }
    );
    await atualizarPainelAtivo(
      { ...sessaoAtiva, status: "Ativa" },
      materias,
      habilitados,
      "Ativa"
    );
    for (let id of Object.keys(bancoHoras)) {
      await setDoc(doc(db, "bancoHoras", id), { tempo: 0 }, { merge: true });
    }
  };

  // ---------------- CONTROLE DE MATÉRIAS/VOTAÇÃO ----------------

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
        atualizarPainelAtivo(sessaoAtiva, nova, habilitados, sessaoAtiva.status);
      }
      return nova;
    });
  }

  // INICIAR VOTAÇÃO COM CONTROLE DE TEMPO
  const iniciarVotacao = async () => {
    if (!sessaoAtiva || materiasSelecionadas.length === 0) return;
    if (habilitados.length < quorumMinimo) {
      alert("Quórum mínimo não atingido!");
      return;
    }
    // Define tempo de votação para os painéis
    setTempoRestanteVotacao(tempoVotacao);

    let novaOrdem = (materias || []).map((m) =>
      materiasSelecionadas.includes(m.id) ? { ...m, status: "em_votacao" } : m
    );
    setMaterias(novaOrdem);

    const painelMateriasLote = modalidade === "Lote"
      ? novaOrdem.filter(m => materiasSelecionadas.includes(m.id))
      : [];

    await atualizarPainelAtivo(
      sessaoAtiva,
      novaOrdem,
      habilitados,
      sessaoAtiva.status,
      {
        status: "em_votacao",
        tempoRestante: tempoVotacao,
        tempoTotal: tempoVotacao,
        materiasEmLote: painelMateriasLote,
      }
    );
    setStatusVotacao("Em Andamento");

    // Cronômetro regressivo para votação
    if (cronometroVotacao) clearInterval(cronometroVotacao);
    const timer = setInterval(async () => {
      setTempoRestanteVotacao((prev) => {
        if (prev > 1) {
          atualizarPainelAtivo(sessaoAtiva, novaOrdem, habilitados, sessaoAtiva.status, {
            status: "em_votacao",
            tempoRestante: prev - 1,
            tempoTotal: tempoVotacao,
            materiasEmLote: painelMateriasLote,
          });
          return prev - 1;
        } else {
          clearInterval(timer);
          finalizarVotacaoPorTempo(novaOrdem, painelMateriasLote);
          return 0;
        }
      });
    }, 1000);
    setCronometroVotacao(timer);
  };

  // FINALIZAR POR TEMPO
  const finalizarVotacaoPorTempo = async (novaOrdem, painelMateriasLote) => {
    // Marcar abstenção para quem não votou
    let votos = { ...votosComputados };
    for (let v of habilitados) {
      if (!votos[v]) {
        votos[v] = "Abstenção";
      }
    }
    setVotosComputados(votos);
    await atualizarPainelAtivo(
      sessaoAtiva,
      novaOrdem,
      habilitados,
      sessaoAtiva.status,
      {
        status: "votada",
        tempoRestante: 0,
        tempoTotal: tempoVotacao,
        votos,
        materiasEmLote: painelMateriasLote,
      }
    );
    setStatusVotacao("Preparando");
    setMateriasSelecionadas((prev) => prev.filter((id) => {
      const mat = novaOrdem.find((m) => m.id === id);
      return mat && mat.status !== "votada";
    }));
    if (cronometroVotacao) clearInterval(cronometroVotacao);
    // Gera ata automática
    await gerarAtaCorrigida();
  };

  const pausarVotacao = async () => {
    setStatusVotacao("Pausada");
    if (cronometroVotacao) clearInterval(cronometroVotacao);
    await atualizarPainelAtivo(
      sessaoAtiva,
      materias,
      habilitados,
      sessaoAtiva?.status,
      { status: "pausada" }
    );
  };

  const retomarVotacao = async () => {
    setStatusVotacao("Em Andamento");
    // Retomar cronômetro
    if (tempoRestanteVotacao > 0) {
      const timer = setInterval(async () => {
        setTempoRestanteVotacao((prev) => {
          if (prev > 1) {
            atualizarPainelAtivo(sessaoAtiva, materias, habilitados, sessaoAtiva.status, {
              status: "em_votacao",
              tempoRestante: prev - 1,
              tempoTotal: tempoVotacao,
            });
            return prev - 1;
          } else {
            clearInterval(timer);
            finalizarVotacaoPorTempo(materias, []);
            return 0;
          }
        });
      }, 1000);
      setCronometroVotacao(timer);
    }
    await atualizarPainelAtivo(
      sessaoAtiva,
      materias,
      habilitados,
      sessaoAtiva?.status,
      { status: "em_votacao" }
    );
  };

  const encerrarVotacao = async () => {
    if (!sessaoAtiva || materiasSelecionadas.length === 0) return;
    let novaOrdem = (materias || []).map((m) =>
      materiasSelecionadas.includes(m.id) ? { ...m, status: "votada" } : m
    );
    setMaterias(novaOrdem);

    // Marcar abstenção para quem não votou
    let votos = { ...votosComputados };
    for (let v of habilitados) {
      if (!votos[v]) {
        votos[v] = "Abstenção";
      }
    }
    setVotosComputados(votos);

    await atualizarPainelAtivo(
      sessaoAtiva,
      novaOrdem,
      habilitados,
      sessaoAtiva.status,
      {
        status: "votada",
        tempoRestante: 0,
        tempoTotal: tempoVotacao,
        votos,
      }
    );
    setStatusVotacao("Preparando");
    setMateriasSelecionadas((prev) => prev.filter((id) => {
      const mat = novaOrdem.find((m) => m.id === id);
      return mat && mat.status !== "votada";
    }));
    if (cronometroVotacao) clearInterval(cronometroVotacao);
    // Gera ata automática
    await gerarAtaCorrigida();
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

  // --- CONTROLE DOS HABILITADOS ---
  const handleHabilitar = async (id) => {
    const novo = habilitados.includes(id)
      ? habilitados.filter((x) => x !== id)
      : [...habilitados, id];
    setHabilitados(novo); // Para atualização instantânea do state
    await atualizarPainelAtivo(sessaoAtiva, materias, novo, sessaoAtiva?.status);
  };

  // --- IA e TRIBUNA IGUAL (código omitido para não duplicar resposta) ---

  // ------------------- RENDER DE ABAS -------------------
  function renderConteudoAba() {
    switch (aba) {
      case "Controle de Sessão":
        // ... idêntico ao seu
        break;
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
                  <strong>Tempo de Votação (s):</strong>{" "}
                  <input
                    type="number"
                    value={tempoVotacao}
                    onChange={e => setTempoVotacao(Number(e.target.value))}
                    style={{ width: "60px", marginLeft: 5 }}
                    min={30}
                    max={1800}
                  />
                  <span style={{ marginLeft: 8, color: "#1460a0", fontWeight: 600 }}>
                    ⏳ Tempo: {tempoRestanteVotacao}s
                  </span>
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
                    className={
                      materiasSelecionadas.includes(m.id) && m.status === "em_votacao"
                        ? "materia-selecionada em-votacao"
                        : materiasSelecionadas.includes(m.id)
                          ? "materia-selecionada"
                          : ""
                    }
                    style={{
                      display: "flex",
                      alignItems: "center",
                      marginBottom: 6,
                      background: m.status === "em_votacao" ? "#e3f2fd" : undefined,
                      border: m.status === "em_votacao" ? "2px solid #1565c0" : undefined
                    }}
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
      // CONTROLE DE TRIBUNA E DEMAIS (mesmo do seu original)
      default:
        return null;
    }
  }

  // ------------------- RENDER PRINCIPAL -------------------
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
