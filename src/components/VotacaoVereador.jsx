import React, { useEffect, useState } from "react";
import {
  collection,
  doc,
  getDocs,
  updateDoc,
  setDoc,
  getDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import "./Votacao.css";

export default function Votacao() {
  const [sessaoAtiva, setSessaoAtiva] = useState(null);
  const [materiasVotacao, setMateriasVotacao] = useState([]);
  const [ordemDoDia, setOrdemDoDia] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [materiaAtual, setMateriaAtual] = useState(null);
  const [parlamentares, setParlamentares] = useState([]);
  const [quorumMinimo, setQuorumMinimo] = useState(0);
  const [tempoFala, setTempoFala] = useState(180);
  const [cronometroAtivo, setCronometroAtivo] = useState(false);

  useEffect(() => {
    async function carregarDados() {
      setCarregando(true);
      const sessoesSnapshot = await getDocs(collection(db, "sessoes"));
      const sessao = sessoesSnapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .find((s) => s.status === "Ativa");

      if (!sessao) {
        setSessaoAtiva(null);
        setCarregando(false);
        return;
      }

      setSessaoAtiva(sessao);
      const materias = sessao.ordemDoDia || [];
      setMateriasVotacao(materias);
      setOrdemDoDia(materias.map((m) => m.id));

      const parlamentaresSnap = await getDocs(collection(db, "parlamentares"));
      const presencasSnap = await getDocs(collection(db, "sessoes", sessao.id, "presencas"));
      const presencasMap = new Map();
      presencasSnap.docs.forEach((doc) => presencasMap.set(doc.id, doc.data()));

      const lista = parlamentaresSnap.docs.map((doc) => {
        const data = doc.data();
        const presenca = presencasMap.get(doc.id) || {};
        return {
          id: doc.id,
          nome: data.nome,
          partido: data.partido,
          foto: data.foto || "",
          presente: presenca.presente || false,
          habilitado: presenca.habilitado || false,
        };
      });

      setParlamentares(lista);
      setQuorumMinimo(Math.ceil(lista.filter((p) => p.presente).length * 0.5));
      setCarregando(false);
    }

    carregarDados();
  }, []);

  useEffect(() => {
    async function carregarMateriaAtual() {
      const docRef = doc(db, "painelAtivo", "votacaoAtual");
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.status === "votando") {
          const materia = materiasVotacao.find((m) => m.titulo === data.titulo);
          if (materia) setMateriaAtual(materia);
        }
      }
    }
    if (materiasVotacao.length > 0) carregarMateriaAtual();
  }, [materiasVotacao]);

  useEffect(() => {
    let timer;
    if (cronometroAtivo && tempoFala > 0) {
      timer = setTimeout(() => setTempoFala((t) => t - 1), 1000);
    } else if (tempoFala === 0) {
      setCronometroAtivo(false);
      alert("Tempo esgotado!");
    }
    return () => clearTimeout(timer);
  }, [cronometroAtivo, tempoFala]);

  const habilitarParaVotacao = async () => {
    const habilitados = parlamentares
      .filter((p) => p.presente && p.habilitado)
      .map((p) => ({
        vereador_id: p.id,
        nome: p.nome,
        partido: p.partido,
        voto: "",
        habilitado: true,
      }));

    await setDoc(doc(db, "painelAtivo", "votacaoAtual"), {
      titulo: materiaAtual?.titulo || "",
      tipo: materiaAtual?.tipo || "",
      status: "votando",
      votos: habilitados,
      data: new Date().toISOString(),
      statusSessao: sessaoAtiva.status,
    });

    alert("Parlamentares habilitados para votar.");
  };

  const inicializarVotos = async () => {
    if (!sessaoAtiva || !materiaAtual) {
      alert("Sessão ou matéria não definida.");
      return;
    }

    const habilitados = parlamentares
      .filter((p) => p.presente && p.habilitado)
      .map((p) => ({
        vereador_id: p.id,
        nome: p.nome,
        partido: p.partido,
        voto: "",
        habilitado: true,
      }));

    if (habilitados.length === 0) {
      alert("Nenhum parlamentar habilitado para votar.");
      return;
    }

    await setDoc(doc(db, "painelAtivo", "votacaoAtual"), {
      titulo: materiaAtual?.titulo || "",
      tipo: materiaAtual?.tipo || "",
      status: "votando",
      votos: habilitados,
      data: new Date().toISOString(),
      statusSessao: sessaoAtiva.status,
    });

    alert("Lista de votos inicializada com sucesso!");
  };

  if (carregando) return <p>Carregando dados...</p>;
  if (!sessaoAtiva) return <p>Nenhuma sessão ativa encontrada.</p>;

  return (
    <div className="votacao-container">
      <h2>Painel de Controle Geral</h2>
      <h3>Sessão: {sessaoAtiva.tipo} - {sessaoAtiva.data} (Status: {sessaoAtiva.status})</h3>

      {materiaAtual && (
        <div style={{ marginTop: "10px" }}>
          <button
            onClick={habilitarParaVotacao}
            style={{ backgroundColor: "#2c3e50", color: "#fff", marginRight: "10px" }}
          >
            Habilitar Presentes para Votação
          </button>
          <button
            onClick={inicializarVotos}
            style={{ backgroundColor: "#1abc9c", color: "#fff" }}
          >
            Inicializar Votação (votos[])
          </button>
        </div>
      )}

      {/* O restante da sua tela segue normalmente */}
    </div>
  );
}
