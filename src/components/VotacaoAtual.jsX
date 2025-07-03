import React from "react";

export default function VotacaoAtual({ votacao }) {
  if (!votacao) return <p className="p-4">Nenhuma votação em andamento.</p>;

  const { titulo, autor, tipo, status, votos } = votacao;

  return (
    <section className="mt-8 max-w-4xl mx-auto p-4 bg-white rounded shadow">
      <h3 className="text-xl font-semibold mb-2">Matéria em Votação</h3>
      <p><strong>{titulo}</strong> ({tipo})</p>
      <p><em>Autor: {autor}</em></p>
      <p>Status: <span className="capitalize">{status.replace("_", " ")}</span></p>

      <div className="mt-4">
        <h4 className="font-semibold mb-2">Parlamentares Habilitados</h4>
        <ul>
          {votos?.length > 0 ? (
            votos.map(({ nome, partido, voto, habilitado }, i) => (
              <li key={i} className="flex justify-between border-b py-1">
                <span>{nome} ({partido})</span>
                <span>{habilitado ? (voto || "—") : "Não habilitado"}</span>
              </li>
            ))
          ) : (
            <p>Nenhum parlamentar registrado.</p>
          )}
        </ul>
      </div>
    </section>
  );
}
