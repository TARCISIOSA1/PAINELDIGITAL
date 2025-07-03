import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  arrayUnion,
} from "firebase/firestore";
import "./ConsultaPublicaMateria.css";

function formatarData(dataStr) {
  if (!dataStr) return "-";
  const d = new Date(dataStr + "T00:00:00");
  return d.toLocaleDateString();
}

export default function ConsultaPublicaMateria() {
  const [materias, setMaterias] = useState([]);
  const [votando, setVotando] = useState("");
  const [nome, setNome] = useState("");
  const [titulo, setTitulo] = useState("");
  const [comentario, setComentario] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    carregarMaterias();
    // eslint-disable-next-line
  }, []);

  async function carregarMaterias() {
    setCarregando(true);
    const snap = await getDocs(collection(db, "materias"));
    let arr = [];
    snap.forEach(docu => {
      const mat = docu.data();
      if (mat.consulta_publica) arr.push({ id: docu.id, ...mat });
    });
    setMaterias(arr);
    setCarregando(false);
  }

  async function votarMateria(materia, opcao) {
    setMensagem("");
    if (!nome.trim() || !titulo.trim()) {
      setMensagem("Preencha seu nome e o título de eleitor para votar.");
      return;
    }
    setVotando(materia.id + "_" + opcao);

    // Busca votos detalhados e confere se já votou
    const votosDetalhados = materia.votos_publicos_detalhado || [];
    if (votosDetalhados.find(v => v.titulo === titulo.trim())) {
      setMensagem("Você já votou nessa matéria. Cada título de eleitor só pode votar uma vez.");
      setVotando("");
      return;
    }

    // Verifica se a votação está encerrada ou fora do prazo
    if (materia.status_votacao === "Encerrada") {
      setMensagem("Esta votação já está encerrada.");
      setVotando("");
      return;
    }
    const hoje = new Date();
    if (materia.data_inicio) {
      const di = new Date(materia.data_inicio + "T00:00:00");
      if (hoje < di) {
        setMensagem("A votação desta matéria ainda não iniciou.");
        setVotando("");
        return;
      }
    }
    if (materia.data_fim) {
      const df = new Date(materia.data_fim + "T23:59:59");
      if (hoje > df) {
        setMensagem("A votação desta matéria já foi encerrada.");
        setVotando("");
        return;
      }
    }

    // Prepara novo voto detalhado
    const novoVoto = {
      nome: nome.trim(),
      titulo: titulo.trim(),
      opcao,
      data: new Date().toISOString(),
      comentario: comentario.trim(),
    };

    // Atualiza matéria: incrementa voto, salva voto detalhado
    let votos_publicos = { ...(materia.votos_publicos || {}) };
    votos_publicos[opcao] = (votos_publicos[opcao] || 0) + 1;
    await updateDoc(doc(db, "materias", materia.id), {
      votos_publicos,
      votos_publicos_detalhado: arrayUnion(novoVoto),
    });

    setComentario("");
    setVotando("");
    setMensagem("Voto registrado com sucesso!");
    await carregarMaterias();
  }

  function GraficoBarra({ votos }) {
    const total = Object.values(votos || {}).reduce((a, b) => a + b, 0) || 1;
    return (
      <div style={{ display: "flex", gap: 18, margin: "14px 0" }}>
        {Object.entries(votos || {}).map(([op, qt]) => (
          <div key={op} style={{ flex: 1, textAlign: "center" }}>
            <div style={{
              background: "#245bb6",
              height: Math.max((qt / total) * 70, 8) + 12,
              borderRadius: 8,
              color: "#fff",
              fontWeight: 600,
              marginBottom: 3,
              fontSize: 20,
            }}>
              {qt}
            </div>
            <span style={{ fontSize: 15 }}>{op}</span>
          </div>
        ))}
      </div>
    );
  }

  function totalVotos(votos_publicos) {
    if (!votos_publicos) return 0;
    return Object.values(votos_publicos).reduce((a, b) => a + b, 0);
  }

  return (
    <div className="consulta-materia-publica">
      <h2>Consulta Pública das Matérias Legislativas</h2>
      <p style={{ textAlign: "center", fontSize: 17 }}>
        Para votar, preencha seu nome completo e título de eleitor. Só é possível votar uma vez por matéria.
      </p>
      <div style={{
        display: "flex", gap: 12, margin: "12px 0 18px 0", justifyContent: "center"
      }}>
        <input
          className="input-form"
          type="text"
          placeholder="Nome completo"
          value={nome}
          onChange={e => setNome(e.target.value)}
          maxLength={100}
        />
        <input
          className="input-form"
          type="text"
          placeholder="Título de eleitor"
          value={titulo}
          onChange={e => setTitulo(e.target.value.replace(/\D/g, ""))}
          maxLength={12}
        />
      </div>
      {mensagem && <div style={{
        color: mensagem.includes("sucesso") ? "green" : "red",
        textAlign: "center", marginBottom: 8
      }}>{mensagem}</div>}
      {carregando ? <div>Carregando...</div> : null}
      {materias.length === 0 && !carregando ? (
        <div>Nenhuma matéria em consulta pública no momento.</div>
      ) : null}
      {materias.map((mat) => (
        <div className="card-materia" key={mat.id}>
          <div className="numero-materia">{mat.numero}</div>
          <div className="titulo-materia">{mat.titulo}</div>
          <div className="descricao-materia">{mat.descricao}</div>
          
          {/* -- NOVO: INFORMAÇÕES INSTITUCIONAIS -- */}
          <div style={{
            background: "#f3f8ff", padding: 12, margin: "10px 0 13px 0", borderRadius: 9,
            border: "1px solid #e7ecf8", fontSize: 15
          }}>
            <div><b>Status da votação:</b> <span style={{color: mat.status_votacao === "Encerrada" ? "#b41b1b" : "#246b3c"}}>{mat.status_votacao || "Em andamento"}</span></div>
            <div><b>Período:</b> {formatarData(mat.data_inicio)} a {formatarData(mat.data_fim)}</div>
            {mat.exposicao && <div style={{marginTop:6}}><b>Exposição de Motivos:</b> <span style={{color:"#144780"}}>{mat.exposicao}</span></div>}
            {mat.justificativa && <div style={{marginTop:6}}><b>Justificativa:</b> <span style={{color:"#20545c"}}>{mat.justificativa}</span></div>}
            {mat.link_anexo && 
              <div style={{marginTop:6}}>
                <b>Anexo:</b> <a href={mat.link_anexo} target="_blank" rel="noopener noreferrer" style={{color:"#1864ab", textDecoration:"underline"}}>Clique aqui para visualizar</a>
              </div>
            }
            <div style={{marginTop:6, fontWeight:600}}>Total de votos: <span style={{color:"#245bb6", fontWeight:700}}>{totalVotos(mat.votos_publicos)}</span></div>
          </div>
          {/* -- FIM INSTITUCIONAL -- */}

          <div className="autor-materia">
            <b>Autor:</b> {mat.autor} | <b>Data:</b> {mat.data}
          </div>
          <GraficoBarra votos={mat.votos_publicos || {}} />
          <div className="opcoes-voto">
            {(mat.opcoes_votacao || ["Sim", "Não"]).map((op) => (
              <button
                key={op}
                className="botao-voto"
                disabled={votando}
                onClick={() => votarMateria(mat, op)}
              >
                Votar {op}
              </button>
            ))}
            <input
              className="comentario-input"
              type="text"
              placeholder="Comentário ou sugestão (opcional)"
              value={comentario}
              onChange={e => setComentario(e.target.value)}
              maxLength={200}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
