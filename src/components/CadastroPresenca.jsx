// CadastroPresenca.jsx - com entrada/saída e registros de tempo completos
import React, { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  doc,
  setDoc,
  updateDoc,
  getDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import useSessaoAtiva from "../hooks/useSessaoAtiva";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function CadastroPresenca() {
  const { sessaoAtiva, carregando } = useSessaoAtiva();
  const [parlamentares, setParlamentares] = useState([]);
  const [presencas, setPresencas] = useState({});

  useEffect(() => {
    if (sessaoAtiva) carregarParlamentares();
  }, [sessaoAtiva]);

  const carregarParlamentares = async () => {
    const snapshot = await getDocs(collection(db, "parlamentares"));
    const lista = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    setParlamentares(lista);
  };

  const registrarEntrada = async (parlamentar) => {
    const ref = doc(db, `sessoes/${sessaoAtiva.id}/presencas`, parlamentar.id);
    const docSnap = await getDoc(ref);
    const data = docSnap.exists() ? docSnap.data() : {};
    const registros = data.registros || [];

    registros.push({ entrada: new Date().toISOString() });

    await setDoc(ref, {
      parlamentarId: parlamentar.id,
      nome: parlamentar.nome,
      registros,
    });
    setPresencas((prev) => ({ ...prev, [parlamentar.id]: registros }));
  };

  const registrarSaida = async (parlamentar) => {
    const ref = doc(db, `sessoes/${sessaoAtiva.id}/presencas`, parlamentar.id);
    const docSnap = await getDoc(ref);
    if (!docSnap.exists()) return;

    const data = docSnap.data();
    const registros = data.registros || [];
    const ultimo = registros[registros.length - 1];
    if (ultimo && !ultimo.saida) {
      ultimo.saida = new Date().toISOString();
    }

    await setDoc(ref, {
      parlamentarId: parlamentar.id,
      nome: parlamentar.nome,
      registros,
    });
    setPresencas((prev) => ({ ...prev, [parlamentar.id]: registros }));
  };

  const carregarPresencas = async () => {
    const snapshot = await getDocs(
      collection(db, `sessoes/${sessaoAtiva.id}/presencas`)
    );
    const estado = {};
    snapshot.forEach((doc) => {
      const data = doc.data();
      estado[data.parlamentarId] = data.registros || [];
    });
    setPresencas(estado);
  };

  useEffect(() => {
    if (sessaoAtiva) carregarPresencas();
  }, [sessaoAtiva]);

  const gerarRelatorioPDF = () => {
    const doc = new jsPDF();
    doc.text(`Registro de Presença - ${sessaoAtiva?.titulo || "Sessão"}`, 14, 14);

    const rows = [];
    parlamentares.forEach((p) => {
      const registros = presencas[p.id] || [];
      let tempoTotal = 0;

      const detalhes = registros.map((r) => {
        const entrada = r.entrada ? new Date(r.entrada) : null;
        const saida = r.saida ? new Date(r.saida) : null;
        if (entrada && saida) tempoTotal += saida - entrada;
        return `${entrada?.toLocaleTimeString() || "-"} → ${
          saida?.toLocaleTimeString() || "-"
        }`;
      });

      const totalMinutos = Math.floor(tempoTotal / 60000);
      const tempoFinal = `${Math.floor(totalMinutos / 60)}h ${
        totalMinutos % 60
      }min`;

      rows.push([p.nome, ...detalhes, tempoFinal]);
    });

    autoTable(doc, {
      head: [["Parlamentar", "Registros", "Tempo Total"]],
      body: rows,
    });

    doc.save("Relatorio_Presenca.pdf");
  };

  if (carregando) return <p>Carregando sessão...</p>;
  if (!sessaoAtiva) return <p>Nenhuma sessão ativa.</p>;

  return (
    <div style={{ padding: 20, maxWidth: 700, margin: "auto" }}>
      <h2>Registro de Presença</h2>
      <p>
        <strong>Sessão:</strong> - {sessaoAtiva?.data}
      </p>
      <p>
        <strong>ID da Sessão:</strong> {sessaoAtiva.id}
      </p>

      <button
        onClick={gerarRelatorioPDF}
        style={{ marginBottom: 20, backgroundColor: "#2d6cdf", color: "white", padding: "8px 14px", border: "none", borderRadius: 4 }}
      >
        Gerar Relatório de Presença (PDF)
      </button>

      {parlamentares.map((p) => {
        const registros = presencas[p.id] || [];
        const presente = registros.length > 0 && !registros[registros.length - 1].saida;

        return (
          <div
            key={p.id}
            style={{
              border: "1px solid #ccc",
              padding: 12,
              marginBottom: 10,
              borderRadius: 6,
              background: presente ? "#eafaf1" : "#fff5f5",
            }}
          >
            <strong>{p.nome}</strong>
            <div style={{ marginTop: 8 }}>
              {presente ? (
                <button
                  onClick={() => registrarSaida(p)}
                  style={{ backgroundColor: "#e74c3c", color: "white", padding: "6px 12px", border: "none", borderRadius: 4 }}
                >
                  Registrar Saída
                </button>
              ) : (
                <button
                  onClick={() => registrarEntrada(p)}
                  style={{ backgroundColor: "#2ecc71", color: "white", padding: "6px 12px", border: "none", borderRadius: 4 }}
                >
                  Registrar Entrada
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
