import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
  query,
  where
} from "firebase/firestore";
import TopoInstitucional from "./TopoInstitucional";

const ABAS = ["Matérias", "Atas", "Itens Livres", "Tribuna"];
const ITENS_POR_PAGINA = 5;

export default function CadastroPauta() {
  const [materias, setMaterias] = useState([]);
  const [atas, setAtas] = useState([]);
  const [parlamentares, setParlamentares] = useState([]);
  const [pauta, setPauta] = useState([]);
  const [novoItem, setNovoItem] = useState("");
  const [titulo, setTitulo] = useState("");
  const [loading, setLoading] = useState(false);
  const [pautas, setPautas] = useState([]);
  const [editandoId, setEditandoId] = useState(null);
  const [aba, setAba] = useState(ABAS[0]);
  // Tribuna
  const [parlamentarSelecionado, setParlamentarSelecionado] = useState("");
  const [tempoTribuna, setTempoTribuna] = useState(5); // minutos
  // Paginação
  const [paginaPautas, setPaginaPautas] = useState(1);

  // Buscar matérias (apenas status "Em pauta"), atas (pendentes), parlamentares e pautas ao iniciar
  const fetchAll = async () => {
    setLoading(true);
    try {
      // Apenas matérias "Em pauta" (ajuste aqui se for 'Em Pauta' ou 'Em pauta' no banco)
      const snapMaterias = await getDocs(
        query(collection(db, "materias"), where("status", "==", "Em pauta"))
      );
      setMaterias(snapMaterias.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      // Apenas atas com status "Pendente"
      const snapAtas = await getDocs(
        query(collection(db, "atas"), where("status", "==", "Pendente"))
      );
      setAtas(snapAtas.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      const snapPautas = await getDocs(collection(db, "pautas"));
      setPautas(
        snapPautas.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .sort((a, b) => b.dataCriacao?.seconds - a.dataCriacao?.seconds)
      );

      const snapParlamentares = await getDocs(collection(db, "parlamentares"));
      setParlamentares(
        snapParlamentares.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .sort((a, b) => (a.nome || "").localeCompare(b.nome || ""))
      );
    } catch (err) {
      alert("Erro ao carregar dados: " + err.message);
      console.error("Erro ao carregar dados:", err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line
  }, []);

  const adicionarMateria = (materia) => {
    if (!pauta.some(item => item.id === materia.id && item.tipo === "materia")) {
      setPauta([...pauta, { ...materia, tipo: "materia" }]);
    }
  };

  const adicionarAta = async (ata) => {
    // Só permite adicionar uma vez
    if (!pauta.some(item => item.id === ata.id && item.tipo === "ata")) {
      setPauta([...pauta, { ...ata, tipo: "ata" }]);
      // Atualiza status da ata para "Em Pauta"
      await updateDoc(doc(db, "atas", ata.id), { status: "Em Pauta" });
      // Atualiza lista de atas
      await fetchAll();
    }
  };

  const adicionarItemLivre = () => {
    if (novoItem.trim()) {
      setPauta([...pauta, { titulo: novoItem, tipo: "livre" }]);
      setNovoItem("");
    }
  };

  const adicionarTribuna = () => {
    if (parlamentarSelecionado && tempoTribuna > 0) {
      const parlamentar = parlamentares.find(p => p.id === parlamentarSelecionado);
      if (parlamentar && !pauta.some(item => item.tipo === "tribuna" && item.id === parlamentarSelecionado)) {
        setPauta([...pauta, {
          tipo: "tribuna",
          id: parlamentarSelecionado,
          nome: parlamentar.nome,
          tempo: tempoTribuna,
        }]);
      }
    }
  };

  const removerItem = (index) => {
    setPauta(pauta.filter((_, i) => i !== index));
  };

  const moverItem = (index, direcao) => {
    const novo = [...pauta];
    const [removido] = novo.splice(index, 1);
    novo.splice(index + direcao, 0, removido);
    setPauta(novo);
  };

  const salvarPauta = async () => {
    if (pauta.length === 0 || !titulo.trim()) {
      alert("Preencha o título e adicione itens à pauta!");
      return;
    }
    setLoading(true);
    try {
      if (editandoId) {
        await updateDoc(doc(db, "pautas", editandoId), {
          titulo,
          itens: pauta,
        });
        alert("Pauta editada com sucesso!");
      } else {
        await addDoc(collection(db, "pautas"), {
          titulo,
          itens: pauta,
          dataCriacao: new Date(),
        });
        alert("Pauta salva com sucesso!");
      }
      setTitulo("");
      setPauta([]);
      setEditandoId(null);
      setPaginaPautas(1); // volta para primeira página ao salvar
      await fetchAll();
    } catch (e) {
      alert("Erro ao salvar pauta: " + e.message);
      console.error(e);
    }
    setLoading(false);
  };

  const excluirPauta = async (id) => {
    if (window.confirm("Tem certeza que deseja excluir esta pauta?")) {
      setLoading(true);
      try {
        await deleteDoc(doc(db, "pautas", id));
        await fetchAll();
      } catch (err) {
        alert("Erro ao excluir pauta: " + err.message);
      }
      setLoading(false);
    }
  };

  const editarPauta = (pauta) => {
    setTitulo(pauta.titulo || "");
    setPauta(pauta.itens || []);
    setEditandoId(pauta.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Paginação
  const totalPaginas = Math.ceil(pautas.length / ITENS_POR_PAGINA);
  const pautasVisiveis = pautas.slice(
    (paginaPautas - 1) * ITENS_POR_PAGINA,
    paginaPautas * ITENS_POR_PAGINA
  );

  // Organização das abas para inserção dos itens
  function renderAba() {
    switch (aba) {
      case "Matérias":
        return loading ? (
          <div>Carregando...</div>
        ) : (
          <ul style={{ maxHeight: 110, overflowY: "auto", paddingLeft: 0, marginBottom: 20 }}>
            {materias.map(materia => (
              <li key={materia.id} style={{ display: "flex", alignItems: "center", listStyle: "none", marginBottom: 7 }}>
                <span style={{ flex: 1 }}>{materia.titulo}</span>
                <button style={{ marginLeft: 8 }} onClick={() => adicionarMateria(materia)}>Adicionar</button>
              </li>
            ))}
            {materias.length === 0 && (
              <li style={{ color: "#c00", fontStyle: "italic", marginTop: 4 }}>
                Nenhuma matéria disponível em pauta.
              </li>
            )}
          </ul>
        );
      case "Atas":
        return (
          <ul style={{ maxHeight: 110, overflowY: "auto", paddingLeft: 0, marginBottom: 20 }}>
            {atas
              .sort((a, b) => (b.dataAta || 0) - (a.dataAta || 0))
              .map(ata => (
                <li key={ata.id} style={{ display: "flex", alignItems: "center", listStyle: "none", marginBottom: 7 }}>
                  <span style={{ flex: 1 }}>
                    {ata.dataAta ? new Date(ata.dataAta).toLocaleDateString("pt-BR") : ""} - {ata.titulo || ata.sessaoId}
                  </span>
                  <button style={{ marginLeft: 8 }} onClick={() => adicionarAta(ata)}>Adicionar</button>
                </li>
              ))}
            {atas.length === 0 && (
              <li style={{ color: "#c00", fontStyle: "italic", marginTop: 4 }}>
                Nenhuma ata pendente disponível.
              </li>
            )}
          </ul>
        );
      case "Itens Livres":
        return (
          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            <input
              value={novoItem}
              onChange={e => setNovoItem(e.target.value)}
              placeholder="Ex: Leitura de correspondências"
              style={{ flex: 1, padding: 6 }}
            />
            <button onClick={adicionarItemLivre}>Adicionar</button>
          </div>
        );
      case "Tribuna":
        return (
          <div style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 12 }}>
            <select
              value={parlamentarSelecionado}
              onChange={e => setParlamentarSelecionado(e.target.value)}
              style={{ minWidth: 200 }}
            >
              <option value="">Selecione o parlamentar...</option>
              {parlamentares.map(p => (
                <option key={p.id} value={p.id}>{p.nome}</option>
              ))}
            </select>
            <input
              type="number"
              min={1}
              max={60}
              value={tempoTribuna}
              onChange={e => setTempoTribuna(Number(e.target.value))}
              style={{ width: 80, marginLeft: 8 }}
              placeholder="Tempo (min)"
            />
            <button onClick={adicionarTribuna}>Adicionar</button>
          </div>
        );
      default:
        return null;
    }
  }

  return (
    <>
      <TopoInstitucional />
      <div
        style={{
          maxWidth: 750,
          margin: "40px auto",
          padding: 24,
          background: "#fff",
          borderRadius: 12,
          boxShadow: "0 4px 16px #eee",
          marginTop: 24,
        }}
      >
        <h2>Cadastro de Pauta</h2>

        <div style={{ marginBottom: 16 }}>
          <label>
            <b>Título da Pauta:</b>
            <input
              type="text"
              value={titulo}
              onChange={e => setTitulo(e.target.value)}
              placeholder="Ex: Pauta da Sessão Ordinária 12/07/2025"
              style={{ marginLeft: 10, width: 340, padding: 6 }}
            />
          </label>
        </div>

        {/* Abas de inserção */}
        <div style={{ display: "flex", gap: 18, marginBottom: 22 }}>
          {ABAS.map(tab => (
            <button
              key={tab}
              onClick={() => setAba(tab)}
              style={{
                padding: "6px 22px",
                borderRadius: 8,
                border: "none",
                background: aba === tab ? "#2563eb" : "#f5f6fa",
                color: aba === tab ? "#fff" : "#333",
                fontWeight: aba === tab ? "bold" : "normal",
                cursor: "pointer"
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Conteúdo da aba */}
        {renderAba()}

        <h3 style={{ marginTop: 30 }}>Itens adicionados na Pauta</h3>
        <ul style={{ paddingLeft: 0, marginBottom: 24 }}>
          {pauta.map((item, idx) => (
            <li
              key={idx}
              style={{
                display: "flex",
                alignItems: "center",
                marginBottom: 6,
                listStyle: "none",
                background: "#f5f6fa",
                borderRadius: 6,
                padding: 6,
              }}
            >
              <span style={{ flex: 1 }}>
                {item.tipo === "tribuna"
                  ? `Tribuna: ${item.nome} (${item.tempo} min)`
                  : item.titulo || item.tituloAta || item.tituloMateria || item.id}
                <span style={{ color: "#888" }}>
                  {" "}
                  ({item.tipo === "livre"
                    ? "Livre"
                    : item.tipo === "ata"
                    ? "Ata"
                    : item.tipo === "materia"
                    ? "Matéria"
                    : item.tipo === "tribuna"
                    ? "Tribuna"
                    : ""
                  })
                </span>
              </span>
              <button disabled={idx === 0} onClick={() => moverItem(idx, -1)}>
                ↑
              </button>
              <button disabled={idx === pauta.length - 1} onClick={() => moverItem(idx, 1)}>
                ↓
              </button>
              <button
                style={{ marginLeft: 8, color: "#b00" }}
                onClick={() => removerItem(idx)}
              >
                Remover
              </button>
            </li>
          ))}
        </ul>

        <button
          onClick={salvarPauta}
          disabled={pauta.length === 0 || loading || !titulo.trim()}
          style={{
            marginTop: 18,
            padding: "10px 24px",
            borderRadius: 6,
            background: "#3b82f6",
            color: "#fff",
            fontWeight: 500,
            fontSize: 16,
            border: "none",
            cursor: "pointer",
          }}
        >
          {editandoId ? "Salvar Edição" : "Salvar Pauta"}
        </button>

        {editandoId && (
          <button
            onClick={() => {
              setEditandoId(null);
              setTitulo("");
              setPauta([]);
            }}
            style={{
              marginLeft: 16,
              marginTop: 18,
              padding: "10px 24px",
              borderRadius: 6,
              background: "#999",
              color: "#fff",
              fontWeight: 500,
              fontSize: 16,
              border: "none",
              cursor: "pointer",
            }}
          >
            Cancelar Edição
          </button>
        )}

        <h3 style={{ marginTop: 40 }}>Pautas já cadastradas</h3>
        <ul style={{ paddingLeft: 0, marginTop: 10 }}>
          {pautasVisiveis.map((pautaSalva) => (
            <li
              key={pautaSalva.id}
              style={{
                background: "#f8fafc",
                borderRadius: 6,
                marginBottom: 8,
                padding: 10,
                display: "flex",
                alignItems: "center",
              }}
            >
              <span style={{ flex: 1 }}>
                <b>{pautaSalva.titulo}</b>
                <span style={{ color: "#888", marginLeft: 12 }}>
                  {pautaSalva.dataCriacao && pautaSalva.dataCriacao.toDate
                    ? pautaSalva.dataCriacao.toDate().toLocaleString("pt-BR")
                    : pautaSalva.dataCriacao instanceof Date
                    ? pautaSalva.dataCriacao.toLocaleString("pt-BR")
                    : ""}
                </span>
              </span>
              <button
                onClick={() => editarPauta(pautaSalva)}
                style={{
                  marginLeft: 10,
                  background: "#2563eb",
                  color: "#fff",
                  padding: "4px 12px",
                  borderRadius: 6,
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Editar
              </button>
              <button
                onClick={() => excluirPauta(pautaSalva.id)}
                style={{
                  marginLeft: 10,
                  background: "#ef4444",
                  color: "#fff",
                  padding: "4px 13px",
                  borderRadius: 6,
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Excluir
              </button>
            </li>
          ))}
        </ul>
        {/* Botões de paginação */}
        {totalPaginas > 1 && (
          <div style={{ marginTop: 14, display: "flex", gap: 8, alignItems: "center" }}>
            <button
              onClick={() => setPaginaPautas(p => Math.max(p - 1, 1))}
              disabled={paginaPautas === 1}
            >
              Anterior
            </button>
            <span>Página {paginaPautas} de {totalPaginas}</span>
            <button
              onClick={() => setPaginaPautas(p => Math.min(p + 1, totalPaginas))}
              disabled={paginaPautas === totalPaginas}
            >
              Próxima
            </button>
          </div>
        )}
      </div>
    </>
  );
}
