// src/components/Mensagens.jsx
import React, { useState } from "react";
import MensagensInbox from "./MensagensInbox";
import MensagemConversa from "./MensagemConversa";

export default function Mensagens({ usuario }) {
  const [conversaSelecionada, setConversaSelecionada] = useState(null);

  return (
    <div style={{ display: "flex", height: "90vh", border: "1px solid #ccc" }}>
      <div style={{ width: "30%", borderRight: "1px solid #ccc" }}>
        <MensagensInbox usuarioId={usuario.id} onAbrirConversa={setConversaSelecionada} />
      </div>
      <div style={{ width: "70%" }}>
        {conversaSelecionada ? (
          <MensagemConversa conversa={conversaSelecionada} usuarioId={usuario.id} />
        ) : (
          <p style={{ padding: 20 }}>Selecione uma conversa para iniciar.</p>
        )}
      </div>
    </div>
  );
}
