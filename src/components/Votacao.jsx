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
import panelConfig from "../config/panelConfig.json";

const QUORUM_OPTIONS = [
  { label: "Quórum Simples", value: "simples", regra: "Maioria simples dos presentes (n/2 + 1)", formula: n => Math.ceil(n / 2) },
  { label: "Quórum de Suspensão", value: "suspensao", regra: "1/3 dos vereadores", formula: n => Math.ceil(n / 3) },
  { label: "Quórum de Votação", value: "votacao", regra: "Maioria absoluta (50%+1 dos membros)", formula: n => Math.ceil(n / 2) + 1 },
  { label: "Quórum Qualificado", value: "qualificado", regra: "2/3 dos membros", formula: n => Math.ceil(n * 2 / 3) },
];

export default function Votacao() {
  // STATES
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

  // TRIBUNA
  const [oradores, setOradores] = useState([]);
  const [tempoPadrao, setTempoPadrao] = useState(180);
  const [oradorAtivoIdx, setOradorAtivoIdx] = useState(-1);
  const [tempoRestante, setTempoRestante] = useState(0);
  const [cronometroAtivo, setCronometroAtivo] = useState(false);
  const intervalRef = useRef(null);
  const [resumoFala, setResumoFala] = useState("");
  const [bancoHoras, setBancoHoras] = useState({});
  const [tempoExtra, setTempoExtra] = useState(0);

  // Legislatura / Sessão
  const [legislaturas, setLegislaturas] = useState([]);
  const [legislaturaSelecionada, setLegislaturaSelecionada] = useState(null);
  const [numeroSessaoOrdinaria, setNumeroSessaoOrdinaria] = useState(0);
  const [numeroSessaoLegislativa, setNumeroSessaoLegislativa] = useState(0);

  // NOVO: CAMPOS PARA CHAT/IA e ATA
  const [mensagemChat, setMensagemChat] = useState("");
  const [mensagensChat, setMensagensChat] = useState([]);
  const [respostaIA, setRespostaIA] = useState("");
  const [carregandoIA, setCarregandoIA] = useState(false);
  const [ataTexto, setAtaTexto] = useState(""); // Texto editável da ATA

  // INICIALIZAÇÃO
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

  // ------ PUXA SESSÃO ATIVA ------
  const carregarSessaoAtivaOuPrevista = async () => {
    const snapshot = await getDocs(collection(db, "sessoes"));
    const lista = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    let sessao = lista.find((s) => s.status === "Ativa");
    if (!sessao) {
      sessao = lista.find((s) => s.status === "Prevista" || s.status === "Suspensa" || s.status === "Pausada");
    }
    if (sessao) {
      setSessaoAtiva(sessao);
      setMaterias(sessao.ordemDoDia || []);
      setMateriasSelecionadas(sessao.ordemDoDia?.filter(m => m.status !== "votada").map(m => m.id) || []);
      setHabilitados(Array.isArray(sessao.presentes) ? sessao.presentes.map((p) => (p.id ? p.id : p)) : []);
      setTipoVotacao(sessao.tipoVotacao || "Simples");
      setModalidade(sessao.modalidade || "Unica");
      setTempoVotacao(sessao.tempoVotacao || "");
      if (Array.isArray(sessao.tribuna) && sessao.tribuna.length > 0) {
        setOradores(sessao.tribuna.map(o => ({ ...o, saldo: o.saldo || 0, fala: o.fala || "", horario: o.horario || "" })));
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
      setTempoVotacao("");
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

  // --------- HABILITADOS (PRESENÇA) - SALVA EM TUDO! ---------
  async function atualizarHabilitados(novo) {
    setHabilitados(novo);
    if (sessaoAtiva) {
      await updateDoc(doc(db, "sessoes", sessaoAtiva.id), { presentes: novo });
      await updateDoc(doc(db, "painelAtivo", "ativo"), { habilitados: novo, presentes: novo });
    }
  }

  // --------- CONTROLE DE TRIBUNA (SALDO E EXTRA) ---------
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
    let novoSaldo = bancoHoras[orador.id] || 0;
    if (orador.usouSaldo && orador.saldoUsado) {
      novoSaldo -= orador.saldoUsado;
      if (novoSaldo < 0) novoSaldo = 0;
    }
    const lista = [...oradores];
    lista[oradorAtivoIdx].saldo = novoSaldo;
    lista[oradorAtivoIdx].fala = resumoFala;
    lista[oradorAtivoIdx].horario = orador.horario || new Date().toLocaleTimeString();
    setOradores(lista);
    setTempoRestante(0);
    setResumoFala("");
    setBancoHoras(prev => ({ ...prev, [orador.id]: novoSaldo }));
    await updateDoc(doc(db, "painelAtivo", "ativo"), {
      tribunaAtual: {
        oradores: lista,
        oradorAtivoIdx,
        horarioEncerramento: new Date().toISOString(),
      }
    });
    if (sessaoAtiva) {
      await updateDoc(doc(db, "sessoes", sessaoAtiva.id), {
        tribuna: lista
      });
    }
  }

  function iniciarFala() {
    if (oradorAtivoIdx < 0) return;
    setTempoRestante(oradores[oradorAtivoIdx].tempoFala + tempoExtra);
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
      lista[idx].usouSaldo = true;
      lista[idx].saldoUsado = saldo;
      setOradores(lista);
      setBancoHoras(prev => ({ ...prev, [orador.id]: 0 }));
    }
  }
  function adicionarTempoExtra() {
    setTempoExtra(t => t + 30);
  }
  function zerarSaldos() {
    setBancoHoras({});
    setOradores(oradores.map(o => ({ ...o, saldo: 0, usouSaldo: false, saldoUsado: 0 })));
  }

  // --------- Função para gerar texto da ATA ----------
  function gerarAtaCompleta() {
    if (!sessaoAtiva) return "Sessão não encontrada.";
    const presentes = vereadores.filter(v => habilitados.includes(v.id));
    const abertura = `Aos ${sessaoAtiva.data || "[Data]"}, às ${sessaoAtiva.hora || "[Hora]"}, realizou-se a sessão plenária da ${panelConfig?.nomeCamara || "Câmara Municipal"} sob a presidência de ${sessaoAtiva.presidente || "-"}.\n\n`;
    let ata =
      abertura +
      `Presentes:\n${
        presentes.length
          ? presentes.map(v => `- ${v.nome} (${v.partido})`).join("\n")
          : "-"
      }\n\n`;

    if (materias.length) {
      ata += `Ordem do Dia:\n`;
      materias.forEach((m, i) => {
        ata += `${i + 1}. ${m.titulo || m.descricao || "Sem título"} (${m.tipo || "-"}) - Autor: ${m.autor || "-"} - Status: ${m.status}\n`;
      });
      ata += "\n";
    }
    if (oradores.length) {
      ata += `Tribuna:\n`;
      oradores.forEach(o => {
        if (o.fala) {
          ata += `- ${o.nome} (${o.partido}) às ${o.horario || "-"}: ${o.fala}\n`;
        }
      });
      ata += "\n";
    }
    ata += "Nada mais havendo a tratar, a sessão foi encerrada pelo presidente " +
      `${sessaoAtiva.presidente || "-"}, às ${new Date().toLocaleTimeString()}.\n\nAssinaturas:\n`;
    ata += presentes.map(v => `____________________ ${v.nome}`).join("\n");
    return ata;
  }

  // --------- ENCERRAR SESSÃO – salva ata e limpa tudo ----------
  async function encerrarSessao() {
    if (!sessaoAtiva) return;

    // 1. Gerar texto da ATA automaticamente
    const ataFinal = gerarAtaCompleta();

    // 2. Salvar ATA na coleção 'atas' e na sessão
    await setDoc(doc(db, "atas", sessaoAtiva.id), {
      ataCompleta: ataFinal,
      dataCriacao: new Date().toISOString(),
      idSessao: sessaoAtiva.id,
    }, { merge: true });

    await updateDoc(doc(db, "sessoes", sessaoAtiva.id), {
      ata: ataFinal,
      status: "Encerrada"
    });

    // 3. Limpar painelAtivo COMPLETAMENTE
    await setDoc(doc(db, "painelAtivo", "ativo"), {
      statusSessao: "Encerrada",
      presentes: [],
      habilitados: [],
      ordemDoDia: [],
      votacaoAtual: {},
      tribunaAtual: {},
      ataCompleta: "",
      dataHoraInicio: "",
    });

    // 4. Limpar states/tela
    setSessaoAtiva(null);
    setMaterias([]);
    setMateriasSelecionadas([]);
    setHabilitados([]);
    setTipoVotacao("Simples");
    setModalidade("Unica");
    setStatusVotacao("Preparando");
    setOradores([]);
    setTempoVotacao("");
    setAtaTexto("");
    for (let id of Object.keys(bancoHoras)) {
      await setDoc(doc(db, "bancoHoras", id), { tempo: 0 }, { merge: true });
    }
  }

  // --- Função para IA Chat/Resposta ---
  async function enviarParaIA(mensagem) {
    setCarregandoIA(true);
    setRespostaIA("Consultando IA...");
    try {
      const res = await fetch("http://localhost:3334/api/pergunte", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pergunta: mensagem }),
      });
      const json = await res.json();
      setRespostaIA(json.resposta || "Sem resposta da IA.");
      setMensagensChat(msgs => [...msgs, { usuario: "IA", texto: json.resposta || "Sem resposta da IA." }]);
    } catch (e) {
      setRespostaIA("Erro ao consultar IA.");
    }
    setCarregandoIA(false);
  }

  // Função para salvar Ata manual (extra, pode ser usada na aba Ata)
  async function salvarAtaManual() {
    if (!sessaoAtiva) return;
    await updateDoc(doc(db, "sessoes", sessaoAtiva.id), { ata: ataTexto });
    await setDoc(doc(db, "atas", sessaoAtiva.id), {
      ataCompleta: ataTexto,
      dataCriacao: new Date().toISOString(),
    }, { merge: true });
    alert("Ata salva com sucesso!");
  }

  // ----------- RENDER DE ABAS -----------
  function renderConteudoAba() {
    switch (aba) {
      // Controle de Sessão
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
                <button className="botao-verde" onClick={() => {/* sua lógica para iniciar sessão */}}>
                  ▶ Iniciar Sessão
                </button>
              )}
              {sessaoAtiva?.status === "Ativa" && (
                <button className="botao-vermelho" onClick={encerrarSessao}>
                  🛑 Encerrar Sessão (Zerar Painel Público)
                </button>
              )}
            </div>
          </div>
        );

      // Controle de Votação
      case "Controle de Votação":
        const quorumObj = QUORUM_OPTIONS.find(o => o.value === quorumTipo);
        return (
          <div>
            {/* ...Configuração de votação e habilitação igual ao código anterior... */}
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
                  <strong>Tempo de Votação (s) [Opcional]:</strong>{" "}
                  <input
                    type="number"
                    value={tempoVotacao}
                    onChange={e => setTempoVotacao(e.target.value)}
                    placeholder="Ex: 60"
                    min={0}
                    style={{ width: 80, marginLeft: 6 }}
                  />
                </label>
              </div>
            </div>
            {/* ...restante da aba igual ao que já funciona para você... */}
          </div>
        );

      // Controle de Tribuna
      case "Controle de Tribuna":
        return (
          <div className="tribuna-bloco">
            {/* ...código igual ao anterior, com tempo, saldo, extra, fala... */}
          </div>
        );

      // Controle de Presença
      case "Controle de Presença":
        return (
          <div>
            {/* ...código de presença igual ao anterior... */}
          </div>
        );

      // RESUMO
      case "Resumo":
        return (
          <div>
            <h3>Resumo da Sessão</h3>
            <p><b>Data:</b> {sessaoAtiva?.data || "-"}</p>
            <p><b>Hora:</b> {sessaoAtiva?.hora || "-"}</p>
            <p><b>Status:</b> {sessaoAtiva?.status || "-"}</p>
            <p><b>Presidente:</b> {sessaoAtiva?.presidente || "-"}</p>
            <hr />
            <h4>Matérias em Votação:</h4>
            <ul>
              {materias.map((m, i) => (
                <li key={m.id}>
                  <b>{m.titulo || m.descricao}</b> ({m.tipo}) - Status: {m.status}
                </li>
              ))}
            </ul>
            <hr />
            <h4>Oradores e Falas:</h4>
            <ul>
              {oradores.length === 0 && <li>Nenhum orador registrado.</li>}
              {oradores.map((o, i) => (
                <li key={o.id}>{o.nome} ({o.partido}) - {o.fala || "Sem fala registrada"} <span style={{ color: "#888" }}>{o.horario || ""}</span></li>
              ))}
            </ul>
          </div>
        );

      // Chat/IA
      case "Chat/IA":
        return (
          <div>
            <h3>Chat com IA</h3>
            <div style={{ border: "1px solid #ccc", borderRadius: 8, padding: 12, marginBottom: 18, minHeight: 120 }}>
              {mensagensChat.length === 0 && <div style={{ color: "#888" }}>Nenhuma mensagem ainda.</div>}
              {mensagensChat.map((msg, idx) =>
                <div key={idx} style={{ marginBottom: 5, color: msg.usuario === "IA" ? "#204090" : "#222" }}>
                  <b>{msg.usuario}:</b> {msg.texto}
                </div>
              )}
              {respostaIA && <div><b>IA:</b> {respostaIA}</div>}
            </div>
            <form
              onSubmit={e => {
                e.preventDefault();
                if (mensagemChat.trim()) {
                  setMensagensChat(msgs => [...msgs, { usuario: "Você", texto: mensagemChat }]);
                  enviarParaIA(mensagemChat);
                  setMensagemChat("");
                }
              }}
              style={{ display: "flex", gap: 6 }}
            >
              <input
                type="text"
                value={mensagemChat}
                onChange={e => setMensagemChat(e.target.value)}
                style={{ flex: 1 }}
                placeholder="Digite sua pergunta para a IA..."
                disabled={carregandoIA}
              />
              <button type="submit" disabled={carregandoIA || !mensagemChat.trim()}>
                {carregandoIA ? "Enviando..." : "Perguntar"}
              </button>
            </form>
          </div>
        );

      // ATA
      case "Ata":
        useEffect(() => {
          if (aba === "Ata" && sessaoAtiva) {
            setAtaTexto(gerarAtaCompleta());
          }
          // eslint-disable-next-line
        }, [aba, sessaoAtiva, oradores, vereadores, materias]);

        return (
          <div>
            <h3>Ata da Sessão (Automática e Editável)</h3>
            <textarea
              style={{ width: "100%", minHeight: 250, margin: "12px 0", fontFamily: "monospace" }}
              value={ataTexto}
              onChange={e => setAtaTexto(e.target.value)}
            />
            <button onClick={salvarAtaManual}>Salvar Ata</button>
            <span style={{ color: "#888", marginLeft: 16 }}>* Editável manualmente. Salve ao final da sessão!</span>
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
          "Resumo",
          "Chat/IA",
          "Ata",
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
