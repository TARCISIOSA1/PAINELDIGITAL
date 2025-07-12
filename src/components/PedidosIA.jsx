import React, { useState, useEffect } from 'react';

// Usa o backend IA, definido no .env
const API_URL = import.meta.env.VITE_API_IA;


export default function PedidosIA() {
  const [periodoInicio, setPeriodoInicio] = useState('');
  const [periodoFim, setPeriodoFim] = useState('');
  const [sessaoId, setSessaoId] = useState('');
  const [sessoes, setSessoes] = useState([]);
  const [pergunta, setPergunta] = useState('');
  const [resposta, setResposta] = useState('');
  const [atas, setAtas] = useState([]);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/sessoes`)
      .then(res => res.json())
      .then(data => {
        if (data.sessoes) setSessoes(data.sessoes);
      })
      .catch(err => console.error('Erro ao carregar sessões:', err));
  }, []);

  const buscarAtas = async () => {
    setCarregando(true);
    try {
      const body = { periodoInicio, periodoFim, sessaoId };
      const res = await fetch(`${API_URL}/api/atas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.atas) setAtas(data.atas);
    } catch (err) {
      console.error('Erro ao buscar atas:', err);
    }
    setCarregando(false);
  };

  const enviarPergunta = async () => {
    if (!pergunta.trim()) {
      setResposta('Digite sua pergunta.');
      return;
    }
    setCarregando(true);
    setResposta('');
    try {
      const res = await fetch(`${API_URL}/api/pergunte`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pergunta }),
      });
      const data = await res.json();
      setResposta(data.resposta || 'Sem resposta da IA.');
    } catch (err) {
      setResposta('Erro ao consultar a IA.');
    }
    setCarregando(false);
  };

  const gerarPdf = async () => {
    if (!resposta.trim()) {
      alert('Não há resposta para gerar PDF.');
      return;
    }
    try {
      const dados = {
        titulo: "Relatório Legislativo",
        texto: resposta,
      };
      const res = await fetch(`${API_URL}/api/gerarPdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dados),
      });
      if (!res.ok) {
        alert('Erro ao gerar PDF');
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = dados.titulo.replace(/\s+/g, '_') + '.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      alert('Erro ao gerar PDF: ' + error.message);
    }
  };

  return (
    <div className="pedidosia-container">
      <h2 className="pedidosia-title">Consulta Inteligente Legislativa (IA)</h2>

      <div className="pedidosia-filtros">
        <div>
          <label>Período Início:</label>
          <input
            type="date"
            value={periodoInicio}
            onChange={e => setPeriodoInicio(e.target.value)}
          />
        </div>
        <div>
          <label>Período Fim:</label>
          <input
            type="date"
            value={periodoFim}
            onChange={e => setPeriodoFim(e.target.value)}
          />
        </div>
        <div>
          <label>Sessão Legislativa:</label>
          <select
            value={sessaoId}
            onChange={e => setSessaoId(e.target.value)}
          >
            <option value="">Todas</option>
            {sessoes.map(s => (
              <option key={s.id} value={s.id}>
                {s.numero}ª Sessão — {s.ano}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={buscarAtas}
          disabled={carregando}
        >
          {carregando ? 'Buscando atas...' : 'Buscar Atas'}
        </button>
      </div>

      <div>
        <h3>Atas encontradas:</h3>
        {atas.length === 0 && <p>Nenhuma ata encontrada.</p>}
        <ul className="pedidosia-atas-lista">
          {atas.map(a => (
            <li key={a.id}>
              <strong>{a.data}</strong> — {a.texto?.slice(0, 150) || ''}...
            </li>
          ))}
        </ul>
      </div>

      <hr style={{ margin: '30px 0' }} />

      <div className="pedidosia-pergunta">
        <h3>Pergunte à IA sobre qualquer dado do sistema</h3>
        <textarea
          rows={5}
          value={pergunta}
          onChange={e => setPergunta(e.target.value)}
          placeholder="Digite sua pergunta aqui..."
        />
        <br />
        <button
          onClick={enviarPergunta}
          disabled={carregando}
        >
          {carregando ? 'Consultando IA...' : 'Perguntar'}
        </button>
      </div>

      <div className="pedidosia-resposta">
        {resposta || 'Aqui aparecerá a resposta da IA...'}
      </div>

      {resposta && (
        <div style={{ textAlign: 'center', marginTop: 15 }}>
          <button
            onClick={gerarPdf}
            className="pedidosia-pdf-btn"
          >
            Gerar PDF
          </button>
        </div>
      )}

      {/* CSS embutido para responsividade */}
      <style>{`
        .pedidosia-container {
          max-width: 900px;
          margin: 0 auto;
          padding: 20px 8px;
          font-family: Arial, sans-serif;
        }
        .pedidosia-title {
          text-align: center;
          font-size: 1.7rem;
          margin: 18px 0 25px 0;
        }
        .pedidosia-filtros {
          display: flex;
          flex-wrap: wrap;
          gap: 16px;
          justify-content: center;
          margin-bottom: 20px;
        }
        .pedidosia-filtros > div {
          display: flex;
          flex-direction: column;
          min-width: 145px;
        }
        .pedidosia-filtros label {
          font-weight: 600;
          margin-bottom: 3px;
        }
        .pedidosia-filtros input,
        .pedidosia-filtros select {
          padding: 6px;
          font-size: 1rem;
          border-radius: 7px;
          border: 1.2px solid #a8b8cc;
          background: #fff;
        }
        .pedidosia-filtros button {
          align-self: flex-end;
          margin-top: auto;
          background: #185aa3;
          color: #fff;
          border: none;
          padding: 8px 17px;
          border-radius: 7px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.15s;
        }
        .pedidosia-filtros button:disabled {
          background: #ccc;
          color: #fff;
        }
        .pedidosia-atas-lista {
          margin: 8px 0 18px 0;
          padding-left: 15px;
          font-size: 1rem;
        }
        .pedidosia-pergunta {
          text-align: center;
          margin-bottom: 12px;
        }
        .pedidosia-pergunta textarea {
          width: 95%;
          max-width: 700px;
          min-height: 80px;
          font-size: 1rem;
          border-radius: 9px;
          padding: 10px;
          border: 1.2px solid #bbc7da;
          margin-top: 8px;
          resize: vertical;
        }
        .pedidosia-pergunta button {
          margin-top: 13px;
          padding: 10px 25px;
          font-size: 1.09rem;
          border-radius: 6px;
          border: none;
          background: #007bff;
          color: #fff;
          font-weight: 600;
          cursor: pointer;
        }
        .pedidosia-pergunta button:disabled {
          background: #92b2e5;
        }
        .pedidosia-resposta {
          margin: 24px auto 0 auto;
          background: #eef3fb;
          border-radius: 10px;
          min-height: 70px;
          padding: 18px;
          font-family: monospace;
          white-space: pre-line;
          max-width: 800px;
          font-size: 1.02rem;
        }
        .pedidosia-pdf-btn {
          padding: 10px 30px;
          font-size: 1rem;
          border-radius: 6px;
          border: none;
          background-color: #28a745;
          color: #fff;
          cursor: pointer;
          font-weight: 600;
        }
        @media (max-width: 750px) {
          .pedidosia-container {
            padding: 8px 2vw;
          }
          .pedidosia-filtros {
            gap: 10px;
            flex-direction: column;
            align-items: stretch;
          }
          .pedidosia-title {
            font-size: 1.22rem;
          }
          .pedidosia-pergunta textarea {
            width: 100%;
            max-width: 100vw;
          }
          .pedidosia-resposta {
            max-width: 99vw;
            padding: 13px 3vw;
          }
        }
      `}</style>
    </div>
  );
}
