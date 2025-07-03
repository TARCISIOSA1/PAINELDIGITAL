import React, { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useParams } from "react-router-dom";

export default function ResumoReuniao() {
  const { reuniaoId } = useParams();
  const [reuniao, setReuniao] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    const carregarResumo = async () => {
      try {
        const docRef = doc(db, "reunioes_comissao", reuniaoId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setReuniao(docSnap.data());
        } else {
          setErro("Reunião não encontrada.");
        }
      } catch (err) {
        console.error("Erro ao carregar reunião:", err);
        setErro("Erro ao buscar os dados.");
      } finally {
        setCarregando(false);
      }
    };
    carregarResumo();
  }, [reuniaoId]);

  if (carregando) return <p>Carregando...</p>;
  if (erro) return <p>❌ {erro}</p>;

  return (
    <div style={{ maxWidth: 900, margin: "auto", padding: 24 }}>
      <h2>Resumo da Reunião</h2>

      <p><strong>Pauta:</strong> {reuniao.pauta}</p>
      <p><strong>Data/Hora:</strong> {reuniao.dataHora}</p>
      <p><strong>Presentes:</strong> {reuniao.membrosPresentes?.join(", ")}</p>
      <p><strong>Matérias:</strong> {reuniao.materias?.join(", ")}</p>

      <hr />

      <h4>Discussões</h4>
      <p>{reuniao.discussoes || <i>(Não registradas)</i>}</p>

      <h4>Decisões</h4>
      <p>{reuniao.decisoes || <i>(Não registradas)</i>}</p>

      <h4>Votos</h4>
      {Array.isArray(reuniao.votos) && reuniao.votos.length > 0 ? (
        <ul>
          {reuniao.votos.map((v, i) => (
            <li key={i}>{v.usuario}: <strong>{v.voto}</strong></li>
          ))}
        </ul>
      ) : <p><i>(Nenhum voto registrado)</i></p>}

      <h4>Ata Final</h4>
      <pre style={{ background: "#f8f8f8", padding: 10, borderRadius: 5 }}>
        {reuniao.ataFinal || "(Ata ainda não gerada)"}
      </pre>
    </div>
  );
}
