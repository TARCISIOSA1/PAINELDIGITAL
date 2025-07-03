// ControleTribuna.jsx - Controle de Fala na Tribuna
import React, { useEffect, useState, useRef } from "react";
import { db } from "../firebase";
import {
  collection,
  getDocs,
  doc,
  setDoc,
} from "firebase/firestore";
import useSessaoAtiva from "../hooks/useSessaoAtiva";

export default function ControleTribuna() {
  const { sessaoAtiva, carregando } = useSessaoAtiva();
  const [parlamentares, setParlamentares] = useState([]);
  const [presentes, setPresentes] = useState([]);
  const [selecionado, setSelecionado] = useState("");
  const [tempoFala, setTempoFala] = useState(180);
  const [tempoRestante, setTempoRestante] = useState(180);
  const [cronometroAtivo, setCronometroAtivo] = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (sessaoAtiva) {
      carregarPresentes();
    }
  }, [sessaoAtiva]);

  const carregarPresentes = async () => {
    const snap = await getDocs(collection(db, `sessoes/${sessaoAtiva.id}/presencas`));
    const filtrados = [];
    for (const docu of snap.docs) {
      const data = docu.data();
      if (data.presente) {
        filtrados.push(data);
      }
    }
    setPresentes(filtrados);
  };

  const iniciar = () => {
    if (!selecionado || tempoRestante <= 0) return;
    setCronometroAtivo(true);
    intervalRef.current = setInterval(() => {
      setTempoRestante((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current);
          setCronometroAtivo(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const pausar = () => {
    clearInterval(intervalRef.current);
    setCronometroAtivo(false);
  };

  const reiniciar = () => {
    clearInterval(intervalRef.current);
    setTempoRestante(tempoFala);
    setCronometroAtivo(false);
  };

  const enviarAoPainel = async () => {
    if (!selecionado || !sessaoAtiva) return;
    const ref = doc(db, `sessoes/${sessaoAtiva.id}/tribuna`);
    await setDoc(ref, {
      parlamentar: selecionado,
      tempoRestante,
      tempoTotal: tempoFala,
      timestamp: new Date().toISOString(),
    });
    alert("Tempo enviado ao painel.");
  };

  if (carregando) return <p>Carregando...</p>;
  if (!sessaoAtiva) return <p>Nenhuma sessão ativa.</p>;

  return (
    <div style={{ maxWidth: 500, margin: "auto", padding: 20 }}>
      <h2>Tribuna</h2>
      <label>
        Selecione um parlamentar presente:
        <select
          value={selecionado}
          onChange={(e) => setSelecionado(e.target.value)}
          style={{ display: "block", width: "100%", marginBottom: 10 }}
        >
          <option value="">-- Selecione --</option>
          {presentes.map((p) => (
            <option key={p.parlamentarId} value={p.nome}>
              {p.nome}
            </option>
          ))}
        </select>
      </label>

      <label>
        Tempo de Fala (segundos):
        <input
          type="number"
          value={tempoFala}
          onChange={(e) => {
            const val = Number(e.target.value);
            setTempoFala(val);
            setTempoRestante(val);
          }}
          style={{ display: "block", width: "100%", marginBottom: 10 }}
        />
      </label>

      <p><strong>Tempo Restante:</strong> {Math.floor(tempoRestante / 60)}:{("0" + (tempoRestante % 60)).slice(-2)}</p>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button onClick={iniciar} disabled={cronometroAtivo}>Iniciar</button>
        <button onClick={pausar} disabled={!cronometroAtivo}>Pausar</button>
        <button onClick={reiniciar}>Reiniciar</button>
        <button onClick={enviarAoPainel}>Enviar ao Painel</button>
      </div>
    </div>
  );
}
