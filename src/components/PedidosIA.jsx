import React, { useState, useEffect } from 'react';
import TopoInstitucional from './TopoInstitucional'; // ajuste o caminho conforme seu projeto

const API_URL = process.env.REACT_APP_API_URL; // Use a variável do ambiente (Vercel)

export default function PedidosIA() {
  const [periodoInicio, setPeriodoInicio] = useState('');
  const [periodoFim, setPeriodoFim] = useState('');
  const [sessaoId, setSessaoId] = useState('');
  const [sessoes, setSessoes] = useState([]);
  const [pergunta, setPergunta] = useState('');
  const [resposta, setResposta] = useState('');
  const [atas, setAtas] = useState([]);
  const [carregando, setCarregando] = useState(false);

  // Carrega sessões do backend já usando o endereço certo
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
      console.error('Erro na pergunta para IA:', err);
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
    <div style={{ maxWidth: 900, margin: 'auto', padding: 20, fontFamily: 'Arial, sans-serif' }}>
      <TopoInstitucional />

      <h2 style={{ textAlign: 'center', margin: '20px 0' }}>Consulta Inteligente Legislativa (IA)</h2>

      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 20 }}>
        <div>
          <label>Período Início: </label>
          <input
            type="date"
            value={periodoInicio}
            onChange={e => setPeriodoInicio(e.target.value)}
            style={{ padding: 6, fontSize: 14 }}
          />
        </div>

        <div>
          <label>Período Fim: </label>
          <input
            type="date"
            value={periodoFim}
            onChange={e => setPeriodoFim(e.target.value)}
            style={{ padding: 6, fontSize: 14 }}
          />
        </div>

        <div>
          <label>Sessão Legislativa: </label>
          <select
            value={sessaoId}
            onChange={e => setSessaoId(e.target.value)}
            style={{ padding: 6, fontSize: 14, minWidth: 180 }}
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
          style={{
            height: 34,
            marginTop: 20,
            cursor: carregando ? 'not-allowed' : 'pointer',
            padding: '0 15px',
          }}
        >
          {carregando ? 'Buscando atas...' : 'Buscar Atas'}
        </button>
      </div>

      <div>
        <h3>Atas encontradas:</h3>
        {atas.length === 0 && <p>Nenhuma ata encontrada.</p>}
        <ul>
          {atas.map(a => (
            <li key={a.id} style={{ marginBottom: 6 }}>
              <strong>{a.data}</strong> — {a.texto?.slice(0, 150) || ''}...
            </li>
          ))}
        </ul>
      </div>

      <hr style={{ margin: '30px 0' }} />

      <div style={{ textAlign: 'center' }}>
        <h3>Pergunte à IA sobre qualquer dado do sistema</h3>
        <textarea
          rows={5}
          value={pergunta}
          onChange={e => setPergunta(e.target.value)}
          placeholder="Digite sua pergunta aqui..."
          style={{
            width: '90%',
            maxWidth: 700,
            padding: 10,
            fontSize: 16,
            borderRadius: 8,
            border: '1px solid #ccc',
            resize: 'vertical',
            marginTop: 10,
            minHeight: 100,
          }}
        />
        <br />
        <button
          onClick={enviarPergunta}
          disabled={carregando}
          style={{
            marginTop: 15,
            padding: '10px 25px',
            fontSize: 16,
            borderRadius: 6,
            border: 'none',
            backgroundColor: '#007bff',
            color: '#fff',
            cursor: carregando ? 'not-allowed' : 'pointer',
          }}
        >
          {carregando ? 'Consultando IA...' : 'Perguntar'}
        </button>
      </div>

      <div
        style={{
          marginTop: 25,
          background: '#eef3fb',
          borderRadius: 10,
          minHeight: 60,
          padding: 15,
          fontFamily: 'monospace',
          whiteSpace: 'pre-line',
          maxWidth: 800,
          marginLeft: 'auto',
          marginRight: 'auto',
        }}
      >
        {resposta || 'Aqui aparecerá a resposta da IA...'}
      </div>

      {resposta && (
        <div style={{ textAlign: 'center', marginTop: 15 }}>
          <button
            onClick={gerarPdf}
            style={{
              padding: '10px 30px',
              fontSize: 16,
              borderRadius: 6,
              border: 'none',
              backgroundColor: '#28a745',
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            Gerar PDF
          </button>
        </div>
      )}
    </div>
  );
}
