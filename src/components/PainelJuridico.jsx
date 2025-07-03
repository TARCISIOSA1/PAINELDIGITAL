import React, { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import "./PainelJuridico.css";

export default function PainelJuridico() {
  const [materias, setMaterias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [parecer, setParecer] = useState({});
  const [anexos, setAnexos] = useState({});
  const [tramitando, setTramitando] = useState(null);
  const [resumoMateria, setResumoMateria] = useState(null);

  useEffect(() => {
    carregarMaterias();
  }, []);

  async function carregarMaterias() {
    setLoading(true);
    const snap = await getDocs(collection(db, "materias"));
    const lista = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(m => !m.juridico || m.juridico.status === "Aguardando Parecer" || m.juridico.status === "Em Análise");
    setMaterias(lista);
    setLoading(false);
  }

  async function receberMateria(materiaId) {
    setTramitando(materiaId);
    await updateDoc(doc(db, "materias", materiaId), {
      "juridico.status": "Em Análise",
      "editavel": false
    });
    setTramitando(null);
    carregarMaterias();
  }

  async function liberarMateria(materiaId) {
    setTramitando(materiaId);
    await updateDoc(doc(db, "materias", materiaId), {
      "juridico.status": "Concluído",
      "juridico.parecer": parecer[materiaId] || "",
      "juridico.anexo": anexos[materiaId] || null,
      "editavel": true,
      "status": "Ativa"
    });
    setParecer(p => ({ ...p, [materiaId]: "" }));
    setAnexos(a => ({ ...a, [materiaId]: null }));
    setTramitando(null);
    carregarMaterias();
  }

  function handleParecerChange(id, texto) {
    setParecer((old) => ({ ...old, [id]: texto }));
  }

  function handleAnexoChange(id, file) {
    setAnexos((old) => ({ ...old, [id]: file.name }));
    // Aqui poderia fazer upload do arquivo pro Storage se desejar
  }

  // Modal de resumo simples
  function ResumoModal({ materia, onClose }) {
    if (!materia) return null;
    return (
      <div className="resumo-modal-bg">
        <div className="resumo-modal-box">
          <h3>Resumo da Matéria</h3>
          <div><b>Título:</b> {materia.titulo}</div>
          <div><b>Tipo:</b> {materia.tipoProjeto}</div>
          <div><b>Modalidade:</b> {materia.modalidadeVotacao}</div>
          <div><b>Número:</b> {materia.numeroProjeto || "-"}</div>
          {materia.identificacaoProjeto && (
            <div><b>Identificação:</b> {materia.identificacaoProjeto}</div>
          )}
          <div><b>Tema:</b> {materia.tema}</div>
          <div><b>Autor:</b> {materia.autor}</div>
          <div><b>Data:</b> {materia.data}</div>
          <div><b>Status:</b> {materia.status}</div>
          <div style={{marginTop:6, marginBottom:8}}><b>Descrição:</b> <br />{materia.descricao}</div>
          {materia.pdfUrl && (
            <div style={{marginTop:8}}>
              <b>PDF:</b> <a href={materia.pdfUrl} target="_blank" rel="noopener noreferrer">{materia.pdfName || "Visualizar PDF"}</a>
            </div>
          )}
          <button onClick={onClose} className="btn-fechar-resumo">Fechar</button>
        </div>
      </div>
    );
  }

  return (
    <div className="painel-juridico-container">
      <h2 style={{marginBottom:16}}>Painel Jurídico - Matérias para Parecer</h2>
      {loading ? (
        <div>Carregando matérias...</div>
      ) : materias.length === 0 ? (
        <div style={{color:"#888"}}>Nenhuma matéria pendente para análise jurídica.</div>
      ) : (
        <table className="tabela-juridico">
          <thead>
            <tr>
              <th>Título</th>
              <th>Tipo</th>
              <th>Status Atual</th>
              <th>PDF</th>
              <th>Resumo</th>
              <th>Receber</th>
              <th>Parecer Jurídico</th>
              <th>Anexar Arquivo</th>
              <th>Liberar</th>
            </tr>
          </thead>
          <tbody>
            {materias.map(m => (
              <tr key={m.id}>
                <td>{m.titulo || m.descricao || m.id}</td>
                <td>{m.tipoProjeto || "-"}</td>
                <td>
                  {m.juridico?.status || <span style={{color:"#c80"}}>Aguardando Parecer</span>}
                </td>
                <td>
                  {m.pdfUrl
                    ? <a href={m.pdfUrl} target="_blank" rel="noopener noreferrer" style={{fontSize:13}}>Ver PDF</a>
                    : <span style={{color:"#bbb"}}>-</span>
                  }
                </td>
                <td>
                  <button
                    className="btn-resumo"
                    onClick={() => setResumoMateria(m)}
                  >
                    Resumo
                  </button>
                </td>
                <td>
                  {m.juridico?.status !== "Em Análise" ? (
                    <button
                      className="btn-receber"
                      onClick={() => receberMateria(m.id)}
                      disabled={tramitando === m.id}
                    >
                      Receber
                    </button>
                  ) : (
                    <span style={{color:"#149"}}>Em Análise</span>
                  )}
                </td>
                <td>
                  <textarea
                    placeholder="Digite o parecer jurídico"
                    value={parecer[m.id] || ""}
                    onChange={e => handleParecerChange(m.id, e.target.value)}
                    style={{ width: 180, height: 54 }}
                    disabled={m.juridico?.status !== "Em Análise"}
                  />
                </td>
                <td>
                  <input
                    type="file"
                    onChange={e => handleAnexoChange(m.id, e.target.files[0])}
                    disabled={m.juridico?.status !== "Em Análise"}
                  />
                  {anexos[m.id] && <span style={{fontSize:12}}>{anexos[m.id]}</span>}
                </td>
                <td>
                  <button
                    className="btn-liberar"
                    onClick={() => liberarMateria(m.id)}
                    disabled={m.juridico?.status !== "Em Análise" || tramitando === m.id}
                  >
                    Liberar Matéria
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Modal de resumo */}
      {resumoMateria && (
        <ResumoModal
          materia={resumoMateria}
          onClose={() => setResumoMateria(null)}
        />
      )}
    </div>
  );
}
