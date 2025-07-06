import React, { useEffect, useRef, useState } from "react";
import TopoInstitucional from "./TopoInstitucional";
import panelConfig from "../config/panelConfig.json";
import { doc, onSnapshot, getDocs, collection, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import "./PainelVotacaoIA.css";
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function PainelVotacaoIA() {
  const [dadosPainel, setDadosPainel] = useState(null);
  const [presentes, setPresentes] = useState([]);
  const [habilitados, setHabilitados] = useState([]);
  const [votosRegistrados, setVotosRegistrados] = useState([]);
  const [tribunaAtual, setTribunaAtual] = useState(null);

  useEffect(() => {
    const ref = doc(db, 'painelAtivo', 'ativo');
    const unsubscribe = onSnapshot(ref, async (snap) => {
      if (!snap.exists()) {
        setDadosPainel(null);
        return;
      }
      const data = snap.data();
      setDadosPainel(data);
      setTribunaAtual(data.tribunaAtual || null);
      setHabilitados(data.votacaoAtual?.habilitados || []);
      setPresentes(data.presentes || []);

      // Busca vereadores presentes (ou habilitados, se preferir)
      let vereadoresDocs = [];
      if ((data.presentes || []).length) {
        if (data.presentes.length <= 10) {
          const q = query(collection(db, 'parlamentares'), where('__name__', 'in', data.presentes));
          vereadoresDocs = (await getDocs(q)).docs.map(d => ({ id: d.id, ...d.data() }));
        } else {
          const all = (await getDocs(collection(db, 'parlamentares'))).docs.map(d => ({ id: d.id, ...d.data() }));
          vereadoresDocs = all.filter(v => data.presentes.includes(v.id));
        }
      }
      setPresentes(vereadoresDocs);

      // Votos
      const votos = data.votacaoAtual?.votos;
      setVotosRegistrados(
        votos && typeof votos === 'object'
          ? Object.entries(votos).map(([id, valor]) => {
              if (typeof valor === 'string') {
                return { id, voto: valor };
              } else {
                return { id: valor.vereador_id, voto: valor.voto };
              }
            })
          : []
      );
    });
    return () => unsubscribe();
  }, []);

  if (!dadosPainel) {
    return <div className="painel-ia-container">Aguardando sessão...</div>;
  }

  return (
    <div className="painel-ia-container">
      <TopoInstitucional />
      <section>
        <h2>Dados da Sessão</h2>
        <div>
          <b>Data:</b> {dadosPainel.data || '-'} | <b>Hora:</b> {dadosPainel.hora || '-'}
          <br />
          <b>Status:</b> {dadosPainel.statusSessao || '-'}
          <br />
          <b>Presidente:</b> {dadosPainel.presidente || '-'}
          <br />
          <b>Secretário:</b> {dadosPainel.secretario || '-'}
        </div>
      </section>

      <section>
        <h2>Parlamentares Presentes</h2>
        <div>
          {presentes.length > 0 ? presentes.map(p => (
            <span key={p.id} style={{ display: "inline-block", margin: 8 }}>
              <img src={p.foto || "/default.png"} alt={p.nome} width={40} style={{ borderRadius: "50%" }} />
              <br />
              {p.nome} ({p.partido || '-'})
            </span>
          )) : <span>Nenhum presente</span>}
        </div>
      </section>

      <section>
        <h2>Tribuna</h2>
        {tribunaAtual && tribunaAtual.nome ? (
          <div>
            <b>Orador:</b> {tribunaAtual.nome} ({tribunaAtual.partido || '-'})
            <br />
            <b>Tempo Restante:</b> {tribunaAtual.tempoRestante || 0}s
          </div>
        ) : <span>Nenhum orador</span>}
      </section>

      <section>
        <h2>Votação Atual</h2>
        {dadosPainel.votacaoAtual?.materia ? (
          <div>
            <b>Matéria:</b> {dadosPainel.votacaoAtual.materia}
            <br />
            <b>Status:</b> {dadosPainel.votacaoAtual.status}
            <br />
            <b>Tipo:</b> {dadosPainel.votacaoAtual.tipo}
            <br />
            <b>Autor:</b> {dadosPainel.votacaoAtual.autor}
            <br />
            <h3>Votos</h3>
            <ul>
              {votosRegistrados.map(v => {
                const par = presentes.find(p => p.id === v.id);
                return (
                  <li key={v.id}>
                    {par ? par.nome : v.id}: {v.voto}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : <span>Nenhuma votação em andamento</span>}
      </section>
    </div>
  );
}
