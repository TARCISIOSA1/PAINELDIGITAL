// PainelVotacaoIA.jsx
import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import {
  doc,
  onSnapshot,
  collection,
  getDocs
} from "firebase/firestore";
import TopoInstitucional from "./TopoInstitucional";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from "chart.js";
import "./PainelVotacaoIA.css";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function PainelVotacaoIA() {
  const [painel, setPainel] = useState(null);
  const [presentes, setPresentes] = useState([]);
  const [mensagemIA, setMensagemIA] = useState("Aguardando sessão...");

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "painelAtivo", "ativo"), async (docSnap) => {
      const data = docSnap.data();
      setPainel(data);
      setMensagemIA(definirMensagemIA(data));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    async function carregarPresentesCompletos() {
      if (!painel?.presentes || painel.presentes.length === 0) {
        setPresentes([]);
        return;
      }

      const snap = await getDocs(collection(db, "parlamentares"));
      const todos = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const completos = painel.presentes
        .map(id => todos.find(p => p.id === id))
        .filter(Boolean);
      setPresentes(completos);
    }

    carregarPresentesCompletos();
  }, [painel?.presentes]);

  function definirMensagemIA(data) {
    if (!data) return "Aguardando sessão...";
    if (data.tribunaAtual?.nome) return `Tribuna ativa: ${data.tribunaAtual.nome}`;
    if (data.votacaoAtual?.status === "em_votacao") return `Votação em andamento: ${data.votacaoAtual.materia}`;
    if (data.statusSessao === "Ativa") return "Sessão em andamento.";
    return "Aguardando sessão...";
  }

  const dataVotacao = {
    labels: Object.keys(painel?.votacaoAtual?.votos || {}),
    datasets: [
      {
        label: "Votos",
        data: Object.values(painel?.votacaoAtual?.votos || {}),
        backgroundColor: "#2563eb"
      }
    ]
  };

  return (
    <div className="painel-votacao">
      <TopoInstitucional />

      <div className="mensagem-ia">
        <strong>{mensagemIA}</strong>
      </div>

      <section className="sessao-info">
        <h2>Informações da Sessão</h2>
        <p><b>Data:</b> {painel?.data} | <b>Hora:</b> {painel?.hora}</p>
        <p><b>Local:</b> {painel?.local || "—"}</p>
        <p><b>Presidente:</b> {painel?.presidente || "—"} | <b>Secretário:</b> {painel?.secretario || "—"}</p>
        <p><b>Status:</b> <span className="status">{painel?.statusSessao}</span> | <b>Título:</b> {painel?.titulo || "—"}</p>
      </section>

      <section className="parlamentares-presentes">
        <h2>Parlamentares Presentes</h2>
        <div className="etiquetas-container">
          {presentes.length === 0 ? (
            <p>Nenhum parlamentar habilitado</p>
          ) : (
            presentes.map(p => (
              <div key={p.id} className="etiqueta">
                <img src={p.foto} alt={p.nome} />
                <div>
                  <strong>{p.nome}</strong>
                  <small>{p.partido}</small>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="tribuna">
        <h2>Tribuna</h2>
        {painel?.tribunaAtual?.nome ? (
          <div className="tribuna-orador tribuna-expandida">
            <img src={painel.tribunaAtual?.foto} alt={painel.tribunaAtual?.nome} />
            <div>
              <h3>{painel.tribunaAtual.nome}</h3>
              <p>{painel.tribunaAtual.partido}</p>
            </div>
          </div>
        ) : (
          <p>Sem orador na tribuna.</p>
        )}
      </section>

      <section className="votacao">
        <h2>Votação</h2>
        <p><b>Matéria:</b> {painel?.votacaoAtual?.materia || "—"}</p>
        <p><b>Autor:</b> {painel?.votacaoAtual?.autor || "—"}</p>
        <Bar data={dataVotacao} />
      </section>
    </div>
  );
}
