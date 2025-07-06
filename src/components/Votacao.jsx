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

const QUORUM_OPTIONS = [
  { label: "Quórum Simples", value: "simples", regra: "Maioria simples dos presentes (n/2 + 1)", formula: n => Math.ceil(n / 2) },
  { label: "Quórum de Suspensão", value: "suspensao", regra: "1/3 dos vereadores", formula: n => Math.ceil(n / 3) },
  { label: "Quórum de Votação", value: "votacao", regra: "Maioria absoluta (50%+1 dos membros)", formula: n => Math.ceil(n / 2) + 1 },
  { label: "Quórum Qualificado", value: "qualificado", regra: "2/3 dos membros", formula: n => Math.ceil(n * 2 / 3) },
];

// Salva tudo no painel ativo
async function atualizarPainelAtivo(sessao, materias, habilitados, presentes, statusSessao, votacaoAtualExtra = {}, tribunaAtual = {}) {
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
      presentes: presentes || [],
      votacaoAtual: {
        materia: materias?.find(m => m.status === "em_votacao")?.titulo || "",
        idMateria: materias?.find(m => m.status === "em_votacao")?.id || "",
        tipo: sessao.tipoVotacao || "Simples",
        autor: materias?.find(m => m.status === "em_votacao")?.autor || "-",
        status: votacaoAtualExtra.status || "preparando",
        habilitados: votacaoAtualExtra.habilitados || habilitados || [],
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
  // ---- ESTADOS ----
  const [aba, setAba] = useState("Controle de Sessão");
  const [sessaoAtiva, setSessaoAtiva] = useState(null);
  const [materias, setMaterias] = useState([]);
  const [materiaSelecionada, setMateriaSelecionada] = useState(null);
  const [vereadores, setVereadores] = useState([]);
  const [presentes, setPresentes] = useState([]); // <-- MARCAÇÃO DE PRESENÇA
  const [habilitados, setHabilitados] = useState([]); // <-- APENAS PARA VOTAÇÃO
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

  // TRIBUNA (mantém igual, só não esquecer de salvar quando usar)
  // ... coloque aqui seus estados de tribuna se tiver outros ...

  useEffect(() => {
    carregarSessaoAtivaOuPrevista();
    carregarVereadores();
  }, []);

  useEffect(() => {
    const opt = QUORUM_OPTIONS.find(o => o.value === quorumTipo);
    if (opt) setQuorumMinimo(opt.formula(presentes.length));
  }, [quorumTipo, presentes.length]);

  // Carrega presentes do painelAtivo SEMPRE
  useEffect(() => {
    async function syncPainelAtivo() {
      const painelDoc = await getDoc(doc(db, "painelAtivo", "ativo"));
      if (painelDoc.exists()) {
        setPresentes(painelDoc.data().presentes || []);
        setHabilitados(painelDoc.data()?.votacaoAtual?.habilitados || []);
      }
    }
    syncPainelAtivo();
  }, [sessaoAtiva]);

  // ----------- FUNÇÕES DE BANCO/FIRESTORE -----------
  const carregarSessaoAtivaOuPrevista = async () => {
    const snapshot = await getDocs(collection(db, "sessoes"));
    const lista = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    let sessao = lista.find((s) => s.status === "Ativa") ||
      lista.find((s) => ["Prevista", "Suspensa", "Pausada"].includes(s.status));
    if (sessao) {
      setSessaoAtiva(sessao);
      setMaterias(sessao.ordemDoDia || []);
      setTipoVotacao(sessao.tipoVotacao || "Simples");
      setModalidade(sessao.modalidade || "Unica");
      setMateriaSelecionada(sessao.ordemDoDia?.find(m => m.status === "em_votacao")?.id || null);
      // Presentes do Firestore, se não tiver marca vazio
      setPresentes(sessao.presentes?.map(p => p.id) || []);
    } else {
      setSessaoAtiva(null);
      setMaterias([]);
      setTipoVotacao("Simples");
      setModalidade("Unica");
      setStatusVotacao("Preparando");
      setPresentes([]);
      setHabilitados([]);
    }
  };

  const carregarVereadores = async () => {
    const snap = await getDocs(collection(db, "parlamentares"));
    setVereadores(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
  };

  // ----------- PRESENÇA -----------
  const handlePresenca = async (id) => {
    let novaPresenca = presentes.includes(id)
      ? presentes.filter(x => x !== id)
      : [...presentes, id];
    setPresentes(novaPresenca);
    // Atualiza sessão e painel
    if (sessaoAtiva) {
      const sessaoRef = doc(db, "sessoes", sessaoAtiva.id);
      await updateDoc(sessaoRef, {
        presentes: novaPresenca.map(pid => {
          const v = vereadores.find(v => v.id === pid);
          return v ? { id: v.id, nome: v.nome } : { id: pid };
        })
      });
    }
    await atualizarPainelAtivo(sessaoAtiva, materias, habilitados, novaPresenca, sessaoAtiva?.status);
  };

  // ----------- HABILITAÇÃO -----------
  const handleHabilitar = async (id) => {
    let novo = habilitados.includes(id)
      ? habilitados.filter(x => x !== id)
      : [...habilitados, id];
    setHabilitados(novo);
    await atualizarPainelAtivo(sessaoAtiva, materias, novo, presentes, sessaoAtiva?.status);
  };

  // ----------- INICIAR/ENCERRAR VOTAÇÃO -----------
  const iniciarVotacao = async () => {
    if (!sessaoAtiva || !materiaSelecionada) return;
    if (habilitados.length < quorumMinimo) {
      alert("Quórum mínimo não atingido!");
      return;
    }
    let novaOrdem = materias.map(m =>
      m.id === materiaSelecionada ? { ...m, status: "em_votacao" } : m
    );
    setMaterias(novaOrdem);
    const sessaoRef = doc(db, "sessoes", sessaoAtiva.id);
    await updateDoc(sessaoRef, { ordemDoDia: novaOrdem });
    await atualizarPainelAtivo(
      sessaoAtiva,
      novaOrdem,
      habilitados,
      presentes,
      sessaoAtiva.status,
      { status: "em_votacao", tempoVotacao, habilitados, votos: {}, idMateria: materiaSelecionada }
    );
    setStatusVotacao("Em Andamento");
    setTempoRestante(tempoVotacao);
    if (tempoVotacaoInterval.current) clearInterval(tempoVotacaoInterval.current);
    tempoVotacaoInterval.current = setInterval(() => {
      setTempoRestante(prev => {
        if (prev <= 1) {
          clearInterval(tempoVotacaoInterval.current);
          encerrarVotacao();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const encerrarVotacao = async () => {
    if (!sessaoAtiva || !materiaSelecionada) return;
    const painelSnap = await getDoc(doc(db, "painelAtivo", "ativo"));
    let votos = {};
    if (painelSnap.exists()) {
      votos = painelSnap.data().votacaoAtual?.votos || {};
    }
    let votosFinal = { ...votos };
    habilitados.forEach(id => {
      if (!votosFinal[id]) votosFinal[id] = "Não Votou";
    });
    let novaOrdem = materias.map(m =>
      m.id === materiaSelecionada ? { ...m, status: "votada", votos: votosFinal } : m
    );
    setMaterias(novaOrdem);
    const sessaoRef = doc(db, "sessoes", sessaoAtiva.id);
    await updateDoc(sessaoRef, { ordemDoDia: novaOrdem });
    await atualizarPainelAtivo(
      sessaoAtiva,
      novaOrdem,
      habilitados,
      presentes,
      sessaoAtiva.status,
      { status: "votada", votos: votosFinal }
    );
    setStatusVotacao("Preparando");
    setMateriaSelecionada(null);
    setTempoRestante(tempoVotacao);
    if (tempoVotacaoInterval.current) clearInterval(tempoVotacaoInterval.current);
  };

  // ----------- INTERFACE -----------
  function renderConteudoAba() {
    switch (aba) {
      case "Controle de Sessão":
        return (
          <div className="bloco-dados-gerais">
            {/* ...igual ao seu, pode manter... */}
          </div>
        );
      case "Controle de Votação":
        return (
          <div>
            <div className="bloco-config-votacao" style={{ margin: "20px 0", padding: 12, background: "#f8fafc", borderRadius: 8 }}>
              <h4>⚙️ Configuração da Votação</h4>
              {/* ...igual ao seu... */}
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
                    {/* ...seta para subir/descer... */}
                  </li>
                ))}
              </ul>
            </div>
            <hr />
            <div className="habilitacao">
              <h4>👥 Habilitação de Vereadores para Votação</h4>
              <ul>
                {vereadores.filter(v => presentes.includes(v.id)).map((p) => (
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
      // ... Tribuna e IA mantidos conforme seu projeto ...
      default:
        return null;
    }
  }

  // ...Restante do seu código...

  return (
    <div className="votacao-container">
      <TopoInstitucional />
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
