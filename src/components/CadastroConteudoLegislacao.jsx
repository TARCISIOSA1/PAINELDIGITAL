import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import "./CadastroConteudoLegislacao.css";

const ABAS = [
  { key: "legislacao", label: "Legislação da Câmara" },
  { key: "constitucional", label: "Direito Constitucional" },
  { key: "eleitoral", label: "Direito Eleitoral" },
];

export default function CadastroConteudoLegislacao() {
  const [aba, setAba] = useState("legislacao");
  const [textos, setTextos] = useState([]);
  const [novoTitulo, setNovoTitulo] = useState("");
  const [novoTexto, setNovoTexto] = useState("");
  const [carregando, setCarregando] = useState(false);

  // Carregar textos da aba
  useEffect(() => {
    async function fetchTextos() {
      setCarregando(true);
      const snap = await getDocs(collection(db, `legislacao_${aba}`));
      setTextos(
        snap.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .sort((a, b) => (b.data?.seconds || 0) - (a.data?.seconds || 0))
      );
      setCarregando(false);
    }
    fetchTextos();
  }, [aba]);

  // Adicionar novo texto
  async function adicionarTexto(e) {
    e.preventDefault();
    if (!novoTitulo || !novoTexto) return;
    await addDoc(collection(db, `legislacao_${aba}`), {
      titulo: novoTitulo,
      texto: novoTexto,
      data: serverTimestamp(),
    });
    setNovoTitulo("");
    setNovoTexto("");
    // Atualiza lista
    const snap = await getDocs(collection(db, `legislacao_${aba}`));
    setTextos(
      snap.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => (b.data?.seconds || 0) - (a.data?.seconds || 0))
    );
  }

  // Excluir texto
  async function excluirTexto(id) {
    if (window.confirm("Tem certeza que deseja excluir este texto?")) {
      await deleteDoc(doc(db, `legislacao_${aba}`, id));
      setTextos(textos.filter(t => t.id !== id));
    }
  }

  return (
    <div className="cadastro-legislacao-container">
      <div className="abas-legislacao">
        {ABAS.map(a => (
          <button
            key={a.key}
            className={aba === a.key ? "aba-ativa" : ""}
            onClick={() => setAba(a.key)}
          >
            {a.label}
          </button>
        ))}
      </div>
      <div className="cadastro-form-legislacao">
        <h3>Cadastrar conteúdo em {ABAS.find(a => a.key === aba).label}</h3>
        <form onSubmit={adicionarTexto}>
          <input
            type="text"
            value={novoTitulo}
            placeholder="Título do conteúdo"
            onChange={e => setNovoTitulo(e.target.value)}
            style={{ width: "60%", marginBottom: 8 }}
            required
          />
          <textarea
            value={novoTexto}
            placeholder="Cole aqui o texto completo (lei, artigo, norma etc)..."
            onChange={e => setNovoTexto(e.target.value)}
            rows={8}
            style={{ width: "100%", marginBottom: 8 }}
            required
          />
          <button type="submit" className="btn-salvar">Salvar</button>
        </form>
      </div>
      <div className="lista-legislacao">
        <h4>Conteúdos cadastrados nesta aba:</h4>
        {carregando ? (
          <div>Carregando...</div>
        ) : textos.length === 0 ? (
          <div>Nenhum conteúdo cadastrado ainda.</div>
        ) : (
          <ul>
            {textos.map(t => (
              <li key={t.id} style={{ marginBottom: 12 }}>
                <strong>{t.titulo}</strong>
                <div style={{ fontSize: "0.98em", color: "#444", whiteSpace: "pre-line" }}>
                  {t.texto.length > 300
                    ? t.texto.slice(0, 300) + "..."
                    : t.texto}
                </div>
                <button
                  className="btn-excluir"
                  onClick={() => excluirTexto(t.id)}
                  style={{ marginTop: 6 }}
                >
                  Excluir
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
