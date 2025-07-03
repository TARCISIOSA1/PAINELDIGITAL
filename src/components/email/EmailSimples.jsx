import React, { useState } from "react";

const setores = [
  "Parlamentar",
  "Jurídico",
  "Administrativo",
  "Comunicação",
  "Outro",
];

function gerarId() {
  return Math.random().toString(36).substring(2, 9);
}

export default function EmailSimples() {
  const [emails, setEmails] = useState([
    {
      id: gerarId(),
      remetente: "juridico@camara.gov",
      destinatario: "parlamentar1@camara.gov",
      assunto: "Atualização da legislação",
      corpo: "Prezados, segue atualização da legislação para análise.",
      data: new Date().toLocaleString(),
      lido: false,
      caixa: "entrada",
      respostaDe: null,
    },
    {
      id: gerarId(),
      remetente: "parlamentar1@camara.gov",
      destinatario: "juridico@camara.gov",
      assunto: "Re: Atualização da legislação",
      corpo: "Obrigado pelo envio, vou analisar e retornar.",
      data: new Date().toLocaleString(),
      lido: true,
      caixa: "saida",
      respostaDe: null,
    },
  ]);

  const [filtroCaixa, setFiltroCaixa] = useState("entrada"); // entrada ou saida
  const [emailSelecionado, setEmailSelecionado] = useState(null);
  const [modoResponder, setModoResponder] = useState(false);
  const [novoEmail, setNovoEmail] = useState({
    destinatario: "",
    assunto: "",
    corpo: "",
  });

  // Filtra os emails para exibir na lista conforme caixa selecionada
  const listaEmails = emails
    .filter((e) => e.caixa === filtroCaixa)
    .sort((a, b) => new Date(b.data) - new Date(a.data));

  // Marcar email como lido quando abrir
  const abrirEmail = (email) => {
    setEmailSelecionado(email);
    if (!email.lido) {
      setEmails((prev) =>
        prev.map((e) =>
          e.id === email.id ? { ...e, lido: true } : e
        )
      );
    }
    setModoResponder(false);
  };

  // Marcar email como não lido
  const marcarNaoLido = (email) => {
    setEmails((prev) =>
      prev.map((e) =>
        e.id === email.id ? { ...e, lido: false } : e
      )
    );
    setEmailSelecionado(null);
  };

  // Excluir email
  const excluirEmail = (email) => {
    if(window.confirm("Tem certeza que deseja excluir este email?")){
      setEmails((prev) => prev.filter((e) => e.id !== email.id));
      setEmailSelecionado(null);
    }
  };

  // Criar novo email
  const enviarEmail = () => {
    if (!novoEmail.destinatario || !novoEmail.assunto || !novoEmail.corpo) {
      alert("Preencha todos os campos para enviar.");
      return;
    }
    const email = {
      id: gerarId(),
      remetente: "meuemail@camara.gov",
      destinatario: novoEmail.destinatario,
      assunto: novoEmail.assunto,
      corpo: novoEmail.corpo,
      data: new Date().toLocaleString(),
      lido: false,
      caixa: "saida",
      respostaDe: null,
    };
    setEmails((prev) => [email, ...prev]);
    setNovoEmail({ destinatario: "", assunto: "", corpo: "" });
    alert("Email enviado com sucesso!");
  };

  // Responder email
  const responderEmail = () => {
    if (!novoEmail.corpo) {
      alert("Digite a mensagem para responder.");
      return;
    }
    const resposta = {
      id: gerarId(),
      remetente: "meuemail@camara.gov",
      destinatario: emailSelecionado.remetente,
      assunto: "Re: " + emailSelecionado.assunto,
      corpo: novoEmail.corpo,
      data: new Date().toLocaleString(),
      lido: false,
      caixa: "saida",
      respostaDe: emailSelecionado.id,
    };
    setEmails((prev) => [resposta, ...prev]);
    setNovoEmail({ destinatario: "", assunto: "", corpo: "" });
    setModoResponder(false);
    alert("Resposta enviada!");
  };

  return (
    <div style={{ display: "flex", maxWidth: 900, margin: "20px auto", fontFamily: "Arial, sans-serif", border: "1px solid #ccc", borderRadius: 8 }}>
      
      {/* LISTA DE EMAILS */}
      <div style={{ width: 320, borderRight: "1px solid #ddd", height: "80vh", overflowY: "auto" }}>
        <div style={{ padding: "10px", borderBottom: "1px solid #ddd" }}>
          <button
            style={{ marginRight: 10, padding: "6px 12px", cursor: "pointer", backgroundColor: filtroCaixa === "entrada" ? "#2E86C1" : "#ccc", color: "#fff", border: "none", borderRadius: 4 }}
            onClick={() => { setFiltroCaixa("entrada"); setEmailSelecionado(null); setModoResponder(false); }}
          >
            Caixa de Entrada
          </button>
          <button
            style={{ padding: "6px 12px", cursor: "pointer", backgroundColor: filtroCaixa === "saida" ? "#2E86C1" : "#ccc", color: "#fff", border: "none", borderRadius: 4 }}
            onClick={() => { setFiltroCaixa("saida"); setEmailSelecionado(null); setModoResponder(false); }}
          >
            Caixa de Saída
          </button>
        </div>
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {listaEmails.length === 0 && <li style={{ padding: 10, color: "#666" }}>Nenhum email.</li>}
          {listaEmails.map((email) => (
            <li
              key={email.id}
              onClick={() => abrirEmail(email)}
              style={{
                padding: "10px",
                cursor: "pointer",
                borderBottom: "1px solid #eee",
                backgroundColor: email.lido ? "#f9f9f9" : "#eaf3ff",
                fontWeight: email.lido ? "normal" : "bold",
              }}
            >
              <div><strong>{email.assunto}</strong></div>
              <div style={{ fontSize: 12, color: "#555" }}>
                {filtroCaixa === "entrada" ? "De: " + email.remetente : "Para: " + email.destinatario}
              </div>
              <div style={{ fontSize: 11, color: "#999" }}>{email.data}</div>
            </li>
          ))}
        </ul>
      </div>

      {/* PAINEL DE LEITURA E CRIAÇÃO */}
      <div style={{ flex: 1, padding: 15, height: "80vh", display: "flex", flexDirection: "column" }}>
        {emailSelecionado && !modoResponder && (
          <>
            <h3>{emailSelecionado.assunto}</h3>
            <p><strong>De:</strong> {emailSelecionado.remetente}</p>
            <p><strong>Para:</strong> {emailSelecionado.destinatario}</p>
            <p><strong>Data:</strong> {emailSelecionado.data}</p>
            <hr />
            <p style={{ whiteSpace: "pre-wrap", flex: 1 }}>{emailSelecionado.corpo}</p>
            <hr />
            <div>
              <button onClick={() => setModoResponder(true)} style={{ marginRight: 10 }}>Responder</button>
              <button onClick={() => marcarNaoLido(emailSelecionado)} style={{ marginRight: 10 }}>Marcar como Não Lido</button>
              <button onClick={() => excluirEmail(emailSelecionado)} style={{ backgroundColor: "#e74c3c", color: "#fff" }}>Excluir</button>
            </div>
          </>
        )}

        {/* Formulário de resposta */}
        {modoResponder && (
          <>
            <h3>Responder: {emailSelecionado.assunto}</h3>
            <textarea
              rows={8}
              value={novoEmail.corpo}
              onChange={(e) => setNovoEmail((prev) => ({ ...prev, corpo: e.target.value }))}
              style={{ width: "100%", marginBottom: 10 }}
              placeholder="Digite sua resposta aqui..."
            />
            <div>
              <button onClick={responderEmail} style={{ marginRight: 10 }}>Enviar Resposta</button>
              <button onClick={() => setModoResponder(false)}>Cancelar</button>
            </div>
          </>
        )}

        {/* Formulário de novo email */}
        {!emailSelecionado && (
          <>
            <h3>Nova Mensagem</h3>
            <label>
              Para:<br />
              <select
                value={novoEmail.destinatario}
                onChange={(e) => setNovoEmail((prev) => ({ ...prev, destinatario: e.target.value }))}
                style={{ width: "100%", marginBottom: 10 }}
              >
                <option value="">Selecione o destinatário</option>
                {setores.map((s) => (
                  <option key={s} value={`${s.toLowerCase()}@camara.gov`}>{s}</option>
                ))}
              </select>
            </label>
            <label>
              Assunto:<br />
              <input
                type="text"
                value={novoEmail.assunto}
                onChange={(e) => setNovoEmail((prev) => ({ ...prev, assunto: e.target.value }))}
                style={{ width: "100%", marginBottom: 10 }}
              />
            </label>
            <label>
              Mensagem:<br />
              <textarea
                rows={6}
                value={novoEmail.corpo}
                onChange={(e) => setNovoEmail((prev) => ({ ...prev, corpo: e.target.value }))}
                style={{ width: "100%", marginBottom: 10 }}
              />
            </label>
            <button onClick={enviarEmail} style={{ backgroundColor: "#2E86C1", color: "#fff", padding: "8px 16px", border: "none", borderRadius: 4 }}>
              Enviar
            </button>
          </>
        )}
      </div>
    </div>
  );
}
