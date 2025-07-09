import React, { useEffect, useState, useRef } from "react";
import TopoInstitucional from "./TopoInstitucional";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend,
} from "chart.js";
import "./PainelVotacaoIA.css";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

function Letreiro({ texto }) {
  if (!texto) return null;
  return (
    <div className="letreiro-marquee">
      <span>{texto}</span>
    </div>
  );
}

function Carrossel({ items = [], itemRender, exibir = 5, intervalo = 4000 }) {
  // Exibe no máximo 'exibir' itens e alterna se tiver mais
  const [start, setStart] = useState(0);
  useEffect(() => {
    if (items.length <= exibir) return;
    const timer = setInterval(() => {
      setStart((prev) => (prev + exibir >= items.length ? 0 : prev + exibir));
    }, intervalo);
    return () => clearInterval(timer);
  }, [items, exibir, intervalo]);
  const visiveis = items.slice(start, start + exibir);
  return (
    <div className="carrossel-flex">
      {visiveis.map(itemRender)}
      {items.length > exibir && (
        <span className="carrossel-indice">{start/exibir+1}/{Math.ceil(items.length/exibir)}</span>
      )}
    </div>
  );
}

export default function PainelVotacaoIA() {
  const [dados, setDados] = useState(null);
  const [presentes, setPresentes] = useState([]);
  const [votos, setVotos] = useState([]);
  const [fullTribuna, setFullTribuna] = useState(false);
  const [fullVotacao, setFullVotacao] = useState(false);
  const [carrosselOrador, setCarrosselOrador] = useState(0);
  const [carrosselMateria, setCarrosselMateria] = useState(0);

  // Painel ativo Firestore
  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, "painelAtivo", "ativo"), (docSnap) => {
      const data = docSnap.data();
      setDados(data);
      setPresentes(data?.parlamentares?.filter(p =>
        (data?.habilitados || []).includes(p.id)
      ) || []);
      // Votos
      const votosObj = data?.votacaoAtual?.votos || {};
      setVotos(
        Object.keys(votosObj).map((vid) => ({
          id: vid,
          voto: votosObj[vid]?.voto || "",
        }))
      );
    });
    return () => unsubscribe();
  }, []);

  // --- FULL TRIBUNA/VOTAÇÃO (modo fullscreen automático)
  useEffect(() => {
    setFullTribuna(!!(dados?.tribunaAtual?.cronometroAtivo && dados?.tribunaAtual?.oradorAtivoIdx >= 0));
    setFullVotacao(dados?.votacaoAtual?.status === "Em votação");
  }, [dados]);

  // ---- FULL TRIBUNA (quando ativo) ----
  if (fullTribuna && dados?.tribunaAtual?.oradores?.length > 0) {
    const idx = dados.tribunaAtual.oradorAtivoIdx;
    const orador = dados.tribunaAtual.oradores[idx];
    const parlamentar = dados.parlamentares?.find(p => p.id === orador.id);
    return (
      <div className="painel-ia-fullscreen">
        <TopoInstitucional />
        <div className="tribuna-full">
          <img
            src={parlamentar?.foto || "/assets/default-parlamentar.png"}
            alt={orador.nome}
            className="foto-orador-full"
          />
          <div className="tribuna-full-info">
            <div className="tribuna-full-nome">{orador.nome}</div>
            <div className="tribuna-full-partido">{orador.partido}</div>
            <div className="tribuna-full-ordem">Ordem #{idx + 1}</div>
            <div className="tribuna-full-cronometro">{dados.tribunaAtual.tempoRestante}s</div>
          </div>
          <div className="legenda-tribuna-full">
            {dados.tribunaAtual.legenda || <span style={{color:"#ccc"}}>Legenda não disponível</span>}
          </div>
        </div>
      </div>
    );
  }

  // ---- FULL VOTAÇÃO (quando ativo) ----
  if (fullVotacao) {
    // Grafico
    const resultado = dados.votacaoAtual?.resultado || {};
    const chartData = {
      labels: ["Sim", "Não", "Abstenção"],
      datasets: [
        { label: "Votos", data: [resultado.sim || 0, resultado.nao || 0, resultado.abstencao || 0], }
      ],
    };
    return (
      <div className="painel-ia-fullscreen">
        <TopoInstitucional />
        <div className="votacao-full">
          <h2>Votação em Andamento</h2>
          <Bar data={chartData} />
        </div>
      </div>
    );
  }

  // --- ENCERRADA: Banner + Letreiro
  if (dados?.statusSessao === "Encerrada") {
    return (
      <div className="painel-ia-encerrada">
        <TopoInstitucional />
        <div className="encerrada-banner">
          <h1>Sessão encerrada!</h1>
          <Letreiro texto={dados.ataCompleta || dados.ata || "Aguarde notícias e próximas sessões."} />
        </div>
      </div>
    );
  }

  // --- LAYOUT PAINEL NORMAL SEM SCROLL ---
  return (
    <div className="painel-ia-container">
      <TopoInstitucional />

      {/* Sessão + Mesa Diretora */}
      <div className="painel-ia-header">
        <div className="sessao-info">
          <div><b>Data:</b> {dados?.data || "-"} <b>Hora:</b> {dados?.hora || "-"}</div>
          <div><b>Local:</b> {dados?.local || "-"}</div>
          <div>
            <b>Status:</b>
            <span className={`status-tag status-${(dados?.statusSessao || "").toLowerCase()}`}>{dados?.statusSessao || "-"}</span>
            {" | "}
            <b>Tipo:</b> {dados?.tipo || "-"}
          </div>
        </div>
        <div className="mesa-diretora">
          <div><b>Presidente:</b> {dados?.mesaDiretora?.find(x=>x.cargo==="Presidente")?.nome || "-"}</div>
          <div><b>Vice:</b> {dados?.mesaDiretora?.find(x=>x.cargo==="Vice-Presidente")?.nome || "-"}</div>
          <div><b>Secretário:</b> {dados?.mesaDiretora?.find(x=>x.cargo==="Secretário")?.nome || "-"}</div>
        </div>
      </div>

      {/* Parlamentares Habilitados – carrossel automático */}
      <div className="parlamentares-habilitados">
        <h3>Parlamentares Presentes/Habilitados</h3>
        <Carrossel
          items={presentes}
          exibir={6}
          itemRender={p => (
            <div className="parlamentar-tag" key={p.id}>
              <img src={p.foto || "/assets/default-parlamentar.png"} alt={p.nome} />
              <span className="nome">{p.nome}</span>
              <span className="partido">{p.partido}</span>
            </div>
          )}
        />
      </div>

      {/* Tribuna – carrossel se muitos oradores */}
      <section className="bloco-tribuna-central">
        <h3>Tribuna</h3>
        {dados?.tribunaAtual?.oradores?.length > 0 ? (
          <Carrossel
            items={dados.tribunaAtual.oradores}
            exibir={4}
            itemRender={(orador, idx) => {
              const parlamentar = dados.parlamentares?.find(p => p.id === orador.id);
              const oradorAtivo = dados.tribunaAtual.oradorAtivoIdx === idx;
              return (
                <div className={`orador-linha ${oradorAtivo ? "orador-ativo" : ""}`} key={orador.id}>
                  <img src={parlamentar?.foto || "/assets/default-parlamentar.png"} alt={orador.nome} />
                  <span className="orador-nome">{orador.nome}</span>
                  <span className="partido">{orador.partido}</span>
                  <span className="orador-tempo">{orador.tempoFala}s</span>
                  {oradorAtivo && (
                    <>
                      <span className="orador-ativo-destaque">FALANDO AGORA</span>
                      <span className="tribuna-cronometro">{dados.tribunaAtual.tempoRestante || 0}s</span>
                      <div className="legenda-ia">{dados.tribunaAtual.legenda || <span style={{color:"#888"}}>Legenda não disponível</span>}</div>
                    </>
                  )}
                </div>
              );
            }}
          />
        ) : (
          <div>Nenhum orador na tribuna.</div>
        )}
      </section>

      {/* Ordem do Dia – carrossel matérias */}
      <section className="bloco-ordemdia">
        <h3>Ordem do Dia</h3>
        <Carrossel
          items={dados?.ordemDoDia || []}
          exibir={3}
          itemRender={(mat, idx) => (
            <div key={mat.id || idx} className="ordem-mat-item">
              <strong>{mat.tipo === "materia" ? "Matéria" : "Ata"}:</strong> {mat.titulo || "-"}
              <span> | <strong>Status:</strong> {mat.status || "-"} </span>
              <span> | <strong>Autor:</strong> {mat.autor || "-"} </span>
            </div>
          )}
        />
      </section>

      {/* Votação */}
      <section className="bloco-votacao-central">
        <h3>Votação</h3>
        <table className="tabela-votos-central">
          <thead>
            <tr><th>Vereador</th><th>Voto</th></tr>
          </thead>
          <tbody>
            {presentes.map(parl => {
              const voto = votos.find(v => v.id === parl.id);
              return (
                <tr key={parl.id}>
                  <td>{parl.nome} <span className="partido">({parl.partido})</span></td>
                  <td>
                    {voto ? (
                      voto.voto === "sim"
                        ? "✅ Sim"
                        : voto.voto === "nao"
                        ? "❌ Não"
                        : voto.voto === "abstencao"
                        ? "⚪ Abstenção"
                        : voto.voto
                    ) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {/* Gráfico Resultado Final */}
        {dados.votacaoAtual?.resultado && (
          <div className="painel-grafico">
            <Bar
              data={{
                labels: ["Sim", "Não", "Abstenção"],
                datasets: [{
                  label: "Votos",
                  data: [
                    dados.votacaoAtual.resultado.sim || 0,
                    dados.votacaoAtual.resultado.nao || 0,
                    dados.votacaoAtual.resultado.abstencao || 0,
                  ],
                  borderWidth: 1,
                }]
              }}
            />
          </div>
        )}
      </section>

      {/* Letreiro/ata/mensagens rápidas */}
      <Letreiro texto={dados.ata || dados.ataCompleta || ""} />
    </div>
  );
}
