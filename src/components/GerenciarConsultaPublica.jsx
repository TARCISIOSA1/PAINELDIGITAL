import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
} from "firebase/firestore";
import "./GerenciarConsultaPublica.css";

export default function GerenciarConsultaPublica() {
  const [materias, setMaterias] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [opcoes, setOpcoes] = useState({});
  const [detalheEdicao, setDetalheEdicao] = useState(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    carregarMaterias();
  }, []);

  async function carregarMaterias() {
    setCarregando(true);
    const snap = await getDocs(collection(db, "materias"));
    let arr = [];
    snap.forEach(docu => {
      arr.push({ id: docu.id, ...docu.data() });
    });
    setMaterias(arr);
    setCarregando(false);
  }

  async function alternarConsultaPublica(id, atual) {
    await updateDoc(doc(db, "materias", id), {
      consulta_publica: !atual,
      votos_publicos: !atual ? { Sim: 0, Não: 0 } : {},
      opcoes_votacao: !atual ? ["Sim", "Não"] : [],
      comentarios_publicos: !atual ? [] : [],
    });
    carregarMaterias();
  }

  async function salvarOpcoes(id) {
    let listaOpcoes = (opcoes[id] || "").split(",").map((x) => x.trim()).filter(Boolean);
    if (!listaOpcoes.length) listaOpcoes = ["Sim", "Não"];
    let votos = {};
    listaOpcoes.forEach((op) => (votos[op] = 0));
    await updateDoc(doc(db, "materias", id), {
      opcoes_votacao: listaOpcoes,
      votos_publicos: votos,
    });
    carregarMaterias();
  }

  async function salvarDetalhes() {
    if (!detalheEdicao) return;
    setSalvando(true);
    const { id, exposicao, justificativa, data_inicio, data_fim, link_anexo } = detalheEdicao;
    await updateDoc(doc(db, "materias", id), {
      exposicao: exposicao || "",
      justificativa: justificativa || "",
      data_inicio: data_inicio || "",
      data_fim: data_fim || "",
      link_anexo: link_anexo || "",
    });
    setSalvando(false);
    setDetalheEdicao(null);
    carregarMaterias();
  }

  function ModalDetalhes() {
    if (!detalheEdicao) return null;
    return (
      <div className="modal-detalhes-bg">
        <div className="modal-detalhes">
          <h3>Editar Detalhes da Matéria em Consulta Pública</h3>
          <label>
            <b>Título da Matéria:</b>
            <div style={{margin:"6px 0 10px 0", color:"#1b437d"}}>{detalheEdicao.titulo}</div>
          </label>
          <label>
            <b>Exposição de Motivos:</b>
            <textarea
              value={detalheEdicao.exposicao || ""}
              onChange={e =>
                setDetalheEdicao({ ...detalheEdicao, exposicao: e.target.value })
              }
              rows={3}
              placeholder="Descreva a exposição de motivos ao público..."
            />
          </label>
          <label>
            <b>Justificativa:</b>
            <textarea
              value={detalheEdicao.justificativa || ""}
              onChange={e =>
                setDetalheEdicao({ ...detalheEdicao, justificativa: e.target.value })
              }
              rows={3}
              placeholder="Inclua a justificativa institucional..."
            />
          </label>
          <div style={{ display: "flex", gap: 10 }}>
            <label style={{ flex: 1 }}>
              <b>Data início da consulta:</b>
              <input
                type="date"
                value={detalheEdicao.data_inicio || ""}
                onChange={e =>
                  setDetalheEdicao({ ...detalheEdicao, data_inicio: e.target.value })
                }
              />
            </label>
            <label style={{ flex: 1 }}>
              <b>Data fim da consulta:</b>
              <input
                type="date"
                value={detalheEdicao.data_fim || ""}
                onChange={e =>
                  setDetalheEdicao({ ...detalheEdicao, data_fim: e.target.value })
                }
              />
            </label>
          </div>
          <label>
            <b>Link de Anexo (PDF, Documento):</b>
            <input
              type="text"
              value={detalheEdicao.link_anexo || ""}
              onChange={e =>
                setDetalheEdicao({ ...detalheEdicao, link_anexo: e.target.value })
              }
              placeholder="https://..."
            />
          </label>
          <div style={{ display: "flex", gap: 12, marginTop: 18 }}>
            <button
              onClick={salvarDetalhes}
              disabled={salvando}
              style={{ background: "#258c35", color: "#fff", padding: "8px 20px", borderRadius: 6, border: "none" }}
            >
              {salvando ? "Salvando..." : "Salvar"}
            </button>
            <button
              onClick={() => setDetalheEdicao(null)}
              style={{ background: "#999", color: "#fff", padding: "8px 20px", borderRadius: 6, border: "none" }}
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="painel-gerenciar-consulta">
      <h2>Gerenciar Consulta Pública das Matérias</h2>
      {carregando ? <div>Carregando...</div> : null}
      {materias.length === 0 && !carregando ? (
        <div>Nenhuma matéria encontrada.</div>
      ) : null}
      <table className="tabela-materias">
        <thead>
          <tr>
            <th>Número</th>
            <th>Título</th>
            <th>Consulta Pública</th>
            <th>Opções de Votação</th>
            <th>Resultados (parciais)</th>
            <th>Detalhes da Pauta</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {materias.map((mat) => (
            <tr key={mat.id}>
              <td>{mat.numero}</td>
              <td>{mat.titulo}</td>
              <td>
                <input
                  type="checkbox"
                  checked={!!mat.consulta_publica}
                  onChange={() => alternarConsultaPublica(mat.id, !!mat.consulta_publica)}
                />
              </td>
              <td>
                {mat.consulta_publica ? (
                  <form
                    onSubmit={e => {
                      e.preventDefault();
                      salvarOpcoes(mat.id);
                    }}
                  >
                    <input
                      type="text"
                      placeholder='Ex: Sim, Não, Indiferente'
                      value={opcoes[mat.id] ?? (mat.opcoes_votacao ? mat.opcoes_votacao.join(", ") : "")}
                      onChange={e => setOpcoes({ ...opcoes, [mat.id]: e.target.value })}
                      style={{ width: 140 }}
                    />
                    <button type="submit">Salvar</button>
                  </form>
                ) : (
                  "-"
                )}
              </td>
              <td>
                {mat.consulta_publica && mat.votos_publicos
                  ? Object.entries(mat.votos_publicos)
                      .map(([op, qt]) => `${op}: ${qt}`)
                      .join(" | ")
                  : "-"}
              </td>
              <td>
                {mat.consulta_publica ? (
                  <button
                    className="btn-detalhes"
                    onClick={() => setDetalheEdicao(mat)}
                  >
                    Editar Detalhes
                  </button>
                ) : "-"}
              </td>
              <td>
                {/* Pode adicionar ações extras aqui */}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <ModalDetalhes />
    </div>
  );
}
