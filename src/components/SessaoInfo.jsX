import React from "react";

export default function SessaoInfo({ painel }) {
  if (!painel) return null;

  const { data, hora, local, presidente, secretario, statusSessao, tipo, titulo } = painel;

  return (
    <section className="mt-20 p-4 bg-white shadow rounded max-w-4xl mx-auto">
      <h2 className="text-lg font-semibold mb-2">{titulo}</h2>
      <p>
        <strong>Data:</strong> {data} <strong>Hora:</strong> {hora}
      </p>
      <p>
        <strong>Local:</strong> {local}
      </p>
      <p>
        <strong>Presidente:</strong> {presidente} | <strong>Secretário:</strong> {secretario}
      </p>
      <p>
        <strong>Status da Sessão:</strong> {statusSessao} | <strong>Tipo:</strong> {tipo}
      </p>
    </section>
  );
}
