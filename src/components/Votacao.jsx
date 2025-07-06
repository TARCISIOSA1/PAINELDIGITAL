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

// ------------ UTIL: Salva tudo sempre no painelAtivo (não perde habilitados/presentes ao dar F5) -------------
async function atualizarPainelAtivo(sessao, materias, presentes, habilitados, statusSessao, votacaoAtualExtra = {}, tribunaAtual = {}) {
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
      presentes: presentes || [], // só IDs dos marcados na presença
      votacaoAtual: {
        materia: materias?.find(m => m.status === "em_votacao")?.titulo || "",
        idMateria: materias?.find(m => m.status === "em_votacao")?.id || "",
        tipo: sessao.tipoVotacao || "Simples",
        autor: materias?.find(m => m.status === "em_votacao")?.autor || "-",
        status: votacaoAtualExtra.status || "preparando",
        habilitados: votacaoAtualExtra.habilitados || habilitados || [], // só IDs dos habilitados para votação
        votos: votacaoAtualExtra.votos || {},
        tempoVotacao: votacaoAtualExtra.tempoVotacao || 60,
        ...votacaoAtualExtra
      },
      tribunaAtual: tribunaAtual,
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
  const [habilitados, setHabilitados] = useState([]); // para votação
  const [presentes, setPresentes] = useState([]); // IDs dos PRESENTES da sessão
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

  // Carrega habilitados e presentes SEMPRE do painelAtivo (persistente após F5)
  useEffect(() => {
    async function syncHabilitadosPresentes() {
      const painelDoc = await getDoc(doc(db, "painelAtivo", "ativo"));
      if (painelDoc.exists()) {
        if (painelDoc.data()?.votacaoAtual?.habilitados) {
          setHabilitados(painelDoc.data().votacaoAtual.habilitados);
        }
        if (painelDoc.data()?.presentes) {
          setPresentes(painelDoc.data().presentes);
        }
      }
    }
    syncHabilitadosPresentes();
  }, [sessaoAtiva]);

  // ----------------- FUNÇÕES DE BANCO/FIRESTORE -----------------
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
      setMateriaSelecionada(sessao.ordemDoDia?.find(m => m.status === "em_votacao")?.id || null);
      setPresentes(sessao.presentes?.map(p => typeof p === "string" ? p : p.id) || []);
    } else {
      setSessaoAtiva(null);
      setMaterias([]);
      setMateriasSelecionadas([]);
      setTipoVotacao("Simples");
      setModalidade("Unica");
      setStatusVotacao("Preparando");
      setHabilitados([]);
      setPresentes([]);
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
    await atualizarPainelAtivo(
      { ...sessaoAtiva, status: novoStatus },
      materias,
      presentes,
      habilitados,
      novoStatus
    );
    if (novoStatus === "Encerrada") {
      await gerarAtaCorrigida();
      setSessaoAtiva(null);
      setMaterias([]);
      setMateriasSelecionadas([]);
      setMateriaSelecionada(null);
      setTipoVotacao("Simples");
      setModalidade("Unica");
      setStatusVotacao("Preparando");
      setHabilitados([]);
      setPresentes([]);
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
    await atualizarPainelAtivo(
      { ...sessaoAtiva, status: "Ativa" },
      materias,
      presentes,
      habilitados,
      "Ativa"
    );
    for (let id of Object.keys(bancoHoras)) {
      await setDoc(doc(db, "bancoHoras", id), { tempo: 0 }, { merge: true });
    }
  };

  // ------------- PRESENÇA (salva só campo de presença) -------------
  const handlePresenca = async (id) => {
    let novoPresentes = presentes.includes(id)
      ? presentes.filter((x) => x !== id)
      : [...presentes, id];
    setPresentes(novoPresentes);

    // Atualiza presença na sessão e no painel ativo!
    if (sessaoAtiva) {
      // Atualiza sessão
      const sessaoRef = doc(db, "sessoes", sessaoAtiva.id);
      await updateDoc(sessaoRef, { presentes: novoPresentes });

      // Atualiza painel ativo
      await atualizarPainelAtivo(
        sessaoAtiva,
        materias,
        novoPresentes,
        habilitados,
        sessaoAtiva.status
      );
    }
  };

  // ------------- HABILITADOS (salva só campo de habilitados p/ votação) -------------
  const handleHabilitar = async (id) => {
    const novo = habilitados.includes(id)
      ? habilitados.filter((x) => x !== id)
      : [...habilitados, id];
    setHabilitados(novo);

    // Atualiza só o painel ativo!
    await atualizarPainelAtivo(
      sessaoAtiva,
      materias,
      presentes,
      novo,
      sessaoAtiva?.status
    );
  };

  // ------------- VOTAÇÃO INDIVIDUAL (uma por vez) -------------
  const iniciarVotacao = async () => {
    if (!sessaoAtiva || !materiaSelecionada) return;
    if (habilitados.length < quorumMinimo) {
      alert("Quórum mínimo não atingido!");
      return;
    }
    let novaOrdem = (materias || []).map((m) =>
      m.id === materiaSelecionada ? { ...m, status: "em_votacao" } : m
    );
    setMaterias(novaOrdem);
    const sessaoRef = doc(db, "sessoes", sessaoAtiva.id);
    await updateDoc(sessaoRef, { ordemDoDia: novaOrdem });
    await atualizarPainelAtivo(
      sessaoAtiva,
      novaOrdem,
      presentes,
      habilitados,
      sessaoAtiva.status,
      {
        status: "em_votacao",
        tempoVotacao,
        habilitados,
        votos: {},
        idMateria: materiaSelecionada,
      }
    );
    setStatusVotacao("Em Andamento");
    setTempoRestante(tempoVotacao);

    // Inicia cronômetro de votação
    if (tempoVotacaoInterval.current) clearInterval(tempoVotacaoInterval.current);
    tempoVotacaoInterval.current = setInterval(() => {
      setTempoRestante((prev) => {
        if (prev <= 1) {
          clearInterval(tempoVotacaoInterval.current);
          encerrarVotacao(); // encerra automaticamente se zerar o tempo
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const encerrarVotacao = async () => {
    if (!sessaoAtiva || !materiaSelecionada) return;

    // Busca os votos registrados no painelAtivo
    const painelSnap = await getDoc(doc(db, "painelAtivo", "ativo"));
    let votos = {};
    if (painelSnap.exists()) {
      votos = painelSnap.data().votacaoAtual?.votos || {};
    }

    // Marca como "Não Votou" quem não votou
    let votosFinal = { ...votos };
    habilitados.forEach(id => {
      if (!votosFinal[id]) votosFinal[id] = "Não Votou";
    });

    let novaOrdem = (materias || []).map((m) =>
      m.id === materiaSelecionada ? { ...m, status: "votada", votos: votosFinal } : m
    );
    setMaterias(novaOrdem);
    const sessaoRef = doc(db, "sessoes", sessaoAtiva.id);
    await updateDoc(sessaoRef, { ordemDoDia: novaOrdem });

    await atualizarPainelAtivo(
      sessaoAtiva,
      novaOrdem,
      presentes,
      habilitados,
      sessaoAtiva.status,
      { status: "votada", votos: votosFinal }
    );
    setStatusVotacao("Preparando");
    setMateriaSelecionada(null);
    setTempoRestante(tempoVotacao);

    if (tempoVotacaoInterval.current) clearInterval(tempoVotacaoInterval.current);
  };

  // ------------------------- ATA GERAÇÃO + PDF -------------------------
  async function gerarAtaCorrigida() {
    setCarregandoAta(true);
    setAtaCorrigida("Gerando ata automática...");
    // MONTA CONTEÚDO DA ATA
    let ata = "";
    ata += `Câmara: ${panelConfig.nomeCamara}\n`;
    ata += `Data: ${sessaoAtiva?.data || "-"}\n`;
    ata += `Hora: ${sessaoAtiva?.hora || "-"}\n`;
    ata += `Presidente: ${sessaoAtiva?.presidente || "-"}\n`;
    ata += `Secretário: ${sessaoAtiva?.secretario || "-"}\n\n`;

    ata += `Presentes:\n`;
    vereadores.filter(v => presentes.includes(v.id)).forEach(v => {
      ata += `- ${v.nome} (${v.partido})\n`;
    });

    ata += `\nMatérias da Ordem do Dia:\n`;
    materias.forEach(m => {
      ata += `- ${m.titulo} (${m.tipo}) - Status: ${m.status}\n`;
      if (m.votos) {
        ata += "  Votos:\n";
        Object.entries(m.votos).forEach(([vid, voto]) => {
          let vereador = vereadores.find(v => v.id === vid);
          ata += `    ${vereador?.nome || vid}: ${voto}\n`;
        });
      }
    });

    // Tribuna
    ata += `\nFalantes na Tribuna:\n`;
    const painelDoc = await getDoc(doc(db, "painelAtivo", "ativo"));
    let falas = [];
    if (painelDoc.exists() && painelDoc.data()?.tribunaAtual?.legenda) {
      falas = painelDoc.data().tribunaAtual.legenda;
    }
    if (falas && falas.length > 0) {
      falas.forEach(f => {
        ata += `- ${f.nome}: ${f.texto}\n`;
      });
    } else {
      ata += "- Nenhum registro\n";
    }

    ata += `\nStatus final da sessão: ${sessaoAtiva?.status || "-"}\n`;

    setAtaCorrigida(ata);

    // Salva no Firestore
    await addDoc(collection(db, "atas"), {
      data: new Date().toISOString(),
      sessaoId: sessaoAtiva?.id,
      ata,
      camara: panelConfig.nomeCamara,
    });

    // Baixa PDF automaticamente
    baixarAtaPDF(ata);

    setCarregandoAta(false);
  }

  function baixarAtaPDF(ata) {
    const docPDF = new jsPDF();
    if (panelConfig.logoPath) {
      try {
        docPDF.addImage(panelConfig.logoPath, "PNG", 10, 10, 25, 25);
      } catch { /* ignora erro de logo */ }
    }
    docPDF.setFontSize(16);
    docPDF.text(panelConfig.nomeCamara, 45, 20);
    docPDF.setFontSize(12);
    docPDF.text("Ata da Sessão", 45, 28);

    autoTable(docPDF, {
      startY: 40,
      theme: "plain",
      body: ata.split("\n").map(line => [line]),
      styles: { fontSize: 10 }
    });

    docPDF.save(`ATA-${sessaoAtiva?.data || "sessao"}.pdf`);
  }

  // ------------------- RESTANTE DAS ABAS/INTERFACE -------------------
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
                  <strong>Tempo de Votação (s):</strong>{" "}
                  <input type="number" value={tempoVotacao} min={10} max={600}
                    onChange={e => setTempoVotacao(Number(e.target.value))} style={{ width: 80, marginLeft: 5 }} />
                </label>
              </div>
            </div>
            <div className="controle-votacao">
              <h4>🛠 Controle da Votação (Status: {statusVotacao})</h4>
              <button className="botao-azul" onClick={iniciarVotacao}>
                ▶ Iniciar Votação (Matéria selecionada)
              </button>
              <button className="botao-verde" onClick={encerrarVotacao}>
                ✅ Encerrar Votação
              </button>
              <div>
                <b>Tempo restante: {tempoRestante}s</b>
              </div>
            </div>
            <hr />
            <div className="materias">
              <h4>📄 Matérias da Ordem do Dia</h4>
              <ul>
                {materias.map((m, idx) => (
                  <li
                    key={m.id}
                    className={materiaSelecionada === m.id ? "materia-selecionada" : ""}
                    style={{ display: "flex", alignItems: "center", marginBottom: 6 }}
                  >
                    <input
                      type="radio"
                      name="materias"
                      checked={materiaSelecionada === m.id}
                      onChange={() => { if (m.status !== "votada") setMateriaSelecionada(m.id); }}
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
                      onClick={() => {/* moverMateria(idx, -1) */}}
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
                      onClick={() => {/* moverMateria(idx, 1) */}}
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
              <h4>👥 Habilitação de Vereadores para Votação</h4>
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
      case "Controle de Tribuna":
        return (
          <div className="tribuna">
            <h4>🎤 Tribuna</h4>
            {/* ...SEU CÓDIGO DE TRIBUNA MANTIDO... */}
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
                        checked={presentes.includes(v.id)}
                        onChange={() => handlePresenca(v.id)}
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
            {/* ...SEU CÓDIGO DE IA MANTIDO... */}
          </div>
        );
      default:
        return null;
    }
  }

  // --------- TRIBUNA TIMER -----------
  useEffect(() => {
    if (tribunaInterval.current) clearInterval(tribunaInterval.current);
    if (cronometroAtivoTribuna && tempoRestanteTribuna > 0) {
      tribunaInterval.current = setInterval(() => {
        setTempoRestanteTribuna((prev) => {
          if (prev <= 1) {
            clearInterval(tribunaInterval.current);
            setCronometroAtivoTribuna(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => { if (tribunaInterval.current) clearInterval(tribunaInterval.current); };
  }, [cronometroAtivoTribuna, tempoRestanteTribuna]);

  // Tribuna funções
  const iniciarOuRetomarTribuna = () => {
    setCronometroAtivoTribuna(true);
  };
  const pausarTribuna = () => {
    setCronometroAtivoTribuna(false);
  };
  const encerrarTempoTribuna = () => {
    setTempoSalvo(true);
    setCronometroAtivoTribuna(false);
    setTempoRestanteTribuna(0);
  };
  const encerrarTribuna = () => {
    setCronometroAtivoTribuna(false);
    setTempoRestanteTribuna(tempoFala);
    setTempoSalvo(false);
    setOradorSelecionado("");
  };

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
