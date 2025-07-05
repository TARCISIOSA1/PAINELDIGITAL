import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import {
  collection,
  getDocs,
  query,
  orderBy,
} from "firebase/firestore";
import "./CentralConsulta.css";

// MANTÉM APENAS ESTAS ABAS
const ABAS = [
  { key: "usuarios", label: "Usuários" },
  { key: "parlamentares", label: "Parlamentares" },
  { key: "presencas", label: "Presenças" },
];

export default function CentralConsulta() {
  const [aba, setAba] = useState(ABAS[0].key);
  const [dados, setDados] = useState([]);
  const [loading, setLoading] = useState(false);
  const [detalhe, setDetalhe] = useState(null);
  const [filtro, setFiltro] = useState("");

  // Carrega dados da aba selecionada
  useEffect(() => {
    let ativo = true;
    setLoading(true);
    setDados([]);
    (async () => {
      let ref = collection(db, aba);
      let q = ref;
      if (aba === "parlamentares" || aba === "presencas") {
        q = query(ref, orderBy("nome", "asc"));
      }
      const snap = await getDocs(q);
      if (!ativo) return;
      setDados(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    })();
    return () => { ativo = false; };
  }, [aba]);

  const dadosFiltrados = dados.filter(item =>
    JSON.stringify(item).toLowerCase().includes(filtro.trim().toLowerCase())
  );

  return (
    <div className="central-consulta">
      <div className="abas">
        {ABAS.map(a =>
          <button
            key={a.key}
            className={aba === a.key ? "aba ativa" : "aba"}
            onClick={() => { setAba(a.key); setFiltro(""); setDetalhe(null); }}
          >
            {a.label}
          </button>
        )}
      </div>

      <div className="filtro-barra">
        <input
          placeholder="Filtrar por qualquer campo..."
          value={filtro}
          onChange={e => setFiltro(e.target.value)}
          style={{ marginBottom: 12, padding: 8, width: "100%", maxWidth: 340 }}
        />
        <span style={{ marginLeft: 15, color: "#888" }}>
          Total: {dadosFiltrados.length}
        </span>
      </div>

      {loading ? (
        <div className="carregando">Carregando dados...</div>
      ) : (
        <div className="tabela-consulta">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                {getColunasPrincipais(aba).map(col =>
                  <th key={col}>{formatarCampo(col)}</th>
                )}
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {dadosFiltrados.map(item =>
                <tr key={item.id}>
                  <td style={{ fontFamily: "monospace", fontSize: 13 }}>{item.id}</td>
                  {getColunasPrincipais(aba).map(col =>
                    <td key={col}>
                      {formatarValor(item[col], col)}
                    </td>
                  )}
                  <td>
                    <button className="btn-detalhe" onClick={() => setDetalhe(item)}>
                      Detalhes
                    </button>
                  </td>
                </tr>
              )}
              {dadosFiltrados.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ color: "#a00" }}>Nenhum registro encontrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {detalhe && (
        <div className="modal-detalhe" onClick={() => setDetalhe(null)}>
          <div className="conteudo-detalhe" onClick={e => e.stopPropagation()}>
            <button className="fechar" onClick={() => setDetalhe(null)}>X</button>
            <h3>Detalhes</h3>
            <DetalhesFormatados detalhe={detalhe} aba={aba} />
          </div>
        </div>
      )}
    </div>
  );
}

// CAMPOS PRINCIPAIS DE CADA ABA
function getColunasPrincipais(aba) {
  switch (aba) {
    case "usuarios":
    case "parlamentares":
      return ["nome", "email", "partido", "tipoUsuario", "status"];
    case "presencas":
      return ["parlamentar", "sessaoId", "status"];
    default:
      return [];
  }
}
function formatarCampo(campo) {
  switch (campo) {
    case "nome": return "Nome";
    case "email": return "Email";
    case "partido": return "Partido";
    case "tipoUsuario": return "Tipo";
    case "status": return "Status";
    case "parlamentar": return "Parlamentar";
    case "sessaoId": return "Sessão";
    default: return campo;
  }
}
function formatarValor(valor, col) {
  return valor ?? "";
}

// Detalhes formatados
function DetalhesFormatados({ detalhe, aba }) {
  switch (aba) {
    case "usuarios":
    case "parlamentares":
      return (
        <div className="box-detalhe">
          <b>Nome:</b> {detalhe.nome}<br />
          <b>Email:</b> {detalhe.email}<br />
          <b>Sexo:</b> {detalhe.sexo}<br />
          <b>Partido:</b> {detalhe.partido}<br />
          <b>Número do Partido:</b> {detalhe.numeroPartido}<br />
          <b>Número:</b> {detalhe.numero}<br />
          <b>Votos:</b> {detalhe.votos}<br />
          <b>Status:</b> {detalhe.status}<br />
          <b>Telefone:</b> {detalhe.telefone}<br />
          <b>Tipo de Usuário:</b> {detalhe.tipoUsuario}<br />
          {detalhe.foto && <img src={detalhe.foto} alt="Foto" style={{ maxWidth: 100, margin: 10, borderRadius: 8 }} />}
          {detalhe.biografia && (
            <div style={{ marginTop: 10 }}>
              <b>Biografia:</b>
              <div style={{ whiteSpace: "pre-line" }}>{detalhe.biografia}</div>
            </div>
          )}
        </div>
      );
    case "presencas":
      return (
        <div className="box-detalhe">
          <b>Parlamentar:</b> {detalhe.parlamentar}<br />
          <b>Sessão:</b> {detalhe.sessaoId}<br />
          <b>Status:</b> {detalhe.status}<br />
        </div>
      );
    default:
      return (
        <pre style={{ maxHeight: 350, overflowY: "auto", background: "#f9f9f9", padding: 10, borderRadius: 6 }}>
          {JSON.stringify(detalhe, null, 2)}
        </pre>
      );
  }
}
