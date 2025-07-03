import React, { useState, useEffect } from "react";
import { collection, addDoc, serverTimestamp, query, where, onSnapshot, orderBy } from "firebase/firestore";
import { db, storage } from "../firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

// TIPOS DE MATÉRIA (igual ao print)
const TIPOS_MATERIA = [
  "Projeto de Lei Ordinária",
  "Projeto de Lei Complementar",
  "Projeto de Resolução",
  "Projeto de Decreto Legislativo",
  "Projeto de Emenda à Lei Orgânica",
  "Requerimento",
  "Moção",
  "Emenda"
];

// TEMAS (EXATAMENTE IGUAL AO PRINT)
const TEMAS = [
  "Plano Plurianual – PPA",
  "Lei de Diretrizes Orçamentárias – LDO",
  "Lei Orçamentária Anual – LOA",
  "Legislação de Pessoal",
  "Legislação de Diárias",
  "Código Municipal de Saúde",
  "Código Municipal de Meio Ambiente",
  "Código Sanitário",
  "Código de Obras",
  "Código de Posturas",
  "Código Tributário",
  "Plano Diretor",
  "Estatuto do Servidor Público",
  "ISSQN (ISS)",
  "Código de Ética da Câmara",
  "Nenhum dos temas abaixo"
];

function gerarNumeroProtocolo() {
  const pad = n => String(n).padStart(2, "0");
  const d = new Date();
  const base = `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  const random = Math.random().toString(36).substring(2,5).toUpperCase();
  return `${base}-${random}`;
}

function statusColor(status) {
  switch (status) {
    case "Aguardando": return "#666";
    case "Aceito": return "#297f43";
    case "Rejeitado": return "#b02525";
    case "Finalizado": return "#1e59d9";
    default: return "#444";
  }
}

export default function CadastroProtocolo({ usuario }) {
  const nomeUsuario = usuario || "Desconhecido";
  const [tipo, setTipo] = useState("");
  const [tema, setTema] = useState("");
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [destino, setDestino] = useState("");
  const [arquivo, setArquivo] = useState(null);
  const [numeroProtocolo, setNumeroProtocolo] = useState(gerarNumeroProtocolo());
  const [enviando, setEnviando] = useState(false);
  const [protocolos, setProtocolos] = useState([]);

  useEffect(() => {
    if (!nomeUsuario) return;
    const q = query(
      collection(db, "protocolos"),
      where("autor", "==", nomeUsuario),
      orderBy("dataCadastro", "desc")
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      setProtocolos(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [nomeUsuario]);

  async function handleSubmit(e) {
    e.preventDefault();
    setEnviando(true);
    let arquivoUrl = "";

    if (arquivo) {
      const storageRef = ref(storage, `protocolos/${Date.now()}_${arquivo.name}`);
      await uploadBytes(storageRef, arquivo);
      arquivoUrl = await getDownloadURL(storageRef);
    }

    await addDoc(collection(db, "protocolos"), {
      numero: numeroProtocolo,
      tipo,
      tema,
      titulo,
      descricao,
      destino,
      arquivoUrl,
      autor: nomeUsuario,
      dataCadastro: serverTimestamp(),
      status: "Aguardando",
      statusHistorico: [
        {
          status: "Aguardando",
          data: new Date().toISOString(),
          usuario: nomeUsuario,
        },
      ],
    });

    setTipo("");
    setTema("");
    setTitulo("");
    setDescricao("");
    setDestino("");
    setArquivo(null);
    setNumeroProtocolo(gerarNumeroProtocolo());
    setEnviando(false);
    alert("Protocolo cadastrado com sucesso!");
  }

  return (
    <div>
      <form
        onSubmit={handleSubmit}
        style={{
          background: "#fff",
          padding: 24,
          borderRadius: 12,
          maxWidth: 720,
          margin: "32px auto",
          boxShadow: "0 2px 14px #0002"
        }}
      >
        <h2 style={{ textAlign: "center", color: "#1854b4" }}>Protocolar Matéria Legislativa</h2>
        <div style={{ display: "grid", gap: 18, gridTemplateColumns: "1fr 1fr" }}>
          <div>
            <label>Número do Protocolo</label>
            <input type="text" value={numeroProtocolo} readOnly style={{ fontWeight: "bold", color: "#1854b4" }}/>
          </div>
          <div>
            <label>Tipo de Projeto*</label>
            <select required value={tipo} onChange={e => setTipo(e.target.value)}>
              <option value="">Selecione...</option>
              {TIPOS_MATERIA.map(opt => <option key={opt}>{opt}</option>)}
            </select>
          </div>
          <div>
            <label>Tema*</label>
            <select required value={tema} onChange={e => setTema(e.target.value)}>
              <option value="">Selecione o tema...</option>
              {TEMAS.map(opt => <option key={opt}>{opt}</option>)}
            </select>
          </div>
          <div>
            <label>Título*</label>
            <input required value={titulo} onChange={e => setTitulo(e.target.value)} />
          </div>
          <div style={{ gridColumn: "1/3" }}>
            <label>Descrição*</label>
            <textarea
              required
              value={descricao}
              onChange={e => setDescricao(e.target.value)}
              rows={3}
              style={{ width: "100%" }}
            />
          </div>
          <div>
            <label>Destino</label>
            <input
              placeholder="Comissão, Mesa Diretora, etc"
              value={destino}
              onChange={e => setDestino(e.target.value)}
            />
          </div>
          <div>
            <label>Anexar PDF</label>
            <input
              type="file"
              accept=".pdf"
              onChange={e => setArquivo(e.target.files[0])}
            />
          </div>
          <div style={{ gridColumn: "1/2" }}>
            <label>Autor</label>
            <input
              type="text"
              value={nomeUsuario}
              readOnly
              style={{
                background: "#f1f7fc",
                color: "#1854b4",
                border: "1px solid #d3e0ef",
                fontWeight: "bold"
              }}
            />
          </div>
        </div>
        <div style={{ marginTop: 28, textAlign: "right" }}>
          <button
            type="submit"
            disabled={enviando}
            style={{
              background: "#1854b4",
              color: "#fff",
              padding: "12px 32px",
              border: "none",
              borderRadius: 8,
              fontSize: 16,
              cursor: "pointer"
            }}
          >
            {enviando ? "Enviando..." : "Protocolar Matéria"}
          </button>
        </div>
      </form>

      {/* LISTAGEM DOS PROTOCOLOS ENVIADOS */}
      <div style={{
        maxWidth: 820,
        margin: "20px auto",
        background: "#fff",
        borderRadius: 10,
        boxShadow: "0 2px 8px #0001",
        padding: 18
      }}>
        <h3 style={{ color: "#1854b4", marginBottom: 16 }}>Protocolos Enviados</h3>
        {protocolos.length === 0 && (
          <div style={{ color: "#666", padding: 16, textAlign: "center" }}>Nenhum protocolo enviado ainda.</div>
        )}
        {protocolos.length > 0 && (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 15 }}>
            <thead style={{ background: "#f8fafc" }}>
              <tr>
                <th style={th}>Protocolo</th>
                <th style={th}>Tipo</th>
                <th style={th}>Tema</th>
                <th style={th}>Título</th>
                <th style={th}>Destino</th>
                <th style={th}>Status</th>
                <th style={th}>Arquivo</th>
              </tr>
            </thead>
            <tbody>
              {protocolos.map((prot) => (
                <tr key={prot.id}>
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
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

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
