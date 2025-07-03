import React, { useEffect, useState } from "react";
import { collection, getDocs, doc, getDoc, query, where } from "firebase/firestore";
import { db } from "../firebase";
import jsPDF from "jspdf";

const styles = {
  container: {
    maxWidth: 900,
    margin: "30px auto",
    padding: 25,
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    backgroundColor: "#fff",
    borderRadius: 12,
    boxShadow: "0 2px 15px rgba(0,0,0,0.1)",
  },
  title: {
    fontSize: 28,
    marginBottom: 25,
    color: "#222",
  },
  listItem: {
    borderBottom: "1px solid #eee",
    padding: "12px 0",
  },
  button: {
    backgroundColor: "#4a90e2",
    color: "#fff",
    border: "none",
    padding: "8px 16px",
    borderRadius: 8,
    cursor: "pointer",
    marginTop: 8,
  },
  detailTitle: {
    fontSize: 22,
    marginBottom: 12,
    color: "#2c3e50",
  },
  paragraph: {
    marginBottom: 10,
    lineHeight: 1.5,
  },
  textarea: {
    width: "100%",
    minHeight: 80,
    marginTop: 12,
    padding: 10,
    borderRadius: 6,
    border: "1px solid #ccc",
    fontSize: 15,
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
  },
  backBtn: {
    backgroundColor: "#ccc",
    color: "#333",
    border: "none",
    padding: "8px 14px",
    borderRadius: 8,
    cursor: "pointer",
    marginBottom: 20,
  },
};

export default function VisualizacaoAtas() {
  const [atas, setAtas] = useState([]);
  const [loadingLista, setLoadingLista] = useState(true);
  const [error, setError] = useState(null);

  const [ataSelecionadaId, setAtaSelecionadaId] = useState(null);
  const [ataSelecionada, setAtaSelecionada] = useState(null);
  const [falas, setFalas] = useState([]);
  const [loadingDetalhe, setLoadingDetalhe] = useState(false);
  const [observacao, setObservacao] = useState("");

  useEffect(() => {
    async function carregarAtas() {
      setLoadingLista(true);
      try {
        const snap = await getDocs(collection(db, "atas"));
        const lista = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setAtas(lista);
        setError(null);
      } catch (e) {
        setError("Erro ao carregar atas: " + e.message);
      }
      setLoadingLista(false);
    }
    carregarAtas();
  }, []);

  useEffect(() => {
    if (!ataSelecionadaId) return;

    async function carregarDetalhe() {
      setLoadingDetalhe(true);
      try {
        const ataSnap = await getDoc(doc(db, "atas", ataSelecionadaId));
        if (ataSnap.exists()) {
          setAtaSelecionada(ataSnap.data());
        } else {
          setAtaSelecionada(null);
        }

        const q = query(collection(db, "atasFalas"), where("sessaoId", "==", ataSelecionadaId));
        const falasSnap = await getDocs(q);
        setFalas(falasSnap.docs.map(doc => doc.data()));

        setObservacao("");
        setError(null);
      } catch (e) {
        setError("Erro ao carregar detalhes da ata: " + e.message);
        setAtaSelecionada(null);
        setFalas([]);
      }
      setLoadingDetalhe(false);
    }

    carregarDetalhe();
  }, [ataSelecionadaId]);

  function gerarPDF() {
    if (!ataSelecionada) return;

    const docPDF = new jsPDF();
    docPDF.setFontSize(14);
    docPDF.text("Câmara Municipal de Santa Maria", 14, 15);
    docPDF.setFontSize(18);
    docPDF.text("ATA DA SESSÃO", 14, 25);
    docPDF.setFontSize(12);
    docPDF.text(`Sessão: ${ataSelecionada.sessaoId}`, 14, 35);
    docPDF.text(`Data: ${ataSelecionada.dataAta}`, 14, 42);
    docPDF.text(`Status: ${ataSelecionada.status}`, 14, 49);

    let y = 60;
    docPDF.text("Resumo da Sessão:", 14, y);
    y += 8;

    const resumo = docPDF.splitTextToSize(ataSelecionada.texto || "", 180);
    docPDF.text(resumo, 14, y);
    y += resumo.length * 8;

    if (observacao) {
      docPDF.text("Observações / Complementos:", 14, y);
      y += 8;
      const obs = docPDF.splitTextToSize(observacao, 180);
      docPDF.text(obs, 14, y);
      y += obs.length * 8;
    }

    if (falas.length > 0) {
      docPDF.text("Falas Registradas:", 14, y);
      y += 8;
      falas.forEach((f, idx) => {
        const falaText = `${idx + 1}. ${f.horario || ""} - ${f.orador || ""} (${f.partido || ""}): ${f.fala || ""}`;
        const falaDividida = docPDF.splitTextToSize(falaText, 180);
        if (y + falaDividida.length * 8 > 280) {
          docPDF.addPage();
          y = 15;
        }
        docPDF.text(falaDividida, 14, y);
        y += falaDividida.length * 8;
      });
    }

    docPDF.save(`ATA_${ataSelecionada.sessaoId || "sessao"}.pdf`);
  }

  if (loadingLista) return <p>Carregando atas...</p>;
  if (error) return <p style={{ color: "red" }}>{error}</p>;

  if (ataSelecionadaId) {
    if (loadingDetalhe) return <p>Carregando detalhes da ata...</p>;
    if (!ataSelecionada)
      return (
        <div>
          <button style={styles.backBtn} onClick={() => setAtaSelecionadaId(null)}>
            ← Voltar para lista
          </button>
          <p>Ata não encontrada.</p>
        </div>
      );

    return (
      <div style={styles.container}>
        <button style={styles.backBtn} onClick={() => setAtaSelecionadaId(null)}>
          ← Voltar para lista
        </button>

        <h2 style={styles.detailTitle}>Ata da Sessão {ataSelecionada.sessaoId}</h2>

        <p style={styles.paragraph}>
          <b>Data:</b> {ataSelecionada.dataAta}
        </p>
        <p style={styles.paragraph}>
          <b>Status:</b> {ataSelecionada.status}
        </p>
        <p style={styles.paragraph}>
          <b>Resumo:</b> {ataSelecionada.texto}
        </p>

        <label>
          <b>Observações / Complementos:</b>
          <textarea
            style={styles.textarea}
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            placeholder="Adicione observações antes de gerar o PDF"
          />
        </label>

        <h3>Falas Registradas:</h3>
        {falas.length === 0 ? (
          <p>Nenhuma fala registrada.</p>
        ) : (
          <ul>
            {falas.map((f, i) => (
              <li key={i}>
                {f.horario} - {f.orador} ({f.partido}): {f.fala}
              </li>
            ))}
          </ul>
        )}

        <button style={styles.button} onClick={gerarPDF}>
          📥 Baixar PDF da Ata
        </button>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Visualização das Atas</h1>

      {atas.length === 0 ? (
        <p>Nenhuma ata cadastrada.</p>
      ) : (
        <ul>
          {atas.map((ata) => (
            <li key={ata.id} style={styles.listItem}>
              <b>{ata.sessaoId}</b> — {ata.dataAta} — Status: {ata.status}
              <br />
              Resumo: {ata.texto.substring(0, 100)}...
              <br />
              <button style={styles.button} onClick={() => setAtaSelecionadaId(ata.id)}>
                Visualizar Detalhes
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
