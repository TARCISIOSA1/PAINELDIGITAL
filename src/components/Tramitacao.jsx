import React, { useEffect, useState } from "react";
import { db } from "../firebase"; // Corrija o caminho se necessário
import {
  collection,
  getDocs,
} from "firebase/firestore";

const statusOptions = ["Todos", "Ativo", "Arquivado", "Finalizada", "Em análise", "Em votação"];

function Tramitacao() {
  const [materias, setMaterias] = useState([]);
  const [filtroStatus, setFiltroStatus] = useState("Todos");
  const [busca, setBusca] = useState("");
  const [materiaSelecionada, setMateriaSelecionada] = useState(null);

  useEffect(() => {
    const fetchMaterias = async () => {
      try {
        const snapshot = await getDocs(collection(db, "materias"));
        const lista = snapshot.docs.map(doc => {
          const data = doc.data();
          const dataPadrao = data.data || "N/A";
          return {
            id: doc.id,
            titulo: data.titulo || "Sem título",
            status: data.status || "Indefinido",
            dataInicio: data.dataInicio || dataPadrao,
            ultimaAtualizacao: data.ultimaAtualizacao || dataPadrao,
            descricao: data.descricao || "",
            numero: data.numero || "",
            tipo: data.tipo || "",
            autor: data.autor || "",
            pareceres: data.pareceres || [],
            votos: data.votos || [],
            cronologia: data.cronologia || [],
            historico: data.historico || [{ data: dataPadrao, acao: "Matéria cadastrada" }]
          };
        });

        setMaterias(lista);
      } catch (error) {
        console.error("Erro ao buscar matérias:", error);
      }
    };

    fetchMaterias();
  }, []);

  // Filtragem (status + busca)
  const materiasFiltradas = materias.filter(m =>
    (filtroStatus === "Todos" || m.status === filtroStatus) &&
    (
      busca.trim() === "" ||
      m.titulo?.toLowerCase().includes(busca.toLowerCase()) ||
      m.numero?.toLowerCase().includes(busca.toLowerCase()) ||
      m.tipo?.toLowerCase().includes(busca.toLowerCase()) ||
      m.autor?.toLowerCase().includes(busca.toLowerCase())
    )
  );

  return (
    <div style={{ maxWidth: 1100, margin: "auto", padding: 20 }}>
      <h2>Consulta Pública da Tramitação das Matérias Legislativas</h2>
      <div style={{ margin: "18px 0", display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
        <label>
          Status:{" "}
          <select
            value={filtroStatus}
            onChange={e => setFiltroStatus(e.target.value)}
          >
            {statusOptions.map(status => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
        <input
          type="text"
          placeholder="Buscar por título, número, tipo ou autor..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
          style={{ padding: 8, fontSize: 16, width: 320, borderRadius: 8, border: "1px solid #ccc" }}
        />
      </div>
      <table
        border="1"
        cellPadding="10"
        style={{
          borderCollapse: "collapse",
          width: "100%",
          marginTop: "1rem",
          background: "#fff"
        }}
      >
        <thead style={{ background: "#f5f7fa" }}>
          <tr>
            <th>Número</th>
            <th>Título</th>
            <th>Tipo</th>
            <th>Status</th>
            <th>Autor</th>
            <th>Data Início</th>
            <th>Última Atualização</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {materiasFiltradas.map(m => (
            <tr
              key={m.id}
              style={{
                cursor: "pointer",
                backgroundColor: materiaSelecionada?.id === m.id ? "#f0f8ff" : "transparent"
              }}
            >
              <td>{m.numero}</td>
              <td>{m.titulo}</td>
              <td>{m.tipo}</td>
              <td>{m.status}</td>
              <td>{m.autor}</td>
              <td>{m.dataInicio}</td>
              <td>{m.ultimaAtualizacao}</td>
              <td>
                <button onClick={() => setMateriaSelecionada(m)}>Ver detalhes</button>
              </td>
            </tr>
          ))}
          {materiasFiltradas.length === 0 && (
            <tr>
              <td colSpan="8" style={{ textAlign: "center" }}>
                Nenhuma matéria encontrada.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {materiaSelecionada && (
        <div
          style={{
            marginTop: "2rem",
            padding: "1.5rem",
            border: "1px solid #1976d2",
            borderRadius: "12px",
            backgroundColor: "#f8fafd"
          }}
        >
          <h3>Resumo da Tramitação</h3>
          <p><b>Número:</b> {materiaSelecionada.numero}</p>
          <p><b>Título:</b> {materiaSelecionada.titulo}</p>
          <p><b>Tipo:</b> {materiaSelecionada.tipo}</p>
          <p><b>Status:</b> {materiaSelecionada.status}</p>
          <p><b>Autor:</b> {materiaSelecionada.autor}</p>
          <p><b>Data Início:</b> {materiaSelecionada.dataInicio}</p>
          <p><b>Última Atualização:</b> {materiaSelecionada.ultimaAtualizacao}</p>
          <p><b>Descrição:</b> {materiaSelecionada.descricao}</p>
          <hr />
          <b>Histórico/Cronologia:</b>
          <ul>
            {(materiaSelecionada.cronologia && materiaSelecionada.cronologia.length > 0)
              ? materiaSelecionada.cronologia.map((item, idx) => (
                <li key={idx}>
                  <b>{item.data}:</b> {item.descricao || item.acao}
                </li>
              ))
              : (
                materiaSelecionada.historico && materiaSelecionada.historico.length > 0
                  ? materiaSelecionada.historico.map((item, idx) => (
                    <li key={idx}>
                      <b>{item.data}:</b> {item.acao}
                    </li>
                  ))
                  : <li>Nenhum registro disponível.</li>
              )}
          </ul>
          <b>Pareceres:</b>
          <ul>
            {materiaSelecionada.pareceres && materiaSelecionada.pareceres.length > 0
              ? materiaSelecionada.pareceres.map((p, i) => (
                <li key={i}>{p.data}: {p.descricao || p.resumo || p.tipo}</li>
              ))
              : <li>Nenhum parecer registrado.</li>
            }
          </ul>
          <b>Votos:</b>
          <ul>
            {materiaSelecionada.votos && materiaSelecionada.votos.length > 0
              ? materiaSelecionada.votos.map((v, i) => (
                <li key={i}>
                  {v.data}: {v.resultado} ({v.descricao || v.obs || v.tipo || "Voto"})
                </li>
              ))
              : <li>Nenhum voto registrado.</li>
            }
          </ul>
          <button onClick={() => setMateriaSelecionada(null)} style={{
            marginTop: 14, background: "#1976d2", color: "#fff", padding: "10px 30px", border: "none", borderRadius: 8
          }}>
            Fechar detalhes
          </button>
        </div>
      )}
    </div>
  );
}

export default Tramitacao;
