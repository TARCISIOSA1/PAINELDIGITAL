import React, { useEffect, useState } from "react";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";

// Lista de status possíveis
const STATUS = [
  "Aguardando",
  "Aceito",
  "Rejeitado",
  "Em Análise",
  "Em Atendimento",
  "Finalizado",
  "Indeferido",
];

export default function PainelProtocolosAdmin() {
  const [protocolos, setProtocolos] = useState([]);
  const [filtroSetor, setFiltroSetor] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");
  const [buscaTitulo, setBuscaTitulo] = useState("");
  const [atualizando, setAtualizando] = useState(false);
  const [detalhe, setDetalhe] = useState(null);

  // Carrega protocolos em tempo real, do mais novo para o mais antigo
  useEffect(() => {
    const q = query(collection(db, "protocolos"), orderBy("dataCadastro", "desc"));
    const unsubscribe = onSnapshot(q, (snap) => {
      setProtocolos(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  // Filtros dinâmicos
  const protocolosFiltrados = protocolos
    .filter((p) => !filtroSetor || p.destino === filtroSetor)
    .filter((p) => !filtroStatus || p.status === filtroStatus)
    .filter((p) =>
      buscaTitulo
        ? (p.titulo || "")
            .toLowerCase()
            .includes(buscaTitulo.toLowerCase())
        : true
    );

  // Função para gerar número automático (exemplo simples usando timestamp)
  const gerarNumero = () => `${Date.now()}`.slice(-6);

  // ACEITAR: cria matéria com TODOS OS CAMPOS
  const aceitarProtocolo = async (protocolo) => {
    setAtualizando(true);
    const numero = gerarNumero();
    // Cria nova matéria
    const materiaRef = await addDoc(collection(db, "materias"), {
      numero,
      tipo: protocolo.tipo,
      tema: protocolo.tema,
      titulo: protocolo.titulo,
      descricao: protocolo.descricao,
      destino: protocolo.destino || "",
      arquivoUrl: protocolo.arquivoUrl || "",
      autor: protocolo.autor,
      data: new Date().toISOString().slice(0, 10),
      status: "Ativo",
      faseVotacao: "Em análise",
    });
    // Atualiza protocolo
    await updateDoc(doc(db, "protocolos", protocolo.id), {
      status: "Aceito",
      materiaId: materiaRef.id,
      numero,
      statusHistorico: [
        ...(protocolo.statusHistorico || []),
        {
          status: "Aceito",
          data: new Date().toISOString(),
          usuario: "Admin",
        },
      ],
    });
    setAtualizando(false);
    alert("Protocolo aceito e matéria criada!");
  };

  const recusarProtocolo = async (protocolo) => {
    setAtualizando(true);
    await updateDoc(doc(db, "protocolos", protocolo.id), {
      status: "Rejeitado",
      statusHistorico: [
        ...(protocolo.statusHistorico || []),
        {
          status: "Rejeitado",
          data: new Date().toISOString(),
          usuario: "Admin",
        },
      ],
    });
    setAtualizando(false);
    alert("Protocolo rejeitado!");
  };

  // Pega todos destinos registrados nos protocolos
  const todosDestinos = [
    ...new Set(protocolos.map((p) => p.destino).filter(Boolean)),
  ];

  return (
    <div style={{
      maxWidth: 1150,
      margin: "40px auto",
      background: "#fff",
      borderRadius: 12,
      padding: 24,
      boxShadow: "0 2px 16px #0001"
    }}>
      <h2 style={{ color: "#1854b4" }}>Painel de Protocolos (Admin)</h2>

      <div style={{ display: "flex", gap: 28, marginBottom: 24, flexWrap: "wrap" }}>
        <div>
          <label>Filtrar por Destino: </label>
          <select value={filtroSetor} onChange={e => setFiltroSetor(e.target.value)}>
            <option value="">Todos</option>
            {todosDestinos.map(destino => (
              <option key={destino}>{destino}</option>
            ))}
          </select>
        </div>
        <div>
          <label>Filtrar por Status: </label>
          <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}>
            <option value="">Todos</option>
            {STATUS.map(st => (
              <option key={st}>{st}</option>
            ))}
          </select>
        </div>
        <div>
          <label>Buscar por Título: </label>
          <input
            type="text"
            value={buscaTitulo}
            onChange={e => setBuscaTitulo(e.target.value)}
            placeholder="Digite o título..."
            style={{ padding: 3, borderRadius: 5, border: "1px solid #ddd" }}
          />
        </div>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ background: "#f6f8fc" }}>
            <tr>
              <th style={th}>Data</th>
              <th style={th}>Nº Protocolo</th>
              <th style={th}>Tipo</th>
              <th style={th}>Tema</th>
              <th style={th}>Título</th>
              <th style={th}>Destino</th>
              <th style={th}>Status</th>
              <th style={th}>Arquivo</th>
              <th style={th}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {protocolosFiltrados.length === 0 && (
              <tr>
                <td colSpan={9} style={{ textAlign: "center", padding: 24, color: "#888" }}>
                  Nenhum protocolo encontrado.
                </td>
              </tr>
            )}
            {protocolosFiltrados.map((prot, i) => (
              <tr key={prot.id}>
                <td style={td}>
                  {prot.dataCadastro?.toDate
                    ? prot.dataCadastro.toDate().toLocaleDateString()
                    : ""}
                </td>
                <td style={td}>{prot.numero}</td>
                <td style={td}>{prot.tipo}</td>
                <td style={td}>{prot.tema}</td>
                <td style={td}>{prot.titulo}</td>
                <td style={td}>{prot.destino}</td>
                <td style={{ ...td, fontWeight: 600, color: statusColor(prot.status) }}>
                  {prot.status}
                </td>
                <td style={td}>
                  {prot.arquivoUrl
                    ? <a href={prot.arquivoUrl} target="_blank" rel="noopener noreferrer">Baixar</a>
                    : "-"}
                </td>
                <td style={td}>
                  {prot.status === "Aguardando" && (
                    <>
                      <button onClick={() => aceitarProtocolo(prot)} disabled={atualizando}>
                        Aceitar
                      </button>
                      <button
                        onClick={() => recusarProtocolo(prot)}
                        style={{ marginLeft: 8, background: "#e66", color: "#fff", border: "none", borderRadius: 4 }}
                        disabled={atualizando}
                      >
                        Rejeitar
                      </button>
                    </>
                  )}
                  <button onClick={() => setDetalhe(prot)} style={{ marginLeft: 8 }}>
                    Detalhes
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal de detalhes */}
      {detalhe && (
        <div style={{
          position: "fixed", left: 0, top: 0, width: "100vw", height: "100vh",
          background: "#0007", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center"
        }}>
          <div style={{
            background: "#fff", borderRadius: 10, padding: 28, minWidth: 340, maxWidth: 600, boxShadow: "0 2px 24px #0003"
          }}>
            <h3 style={{ marginBottom: 6 }}>{detalhe.titulo}</h3>
            <p><b>Nº Protocolo:</b> {detalhe.numero}</p>
            <p><b>Tipo:</b> {detalhe.tipo}</p>
            <p><b>Tema:</b> {detalhe.tema}</p>
            <p><b>Destino:</b> {detalhe.destino}</p>
            <p><b>Descrição:</b> {detalhe.descricao}</p>
            <p><b>Status Atual:</b> <span style={{ color: statusColor(detalhe.status), fontWeight: 600 }}>{detalhe.status}</span></p>
            <p><b>Autor:</b> {detalhe.autor}</p>
            <p><b>Histórico de Status:</b></p>
            <ul style={{ fontSize: 14, color: "#555", maxHeight: 120, overflow: "auto" }}>
              {(detalhe.statusHistorico || []).map((h, i) => (
                <li key={i}>
                  <b>{h.status}</b> - {formatarData(h.data)} por {h.usuario}
                </li>
              ))}
            </ul>
            {detalhe.arquivoUrl && (
              <p><b>Anexo:</b> <a href={detalhe.arquivoUrl} target="_blank" rel="noopener noreferrer">Baixar</a></p>
            )}
            <div style={{ textAlign: "right", marginTop: 18 }}>
              <button onClick={() => setDetalhe(null)}>Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Estilos para tabela
const th = {
  padding: 8,
  borderBottom: "1px solid #ddd",
  textAlign: "left",
  fontWeight: 600,
  fontSize: 15,
  background: "#f8fafc",
};

const td = {
  padding: 8,
  borderBottom: "1px solid #eee",
  fontSize: 15,
};

function statusColor(status) {
  switch (status) {
    case "Aguardando":
      return "#666";
    case "Aceito":
      return "#297f43";
    case "Rejeitado":
    case "Indeferido":
      return "#b02525";
    case "Finalizado":
      return "#1e59d9";
    case "Em Análise":
    case "Em Atendimento":
      return "#d98c0a";
    default:
      return "#444";
  }
}

function formatarData(str) {
  if (!str) return "";
  const d = new Date(str);
  if (isNaN(d)) return str;
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString().slice(0, 5)}`;
}
