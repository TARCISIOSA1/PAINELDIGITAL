import React, { useState, useEffect } from "react";
import {
  collection,
  query,
  getDocs,
  orderBy,
} from "firebase/firestore";
import { db } from "../firebase";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import "./RelatoriosPlenaria.css";

const abas = [
  { label: "Sessões", key: "sessoes" },
  { label: "Presenças", key: "presencas" },
  { label: "Votações", key: "votacoes" },
  { label: "Projetos", key: "projetos" },
  { label: "Comissões", key: "comissoes" },
];

export default function RelatoriosPlenaria() {
  const [aba, setAba] = useState("sessoes");
  const [dados, setDados] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [filtroDataInicio, setFiltroDataInicio] = useState("");
  const [filtroDataFim, setFiltroDataFim] = useState("");
  const [filtroParlamentar, setFiltroParlamentar] = useState("");
  const [parlamentares, setParlamentares] = useState([]);
  const [sessoes, setSessoes] = useState([]);
  const [sessaoSelecionada, setSessaoSelecionada] = useState("");

  // Busca lista de parlamentares
  useEffect(() => {
    async function fetchParlamentares() {
      const snap = await getDocs(collection(db, "parlamentares"));
      setParlamentares(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }
    fetchParlamentares();
  }, []);

  // Busca lista de sessões (usado só na aba presenças)
  useEffect(() => {
    if (aba !== "presencas") return;
    async function fetchSessoes() {
      const q = query(collection(db, "sessoes"), orderBy("data", "desc"));
      const snap = await getDocs(q);
      const lista = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        dataFormatada: doc.data().data
          ? new Date(
              doc.data().data.seconds
                ? doc.data().data.seconds * 1000
                : doc.data().data
            ).toLocaleDateString()
          : "",
      }));
      setSessoes(lista);
      if (lista.length > 0 && !sessaoSelecionada) setSessaoSelecionada(lista[0].id);
    }
    fetchSessoes();
    // eslint-disable-next-line
  }, [aba]);

  // Busca dados conforme aba/filtros
  useEffect(() => {
    async function fetchDados() {
      setCarregando(true);
      let lista = [];
      if (aba === "sessoes") {
        const q = query(collection(db, "sessoes"), orderBy("data", "desc"));
        const snap = await getDocs(q);
        lista = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } else if (aba === "presencas") {
        if (!sessaoSelecionada) {
          setDados([]);
          setCarregando(false);
          return;
        }
        const presencaRef = collection(db, `sessoes/${sessaoSelecionada}/presencas`);
        const snap = await getDocs(presencaRef);
        lista = snap.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));
        lista = lista.map(item => ({
          ...item,
          sessao_id: sessaoSelecionada,
        }));
      } else if (aba === "votacoes") {
        const q = query(collection(db, "votacoes"), orderBy("data", "desc"));
        const snap = await getDocs(q);
        lista = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } else if (aba === "projetos") {
        const q = query(collection(db, "materias"), orderBy("data", "desc"));
        const snap = await getDocs(q);
        lista = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } else if (aba === "comissoes") {
        const q = query(collection(db, "comissoes"), orderBy("nome", "asc"));
        const snap = await getDocs(q);
        lista = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      }

      // Filtro de data (usa campo data ou dataCriacao)
      if (filtroDataInicio && aba !== "presencas") {
        lista = lista.filter(item =>
          (item.data || item.dataCriacao) &&
          new Date(item.data || item.dataCriacao) >= new Date(filtroDataInicio)
        );
      }
      if (filtroDataFim && aba !== "presencas") {
        lista = lista.filter(item =>
          (item.data || item.dataCriacao) &&
          new Date(item.data || item.dataCriacao) <= new Date(filtroDataFim + "T23:59:59")
        );
      }

      // Filtro de parlamentar (aba presenças e votações)
      if (filtroParlamentar && (aba === "presencas" || aba === "votacoes")) {
        lista = lista.filter(item =>
          (item.parlamentarId && item.parlamentarId === filtroParlamentar) ||
          (item.vereador_id && item.vereador_id === filtroParlamentar) ||
          (item.vereadores && item.vereadores.includes && item.vereadores.includes(filtroParlamentar))
        );
      }

      setDados(lista);
      setCarregando(false);
    }
    fetchDados();
    // eslint-disable-next-line
  }, [aba, filtroDataInicio, filtroDataFim, filtroParlamentar, sessaoSelecionada]);

  // Exportar PDF
  function exportarPDF() {
    const doc = new jsPDF();
    doc.text(`Relatório de ${abas.find(a => a.key === aba).label}`, 14, 16);
    let columns = [];
    let rows = [];
    if (aba === "sessoes") {
      columns = ["Data", "Tipo", "Presidente", "Status"];
      rows = dados.map(item => [
        item.data ? new Date(item.data.seconds ? item.data.seconds * 1000 : item.data).toLocaleDateString() : "",
        item.tipoSessao || "",
        item.presidente || "",
        item.status || "",
      ]);
    } else if (aba === "presencas") {
      columns = ["Parlamentar", "ID", "Registros", "Tempo Total"];
      rows = dados.map(item => {
        let tempoTotal = 0;
        const detalhes = (item.registros || []).map(r => {
          const entrada = r.entrada ? new Date(r.entrada) : null;
          const saida = r.saida ? new Date(r.saida) : null;
          if (entrada && saida) tempoTotal += saida - entrada;
          return `${entrada?.toLocaleTimeString() || "-"} → ${saida?.toLocaleTimeString() || "-"}`;
        });
        const totalMinutos = Math.floor(tempoTotal / 60000);
        const tempoFinal = tempoTotal ? `${Math.floor(totalMinutos / 60)}h ${totalMinutos % 60}min` : "-";
        return [
          item.nome || (parlamentares.find(v => v.id === item.parlamentarId)?.nome) || item.parlamentarId || item.id,
          item.parlamentarId || item.id,
          detalhes.join(" | ") || "-",
          tempoFinal,
        ];
      });
    } else if (aba === "votacoes") {
      columns = ["Data", "Matéria", "Parlamentar", "Voto"];
      rows = dados.map(item => [
        item.data ? new Date(item.data.seconds ? item.data.seconds * 1000 : item.data).toLocaleDateString() : "",
        item.materia || "",
        (parlamentares.find(v => v.id === item.vereador_id)?.nome) || item.vereador_id || "",
        item.voto || "",
      ]);
    } else if (aba === "projetos") {
      columns = ["Código", "Número", "Autor", "Tipo", "Status", "Data"];
      rows = dados.map(item => [
        item.codigo || item.id,
        item.numero || item.numeroProjeto || "", // NOVO CAMPO
        item.autor || "",
        item.tipoProjeto || item.tipo || "",
        item.status || "",
        item.data ? new Date(item.data.seconds ? item.data.seconds * 1000 : item.data).toLocaleDateString() : "",
      ]);
    } else if (aba === "comissoes") {
      columns = ["Nome", "Tipo", "Membros"];
      rows = dados.map(item => [
        item.nome || "",
        item.tipo || "",
        (item.membros || []).map(id => (parlamentares.find(v => v.id === id)?.nome || id)).join(", "),
      ]);
    }
    autoTable(doc, { head: [columns], body: rows });
    doc.save(`relatorio-${aba}-${Date.now()}.pdf`);
  }

  // Exportar Excel
  function exportarExcel() {
    let columns = [];
    let rows = [];
    if (aba === "sessoes") {
      columns = ["Data", "Tipo", "Presidente", "Status"];
      rows = dados.map(item => ({
        Data: item.data ? new Date(item.data.seconds ? item.data.seconds * 1000 : item.data).toLocaleDateString() : "",
        Tipo: item.tipoSessao || "",
        Presidente: item.presidente || "",
        Status: item.status || "",
      }));
    } else if (aba === "presencas") {
      columns = ["Parlamentar", "ID", "Registros", "Tempo Total"];
      rows = dados.map(item => {
        let tempoTotal = 0;
        const detalhes = (item.registros || []).map(r => {
          const entrada = r.entrada ? new Date(r.entrada) : null;
          const saida = r.saida ? new Date(r.saida) : null;
          if (entrada && saida) tempoTotal += saida - entrada;
          return `${entrada?.toLocaleTimeString() || "-"} → ${saida?.toLocaleTimeString() || "-"}`;
        });
        const totalMinutos = Math.floor(tempoTotal / 60000);
        const tempoFinal = tempoTotal ? `${Math.floor(totalMinutos / 60)}h ${totalMinutos % 60}min` : "-";
        return {
          Parlamentar: item.nome || (parlamentares.find(v => v.id === item.parlamentarId)?.nome) || item.parlamentarId || item.id,
          ID: item.parlamentarId || item.id,
          Registros: detalhes.join(" | ") || "-",
          "Tempo Total": tempoFinal,
        };
      });
    } else if (aba === "votacoes") {
      columns = ["Data", "Matéria", "Parlamentar", "Voto"];
      rows = dados.map(item => ({
        Data: item.data ? new Date(item.data.seconds ? item.data.seconds * 1000 : item.data).toLocaleDateString() : "",
        Matéria: item.materia || "",
        Parlamentar: (parlamentares.find(v => v.id === item.vereador_id)?.nome) || item.vereador_id || "",
        Voto: item.voto || "",
      }));
    } else if (aba === "projetos") {
      columns = ["Código", "Número", "Autor", "Tipo", "Status", "Data"];
      rows = dados.map(item => ({
        Código: item.codigo || item.id,
        Número: item.numero || item.numeroProjeto || "", // NOVO CAMPO
        Autor: item.autor || "",
        Tipo: item.tipoProjeto || item.tipo || "",
        Status: item.status || "",
        Data: item.data ? new Date(item.data.seconds ? item.data.seconds * 1000 : item.data).toLocaleDateString() : "",
      }));
    } else if (aba === "comissoes") {
      columns = ["Nome", "Tipo", "Membros"];
      rows = dados.map(item => ({
        Nome: item.nome || "",
        Tipo: item.tipo || "",
        Membros: (item.membros || []).map(id => (parlamentares.find(v => v.id === id)?.nome || id)).join(", "),
      }));
    }
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Relatório");
    XLSX.writeFile(wb, `relatorio-${aba}-${Date.now()}.xlsx`);
  }

  // Filtros
  return (
    <div className="relatorios-container">
      <div className="relatorios-abas">
        {abas.map(a => (
          <button
            key={a.key}
            className={a.key === aba ? "aba-ativa" : ""}
            onClick={() => setAba(a.key)}
          >
            {a.label}
          </button>
        ))}
      </div>
      <div className="relatorios-filtros">
        <label>
          Data início:
          <input type="date" value={filtroDataInicio} onChange={e => setFiltroDataInicio(e.target.value)} disabled={aba === "presencas"}/>
        </label>
        <label>
          Data fim:
          <input type="date" value={filtroDataFim} onChange={e => setFiltroDataFim(e.target.value)} disabled={aba === "presencas"}/>
        </label>
        {aba === "presencas" && (
          <label>
            Sessão:
            <select
              value={sessaoSelecionada}
              onChange={e => setSessaoSelecionada(e.target.value)}
              style={{ minWidth: 180 }}
            >
              {sessoes.map(s => (
                <option key={s.id} value={s.id}>
                  {s.titulo
                    ? `${s.dataFormatada} - ${s.titulo}`
                    : s.dataFormatada || s.id}
                </option>
              ))}
            </select>
          </label>
        )}
        {(aba === "presencas" || aba === "votacoes") && (
          <label>
            Parlamentar:
            <select value={filtroParlamentar} onChange={e => setFiltroParlamentar(e.target.value)}>
              <option value="">Todos</option>
              {parlamentares.map(v => (
                <option key={v.id} value={v.id}>{v.nome}</option>
              ))}
            </select>
          </label>
        )}
        <button onClick={exportarPDF} style={{ marginLeft: 12 }}>Exportar PDF</button>
        <button onClick={exportarExcel} style={{ marginLeft: 4 }}>Exportar Excel</button>
      </div>
      <div className="relatorios-lista">
        {carregando ? (
          <div style={{ padding: 40 }}>Carregando...</div>
        ) : (
          <>
            {dados.length === 0 && <div style={{ padding: 40 }}>Nenhum registro encontrado.</div>}
            {dados.length > 0 && (
              <table>
                <thead>
                  <tr>
                    {aba === "sessoes" && (
                      <>
                        <th>Data</th><th>Tipo</th><th>Presidente</th><th>Status</th>
                      </>
                    )}
                    {aba === "presencas" && (
                      <>
                        <th>Parlamentar</th>
                        <th>ID</th>
                        <th>Registros (entrada → saída)</th>
                        <th>Tempo Total</th>
                      </>
                    )}
                    {aba === "votacoes" && (
                      <>
                        <th>Data</th><th>Matéria</th><th>Parlamentar</th><th>Voto</th>
                      </>
                    )}
                    {aba === "projetos" && (
                      <>
                        <th>Código</th>
                        <th>Número</th>
                        <th>Autor</th>
                        <th>Tipo</th>
                        <th>Status</th>
                        <th>Data</th>
                      </>
                    )}
                    {aba === "comissoes" && (
                      <>
                        <th>Nome</th><th>Tipo</th><th>Membros</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {dados.map((item, idx) => (
                    <tr key={item.id || idx}>
                      {aba === "sessoes" && (
                        <>
                          <td>{item.data ? new Date(item.data.seconds ? item.data.seconds * 1000 : item.data).toLocaleDateString() : ""}</td>
                          <td>{item.tipoSessao || ""}</td>
                          <td>{item.presidente || ""}</td>
                          <td>{item.status || ""}</td>
                        </>
                      )}
                      {aba === "presencas" && (
                        <>
                          <td>
                            {item.nome ||
                              (parlamentares.find(v => v.id === item.parlamentarId)?.nome) ||
                              item.parlamentarId ||
                              item.id}
                          </td>
                          <td style={{ fontSize: "0.85em", color: "#555" }}>{item.parlamentarId || item.id}</td>
                          <td>
                            {(item.registros || []).length > 0
                              ? (item.registros || []).map((r, i) => {
                                  const entrada = r.entrada ? new Date(r.entrada) : null;
                                  const saida = r.saida ? new Date(r.saida) : null;
                                  return (
                                    <div key={i}>
                                      {entrada?.toLocaleTimeString() || "-"} → {saida?.toLocaleTimeString() || "-"}
                                    </div>
                                  );
                                })
                              : "-"}
                          </td>
                          <td>
                            {(() => {
                              let tempoTotal = 0;
                              (item.registros || []).forEach(r => {
                                const entrada = r.entrada ? new Date(r.entrada) : null;
                                const saida = r.saida ? new Date(r.saida) : null;
                                if (entrada && saida) tempoTotal += saida - entrada;
                              });
                              if (!tempoTotal) return "-";
                              const totalMinutos = Math.floor(tempoTotal / 60000);
                              return `${Math.floor(totalMinutos / 60)}h ${totalMinutos % 60}min`;
                            })()}
                          </td>
                        </>
                      )}
                      {aba === "votacoes" && (
                        <>
                          <td>{item.data ? new Date(item.data.seconds ? item.data.seconds * 1000 : item.data).toLocaleDateString() : ""}</td>
                          <td>{item.materia || ""}</td>
                          <td>{(parlamentares.find(v => v.id === item.vereador_id)?.nome) || item.vereador_id || ""}</td>
                          <td>{item.voto || ""}</td>
                        </>
                      )}
                      {aba === "projetos" && (
                        <>
                          <td>{item.codigo || item.id}</td>
                          <td>{item.numero || item.numeroProjeto || ""}</td>
                          <td>{item.autor || ""}</td>
                          <td>{item.tipoProjeto || item.tipo || ""}</td>
                          <td>{item.status || ""}</td>
                          <td>{item.data ? new Date(item.data.seconds ? item.data.seconds * 1000 : item.data).toLocaleDateString() : ""}</td>
                        </>
                      )}
                      {aba === "comissoes" && (
                        <>
                          <td>{item.nome || ""}</td>
                          <td>{item.tipo || ""}</td>
                          <td>{(item.membros || []).map(id => (parlamentares.find(v => v.id === id)?.nome || id)).join(", ")}</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>
    </div>
  );
}
