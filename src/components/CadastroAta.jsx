import React, { useState, useEffect } from "react";
import TopoInstitucional from "./TopoInstitucional";
import panelConfig from "../config/panelConfig.json";
import { db } from "../firebase";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  doc,
  deleteDoc
} from "firebase/firestore";

export default function CadastroAta() {
  const [sessoes, setSessoes] = useState([]);
  const [sessaoId, setSessaoId] = useState("");
  const [texto, setTexto] = useState("");
  const [falas, setFalas] = useState([]);
  const [status, setStatus] = useState("Pendente");
  const [atas, setAtas] = useState([]);
  const [selectedAta, setSelectedAta] = useState(null);
  const [loading, setLoading] = useState(false);
  const [legislaturas, setLegislaturas] = useState([]);
  const [sessoesLegislativas, setSessoesLegislativas] = useState([]);

  // Carrega sessões, legislaturas, sessões legislativas
  useEffect(() => {
    async function fetchDados() {
      const sessoesSnap = await getDocs(collection(db, "sessoes"));
      setSessoes(sessoesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      const legisSnap = await getDocs(collection(db, "legislaturas"));
      setLegislaturas(legisSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      const sessoesLegSnap = await getDocs(collection(db, "sessoesLegislativas"));
      setSessoesLegislativas(sessoesLegSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }
    fetchDados();
  }, []);

  // Carrega atas cadastradas
  useEffect(() => {
    async function fetchAtas() {
      const snap = await getDocs(collection(db, "atas"));
      setAtas(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }
    fetchAtas();
  }, [loading]);

  // Carrega falas e monta cabeçalho institucional da ata ao selecionar sessão (se não estiver editando)
  useEffect(() => {
    async function fetchFalasEMontarTexto() {
      if (!sessaoId) {
        setFalas([]);
        return;
      }
      // Falas
      const q = query(collection(db, "atasFalas"), where("sessaoId", "==", sessaoId));
      const snap = await getDocs(q);
      const falasSessao = snap.docs.map(doc => doc.data());
      setFalas(falasSessao);

      // Cabeçalho completo + falas no texto (somente ao criar nova ata, não ao editar)
      if (!selectedAta) {
        const sessao = sessoes.find(s => s.id === sessaoId);
        if (!sessao) return;

        // Legislatura pelo campo de referência da sessão
        let legislatura = legislaturas.find(l => l.id === sessao.idLegislatura || l.id === sessao.legislaturaId);

        let cabecalho = "";
        cabecalho += `${panelConfig.nomeCamara || "Câmara Municipal"}\n`;
        if (panelConfig.cidade) cabecalho += `${panelConfig.cidade}${panelConfig.uf ? " - " + panelConfig.uf : ""}\n`;
        cabecalho += "\n";
        if (legislatura) {
          cabecalho += `${legislatura.numero}ª Legislatura (${legislatura.anoInicio}–${legislatura.anoTermino}) — Presidente: ${legislatura.presidente}\n`;
        }
        cabecalho += "\n";
        cabecalho += `Resumo da Sessão:\n`;
        cabecalho += `Sessão: ${sessao.titulo || sessao.nome || sessao.id}\n`;
        if (
          sessao.numeroSessaoOrdinaria &&
          sessao.tipo &&
          sessao.numeroSessaoLegislativa &&
          legislatura &&
          legislatura.numero
        ) {
          cabecalho += `${sessao.numeroSessaoOrdinaria}ª Sessão Plenária ${sessao.tipo} - ${sessao.numeroSessaoLegislativa}ª Sessão Legislativa\n`;
        }
        cabecalho += "\n";
        cabecalho += `ATA DA SESSÃO ${sessao.tipo ? sessao.tipo.toUpperCase() : ""}\n`;
        cabecalho += `Data: ${sessao.data || ""}${sessao.hora ? "   Hora: " + sessao.hora : ""}${sessao.local ? "   Local: " + sessao.local : ""}\n`;
        if (sessao.presidente || sessao.secretario) {
          cabecalho += `Presidente: ${sessao.presidente || ""}${sessao.secretario ? "    Secretário: " + sessao.secretario : ""}\n`;
        }
        if (sessao.titulo) {
          cabecalho += `Título: ${sessao.titulo}\n`;
        }
        cabecalho += "--------------------------------------\n\n";

        // Bloco de falas AUTOMÁTICO no texto da ata
        let blocoFalas = "";
        if (falasSessao && falasSessao.length > 0) {
          blocoFalas += "Falas da Sessão:\n";
          falasSessao.forEach(f => {
            blocoFalas += `[${f.horario}] ${f.orador}${f.partido ? " (" + f.partido + ")" : ""}: "${f.fala}"\n`;
          });
          blocoFalas += "\n";
        }

        setTexto(cabecalho + blocoFalas);
      }
    }
    fetchFalasEMontarTexto();
    // eslint-disable-next-line
  }, [sessaoId, sessoes, legislaturas, sessoesLegislativas]);

  // Salva nova ata
  const salvarAta = async () => {
    if (!sessaoId || !texto) {
      alert("Selecione a sessão e preencha o texto da ata.");
      return;
    }
    setLoading(true);
    const now = new Date();
    await addDoc(collection(db, "atas"), {
      sessaoId,
      texto,
      falas,
      status,
      dataCriacao: now,
      dataAta: now.toISOString(),
    });
    setSessaoId("");
    setTexto("");
    setFalas([]);
    setStatus("Pendente");
    setLoading(false);
    alert("Ata salva com sucesso!");
  };

  // Seleciona ata para editar
  const abrirAta = (ata) => {
    setSelectedAta(ata);
    setSessaoId(ata.sessaoId);
    setTexto(ata.texto);
    setFalas(ata.falas || []);
    setStatus(ata.status || "Pendente");
  };

  // Atualiza ata existente
  const atualizarAta = async () => {
    if (!selectedAta) return;
    setLoading(true);
    await updateDoc(doc(db, "atas", selectedAta.id), {
      texto,
      status,
      falas
    });
    setSelectedAta(null);
    setSessaoId("");
    setTexto("");
    setFalas([]);
    setStatus("Pendente");
    setLoading(false);
    alert("Ata atualizada com sucesso!");
  };

  // Cancela edição
  const cancelarEdicao = () => {
    setSelectedAta(null);
    setSessaoId("");
    setTexto("");
    setFalas([]);
    setStatus("Pendente");
  };

  // Excluir ata
  const excluirAta = async (ataId) => {
    if (window.confirm("Tem certeza que deseja excluir esta ata?")) {
      setLoading(true);
      await deleteDoc(doc(db, "atas", ataId));
      setLoading(false);
      alert("Ata excluída com sucesso!");
    }
  };

  // ========== PDF INSTITUCIONAL ==========
  const gerarPDF = () => {
    const docPdf = new jsPDF();
    const margin = 16;
    let y = margin;

    // Logo institucional (se tiver caminho correto e imagem em public)
    if (panelConfig.logoPath) {
      try {
        docPdf.addImage(window.location.origin + panelConfig.logoPath, "PNG", margin, y, 28, 28);
      } catch {}
      y += 6;
    }

    // Nome da câmara e cabeçalho
    docPdf.setFontSize(14);
    docPdf.text(panelConfig.nomeCamara || "Câmara Municipal", margin + 32, margin + 12);
    y += 16;

    // Corpo do texto da ata
    docPdf.setFontSize(12);
    const ataLines = docPdf.splitTextToSize(texto, 180);
    docPdf.text(ataLines, margin, y + 14);

    let lastY = y + 14 + ataLines.length * 6;

    // Tabela de falas (se houver)
    if (falas && falas.length > 0) {
      autoTable(docPdf, {
        startY: lastY + 6,
        head: [["Nome", "Partido", "Horário", "Fala"]],
        body: falas.map(f => [f.orador, f.partido, f.horario, f.fala]),
        styles: { fontSize: 10 },
        margin: { left: margin, right: margin },
        theme: "grid"
      });
      lastY = docPdf.lastAutoTable.finalY;
    }

    // Espaço para assinaturas
    docPdf.setFontSize(11);
    docPdf.text("_____________________________", margin, 270);
    docPdf.text("Presidente", margin, 278);

    docPdf.text("_____________________________", 120, 270);
    docPdf.text("Secretário", 120, 278);

    // ===== NOVO NOME DE ARQUIVO PDF =====
    const sessao = sessoes.find(s => s.id === sessaoId);
    let nomeArquivo = "Ata";

    if (sessao) {
      let numeroSessao = "";
      if (sessao.numeroSessaoOrdinaria) {
        numeroSessao = `${sessao.numeroSessaoOrdinaria}ª Sessão Plenária ${sessao.tipo || ""}`;
      } else {
        numeroSessao = sessao.titulo || sessao.tipo || "";
      }
      // Formatar data para DD-MM-YYYY
      let dataSessao = "";
      if (sessao.data) {
        const partes = sessao.data.split("-");
        dataSessao = partes.length === 3
          ? `${partes[2]}-${partes[1]}-${partes[0]}`
          : sessao.data;
      }

      nomeArquivo = `Ata - ${numeroSessao.trim()} - ${dataSessao}`;
    }

    docPdf.save(`${nomeArquivo}.pdf`);
  };

  return (
    <div style={{ maxWidth: 900, margin: "40px auto", padding: 24, background: "#fff", borderRadius: 12, boxShadow: "0 4px 16px #eee" }}>
      <TopoInstitucional />

      <h2 style={{ marginTop: 12, marginBottom: 24, fontWeight: 700, fontSize: 26, textAlign: "center" }}>
        Cadastro de Ata
        <button
          onClick={gerarPDF}
          style={{
            marginLeft: 16,
            padding: "7px 22px",
            borderRadius: 6,
            background: "#0066cc",
            color: "#fff",
            fontWeight: 500,
            fontSize: 15,
            border: "none",
            cursor: "pointer",
            verticalAlign: "middle"
          }}
        >
          Gerar PDF da Ata
        </button>
      </h2>

      {/* Formulário de cadastro/edição */}
      <div style={{ marginBottom: 28 }}>
        <div>
          <label>
            <b>Sessão:</b>
            <select value={sessaoId} onChange={e => setSessaoId(e.target.value)} style={{ marginLeft: 10 }}>
              <option value="">Selecione a sessão</option>
              {sessoes.map(sessao => (
                <option key={sessao.id} value={sessao.id}>
                  {sessao.data} - {sessao.titulo || sessao.tipo}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div style={{ margin: "16px 0" }}>
          <label>
            <b>Texto da Ata:</b>
            <textarea
              value={texto}
              onChange={e => setTexto(e.target.value)}
              rows={13}
              style={{ width: "100%", fontFamily: "inherit", fontSize: 16, padding: 8 }}
              placeholder="Digite aqui o texto da ata, sumário da sessão etc..."
            />
          </label>
        </div>

        <div>
          <b>Falas da Sessão:</b>
          {falas.length === 0 ? (
            <div style={{ color: "#888" }}>Nenhuma fala encontrada para essa sessão.</div>
          ) : (
            <div style={{ border: "1px solid #eee", borderRadius: 8, marginTop: 8, maxHeight: 170, overflowY: "auto", background: "#fafbff" }}>
              <table style={{ width: "100%" }}>
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Partido</th>
                    <th>Horário</th>
                    <th>Fala</th>
                  </tr>
                </thead>
                <tbody>
                  {falas.map((f, idx) => (
                    <tr key={idx} style={{ fontSize: 15 }}>
                      <td>{f.orador}</td>
                      <td>{f.partido}</td>
                      <td>{f.horario}</td>
                      <td>{f.fala}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div style={{ marginTop: 16 }}>
          <label>
            <b>Status:</b>
            <select value={status} onChange={e => setStatus(e.target.value)} style={{ marginLeft: 10 }}>
              <option value="Pendente">Pendente</option>
              <option value="Aprovada">Aprovada</option>
              <option value="Rejeitada">Rejeitada</option>
            </select>
          </label>
        </div>

        {/* Botões de ação */}
        {selectedAta ? (
          <div style={{ marginTop: 18 }}>
            <button onClick={atualizarAta} disabled={loading} style={{ padding: "8px 22px", borderRadius: 6, background: "#22c55e", color: "#fff", fontWeight: 500, fontSize: 16, border: "none", marginRight: 12, cursor: "pointer" }}>
              Atualizar Ata
            </button>
            <button onClick={cancelarEdicao} style={{ padding: "8px 18px", borderRadius: 6, background: "#eee", color: "#333", fontWeight: 500, fontSize: 16, border: "none", cursor: "pointer" }}>
              Cancelar
            </button>
          </div>
        ) : (
          <button
            onClick={salvarAta}
            disabled={loading}
            style={{ marginTop: 18, padding: "10px 28px", borderRadius: 6, background: "#2563eb", color: "#fff", fontWeight: 500, fontSize: 17, border: "none", cursor: "pointer" }}
          >
            Salvar Ata
          </button>
        )}
      </div>

      {/* Lista de atas cadastradas */}
      <div>
        <h3>Atas já cadastradas</h3>
        {atas.length === 0 ? (
          <div style={{ color: "#888", marginTop: 10 }}>Nenhuma ata cadastrada ainda.</div>
        ) : (
          <table style={{ width: "100%", marginTop: 8, borderCollapse: "collapse", background: "#f9fafb", borderRadius: 6 }}>
            <thead>
              <tr style={{ background: "#f3f4f6" }}>
                <th style={{ padding: 6 }}>Sessão</th>
                <th style={{ padding: 6 }}>Data</th>
                <th style={{ padding: 6 }}>Status</th>
                <th style={{ padding: 6 }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {atas.map((ata, idx) => {
                const sessao = sessoes.find(s => s.id === ata.sessaoId);
                return (
                  <tr key={ata.id} style={{ borderTop: "1px solid #eee" }}>
                    <td style={{ padding: 5 }}>{sessao ? (sessao.titulo || sessao.tipo) : ata.sessaoId}</td>
                    <td style={{ padding: 5 }}>
                      {ata.dataAta
                        ? new Date(ata.dataAta).toLocaleDateString("pt-BR")
                        : sessao
                        ? sessao.data
                        : "--"}
                    </td>
                    <td style={{ padding: 5 }}>{ata.status}</td>
                    <td style={{ padding: 5 }}>
                      <button
                        onClick={() => abrirAta(ata)}
                        style={{
                          padding: "4px 13px",
                          borderRadius: 5,
                          background: "#3b82f6",
                          color: "#fff",
                          border: "none",
                          fontSize: 15,
                          cursor: "pointer",
                          marginRight: 8
                        }}
                      >
                        Visualizar / Editar
                      </button>
                      <button
                        onClick={() => excluirAta(ata.id)}
                        style={{
                          padding: "4px 13px",
                          borderRadius: 5,
                          background: "#ef4444",
                          color: "#fff",
                          border: "none",
                          fontSize: 15,
                          cursor: "pointer"
                        }}
                      >
                        Excluir
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
