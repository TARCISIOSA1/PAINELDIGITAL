import React, { useState, useEffect } from "react";

function CadastroOrdemDia() {
  const [sessoes, setSessoes] = useState([]);
  const [sessaoSelecionada, setSessaoSelecionada] = useState("");
  const [descricao, setDescricao] = useState("");
  const [dataOrdem, setDataOrdem] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [ordens, setOrdens] = useState([]);

  useEffect(() => {
    // TODO: buscar sessões via API/backend
    // Simulando fetch:
    setSessoes([
      { id: 1, nome: "Sessão 1" },
      { id: 2, nome: "Sessão 2" },
    ]);
    
    // TODO: buscar ordens do dia já cadastradas
    setOrdens([]);
  }, []);

  function handleSubmit(e) {
    e.preventDefault();

    if (!sessaoSelecionada || !descricao) {
      alert("Sessão e descrição são obrigatórios");
      return;
    }

    // Aqui faria o POST para salvar no backend
    const novaOrdem = {
      id: Date.now(), // só para exemplo, o backend deve gerar
      sessao_id: sessaoSelecionada,
      descricao,
      data_ordem: dataOrdem,
      observacoes,
    };

    setOrdens((prev) => [...prev, novaOrdem]);

    // Limpar campos
    setSessaoSelecionada("");
    setDescricao("");
    setDataOrdem("");
    setObservacoes("");
  }

  return (
    <div className="cadastro-ordem-dia">
      <h2>Cadastro de Ordem do Dia</h2>

      <form onSubmit={handleSubmit}>
        <div>
          <label>Sessão:</label>
          <select
            value={sessaoSelecionada}
            onChange={(e) => setSessaoSelecionada(e.target.value)}
          >
            <option value="">Selecione uma sessão</option>
            {sessoes.map((sessao) => (
              <option key={sessao.id} value={sessao.id}>
                {sessao.nome}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label>Descrição:</label>
          <input
            type="text"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Ex: Ordem do dia nº 01"
            required
          />
        </div>

        <div>
          <label>Data da Ordem:</label>
          <input
            type="date"
            value={dataOrdem}
            onChange={(e) => setDataOrdem(e.target.value)}
          />
        </div>

        <div>
          <label>Observações:</label>
          <textarea
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
          />
        </div>

        <button type="submit">Adicionar</button>
      </form>

      <h3>Ordens do Dia Cadastradas</h3>
      <ul>
        {ordens.map((ordem) => (
          <li key={ordem.id}>
            <b>{ordem.descricao}</b> - Sessão: {ordem.sessao_id} - Data:{" "}
            {ordem.data_ordem || "N/A"}<br />
            Obs: {ordem.observacoes || "Nenhuma"}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default CadastroOrdemDia;
