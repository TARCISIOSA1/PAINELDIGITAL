import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import {
  collection,
  getDocs,
  query,
  orderBy,
} from "firebase/firestore";
import "./CentralConsulta.css";

// Lista de abas/coleções (nome interno, label bonitinho)
const ABAS = [
  { key: "usuarios", label: "Usuários" },
  { key: "parlamentares", label: "Parlamentares" },
  { key: "materias", label: "Matérias" },
  { key: "sessoes", label: "Sessões" },
  { key: "atas", label: "Atas" },
  { key: "comissoes", label: "Comissões" },
  { key: "presencas", label: "Presenças" },
  { key: "pautas", label: "Pautas" },
  { key: "reunioes_comissao", label: "Reuniões Comissão" },
  { key: "legislaturas", label: "Legislaturas" },
   // Adicione mais se quiser...
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
      // Ordenação básica (ajuste por aba se quiser)
      if (aba === "sessoes" || aba === "atas" || aba === "materias") {
        q = query(ref, orderBy("data", "desc"));
      }
      const snap = await getDocs(q);
      if (!ativo) return;
      setDados(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    })();
    return () => { ativo = false; };
  }, [aba]);

  // Filtro básico por texto
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
                {/* Exibe 3-5 colunas principais */}
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

      {/* Modal de detalhes bonitinho */}
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

// ---------------------
// Campos principais da lista de cada aba
function getColunasPrincipais(aba) {
  switch (aba) {
    case "usuarios":
    case "parlamentares":
      return ["nome", "email", "partido", "tipoUsuario", "status"];
    case "materias":
      return ["titulo", "autor", "status", "temaMateria"];
    case "sessoes":
      return ["data", "tipoSessao", "status", "presidente"];
    case "atas":
      return ["data", "sessaoId", "resumo"];
    case "comissoes":
      return ["nome", "presidente", "membros"];
    case "presencas":
      return ["parlamentar", "sessaoId", "status"];
    case "protocolos":
      return ["numero", "assunto", "status"];
    case "pautas":
      return ["sessaoId", "descricao"];
    case "reunioes_comissao":
      return ["comissao", "data", "status"];
    case "legislaturas":
      return ["descricao", "presidente", "status"];
    case "agenda":
      return ["parlamentar", "data", "titulo"];
    default:
      return [];
  }
}
// Para cabeçalho mais legível
function formatarCampo(campo) {
  switch (campo) {
    case "nome": return "Nome";
    case "email": return "Email";
    case "partido": return "Partido";
    case "tipoUsuario": return "Tipo";
    case "status": return "Status";
    case "titulo": return "Título";
    case "autor": return "Autor";
    case "data": return "Data";
    case "tipoSessao": return "Tipo";
    case "presidente": return "Presidente";
    case "sessaoId": return "Sessão";
    case "resumo": return "Resumo";
    case "membros": return "Membros";
    case "numero": return "Número";
    case "assunto": return "Assunto";
    case "descricao": return "Descrição";
    default: return campo;
  }
}

// Valor bonito na lista
function formatarValor(valor, col) {
  if (col === "data" || col === "dataSessao") {
    if (!valor) return "";
    return new Date(valor).toLocaleDateString("pt-BR");
  }
  if (col === "membros" && Array.isArray(valor)) {
    return valor.map(m => m.nome || m).join(", ");
  }
  return valor ?? "";
}

// ---------- Detalhes formatados ----------
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
    case "materias":
      return (
        <div className="box-detalhe">
          <b>Título:</b> {detalhe.titulo}<br />
          <b>Autor:</b> {detalhe.autor}<br />
          <b>Status:</b> {detalhe.status}<br />
          <b>Tipo:</b> {detalhe.temaMateria}<br />
          <b>Número:</b> {detalhe.numero}<br />
          <b>Ano:</b> {detalhe.ano}<br />
          <b>Resumo:</b> {detalhe.resumo}<br />
        </div>
      );
    case "sessoes":
      return (
        <div className="box-detalhe">
          <b>ID:</b> {detalhe.id}<br />
          <b>Data:</b> {detalhe.dataSessao || detalhe.data}<br />
          <b>Tipo:</b> {detalhe.tipoSessao}<br />
          <b>Status:</b> {detalhe.status}<br />
          <b>Presidente:</b> {detalhe.presidente}<br />
          <b>Local:</b> {detalhe.local}<br />
        </div>
      );
    case "atas":
      return (
        <div className="box-detalhe">
          <b>ID:</b> {detalhe.id}<br />
          <b>Sessão:</b> {detalhe.sessaoId}<br />
          <b>Data:</b> {detalhe.data}<br />
          <b>Resumo:</b> {detalhe.resumo || "--"}<br />
          {detalhe.pdf && (
            <div style={{ marginTop: 10 }}>
              <a href={detalhe.pdf} target="_blank" rel="noopener noreferrer" style={{ color: "#1566e8" }}>
                Ver PDF da Ata
              </a>
            </div>
          )}
        </div>
      );
    case "comissoes":
      return (
        <div className="box-detalhe">
          <b>Nome:</b> {detalhe.nome}<br />
          <b>Presidente:</b> {detalhe.presidente}<br />
          <b>Membros:</b> {(detalhe.membros && Array.isArray(detalhe.membros)) ? detalhe.membros.map(m => m.nome || m).join(", ") : ""}<br />
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
    case "protocolos":
      return (
        <div className="box-detalhe">
          <b>Número:</b> {detalhe.numero}<br />
          <b>Assunto:</b> {detalhe.assunto}<br />
          <b>Status:</b> {detalhe.status}<br />
        </div>
      );
    case "pautas":
      return (
        <div className="box-detalhe">
          <b>Sessão:</b> {detalhe.sessaoId}<br />
          <b>Descrição:</b> {detalhe.descricao}<br />
        </div>
      );
    case "reunioes_comissao":
      return (
        <div className="box-detalhe">
          <b>Comissão:</b> {detalhe.comissao}<br />
          <b>Data:</b> {detalhe.data}<br />
          <b>Status:</b> {detalhe.status}<br />
        </div>
      );
    case "legislaturas":
      return (
        <div className="box-detalhe">
          <b>Descrição:</b> {detalhe.descricao}<br />
          <b>Presidente:</b> {detalhe.presidente}<br />
          <b>Status:</b> {detalhe.status}<br />
        </div>
      );
    case "agenda":
      return (
        <div className="box-detalhe">
          <b>Parlamentar:</b> {detalhe.parlamentar}<br />
          <b>Data:</b> {detalhe.data}<br />
          <b>Título:</b> {detalhe.titulo}<br />
        </div>
      );
    default:
      // Se não mapeado, mostra o JSON para não perder nada
      return (
        <pre style={{ maxHeight: 350, overflowY: "auto", background: "#f9f9f9", padding: 10, borderRadius: 6 }}>
          {JSON.stringify(detalhe, null, 2)}
        </pre>
      );
  }
}
