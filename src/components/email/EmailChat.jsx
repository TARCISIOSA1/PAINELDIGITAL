import React, { useState, useEffect } from "react";
import { db } from "../../firebase"; // Ajuste o caminho!
import {
  collection,
  addDoc,
  query,
  where,
  onSnapshot,
  orderBy,
  Timestamp,
} from "firebase/firestore";
import "./EmailChat.css";

export default function EmailChat() {
  // Usuário logado (pega do localStorage)
  const usuarioLogado = JSON.parse(localStorage.getItem("usuarioLogado") || "{}");
  const meuNome = usuarioLogado?.nome || "";
  const meuEmail = usuarioLogado?.email || "";

  // Estados gerais
  const [caixaAtiva, setCaixaAtiva] = useState("entrada");
  const [emailsEntrada, setEmailsEntrada] = useState([]);
  const [emailsSaida, setEmailsSaida] = useState([]);
  const [emailSelecionado, setEmailSelecionado] = useState(null);
  const [modoNovoEmail, setModoNovoEmail] = useState(false);

  // Formulário
  const [destinatarios, setDestinatarios] = useState("");
  const [assunto, setAssunto] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [arquivo, setArquivo] = useState(null);

  // ========== CARREGAR EMAILS ==========
  useEffect(() => {
    if (!meuNome && !meuEmail) return;

    // Caixa de entrada: sou destinatário (nome ou email)
    const q1 = query(
      collection(db, "emails"),
      where("destinatarios", "array-contains-any", [meuEmail, meuNome]),
      orderBy("timestamp", "desc")
    );
    const unsub1 = onSnapshot(q1, snap => {
      setEmailsEntrada(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Caixa de saída: sou remetente (nome ou email)
    const q2 = query(
      collection(db, "emails"),
      where("remetente", "in", [meuEmail, meuNome]),
      orderBy("timestamp", "desc")
    );
    const unsub2 = onSnapshot(q2, snap => {
      setEmailsSaida(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => { unsub1(); unsub2(); };
  }, [meuNome, meuEmail]);

  // ========== ENVIAR EMAIL ==========
  async function enviarEmail() {
    if (!destinatarios || !assunto || !mensagem) {
      alert("Preencha todos os campos para enviar o email.");
      return;
    }
    const listaDestinatarios = destinatarios.split(",").map(s => s.trim()).filter(Boolean);

    await addDoc(collection(db, "emails"), {
      remetente: meuEmail,
      remetenteNome: meuNome,
      destinatarios: listaDestinatarios,
      assunto,
      mensagem,
      anexos: arquivo ? [arquivo.name] : [],
      timestamp: Timestamp.now(),
    });
    alert("Email enviado com sucesso!");
    setModoNovoEmail(false);
    setDestinatarios("");
    setAssunto("");
    setMensagem("");
    setArquivo(null);
  }

  // ========== OUTRAS FUNÇÕES ==========
  function selecionarEmail(email) {
    setEmailSelecionado(email);
    setModoNovoEmail(false);
  }
  function abrirNovoEmail() {
    setModoNovoEmail(true);
    setEmailSelecionado(null);
    setDestinatarios("");
    setAssunto("");
    setMensagem("");
    setArquivo(null);
  }
  function cancelarNovoEmail() {
    setModoNovoEmail(false);
    setDestinatarios("");
    setAssunto("");
    setMensagem("");
    setArquivo(null);
  }

  // ========== LAYOUT ==========
  return (
    <div className="emailchat-container">
      <div className="emailchat-sidebar">
        <div style={{ fontWeight: 600, marginBottom: 10 }}>
          Usuário logado: <span style={{ color: "#245" }}>{meuNome} ({meuEmail})</span>
        </div>
        <button
          className={caixaAtiva === "entrada" ? "btn-ativo" : ""}
          onClick={() => { setCaixaAtiva("entrada"); setEmailSelecionado(null); setModoNovoEmail(false); }}
        >
          Caixa de Entrada ({emailsEntrada.length})
        </button>
        <button
          className={caixaAtiva === "saida" ? "btn-ativo" : ""}
          onClick={() => { setCaixaAtiva("saida"); setEmailSelecionado(null); setModoNovoEmail(false); }}
        >
          Caixa de Saída ({emailsSaida.length})
        </button>
        <button className="btn-novo" onClick={abrirNovoEmail}>
          Novo Email
        </button>
        <div className="lista-emails">
          {(caixaAtiva === "entrada" ? emailsEntrada : emailsSaida).length === 0 ? (
            <div className="sem-email">Nenhuma mensagem.</div>
          ) : (
            (caixaAtiva === "entrada" ? emailsEntrada : emailsSaida).map((email) => (
              <div
                key={email.id}
                className={`item-email ${emailSelecionado && emailSelecionado.id === email.id ? "email-selecionado" : ""}`}
                onClick={() => selecionarEmail(email)}
              >
                <strong>{email.assunto}</strong>
                <div>
                  <small>
                    {caixaAtiva === "entrada" ? "De: " : "Para: "}
                    {caixaAtiva === "entrada" ? email.remetenteNome || email.remetente : email.destinatarios.join(", ")}
                  </small>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      <div className="emailchat-conteudo">
        {modoNovoEmail ? (
          <div className="novo-email-form">
            <h3>Escrever novo email</h3>
            <input
              type="text"
              placeholder="Destinatários (separar por vírgula)"
              value={destinatarios}
              onChange={(e) => setDestinatarios(e.target.value)}
            />
            <input
              type="text"
              placeholder="Assunto"
              value={assunto}
              onChange={(e) => setAssunto(e.target.value)}
            />
            <textarea
              placeholder="Mensagem"
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
            />
            <input
              type="file"
              onChange={(e) => setArquivo(e.target.files[0])}
            />
            <div className="botoes">
              <button className="enviar" onClick={enviarEmail}>Enviar</button>
              <button className="cancelar" onClick={cancelarNovoEmail}>Cancelar</button>
            </div>
          </div>
        ) : emailSelecionado ? (
          <div className="visualizar-email">
            <h3>{emailSelecionado.assunto}</h3>
            <p>
              <strong>{caixaAtiva === "entrada" ? "De: " : "Para: "}</strong>
              {caixaAtiva === "entrada"
                ? emailSelecionado.remetenteNome || emailSelecionado.remetente
                : emailSelecionado.destinatarios.join(", ")}
            </p>
            <hr />
            <p>{emailSelecionado.mensagem}</p>
            {emailSelecionado.anexos && emailSelecionado.anexos.length > 0 && (
              <div>
                <h4>Anexos:</h4>
                <ul>
                  {emailSelecionado.anexos.map((anexo, i) => (
                    <li key={i}>{anexo}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div className="email-vazio">Selecione uma mensagem para ler</div>
        )}
      </div>
    </div>
  );
}
