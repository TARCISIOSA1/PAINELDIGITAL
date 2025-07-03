// GerenciarReuniao.jsx atualizado com campo de parecer do relator, texto persistente, campos maiores e preparados para futura integração com Storage
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  doc,
  getDoc,
  updateDoc,
  arrayUnion,
} from "firebase/firestore";
import { db } from "../firebase";
import TopoInstitucional from "./TopoInstitucional";
import jsPDF from "jspdf";

export default function GerenciarReuniao({ usuarioLogado }) {
  const { reuniaoId } = useParams();
  const navigate = useNavigate();
  const [reuniao, setReuniao] = useState(null);
  const [discussoes, setDiscussoes] = useState("");
  const [decisoes, setDecisoes] = useState("");
  const [votos, setVotos] = useState([]);
  const [resultado, setResultado] = useState("");
  const [parecerRelator, setParecerRelator] = useState(null);
  const [naoEncontrada, setNaoEncontrada] = useState(false);
  const [comissao, setComissao] = useState(null);

  useEffect(() => {
    if (!reuniaoId) return;
    carregarReuniao();
  }, [reuniaoId]);

  const carregarReuniao = async () => {
    try {
      const docRef = doc(db, "reunioes_comissao", reuniaoId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const dados = docSnap.data();
        setReuniao({
          ...dados,
          membrosPresentes: Array.isArray(dados.membrosPresentes) ? dados.membrosPresentes : [],
          materias: Array.isArray(dados.materias) ? dados.materias : [],
          votos: Array.isArray(dados.votos) ? dados.votos : [],
          discussoes: dados.discussoes || "",
          decisoes: dados.decisoes || "",
          ata: dados.ata || "",
        });
        setDiscussoes(dados.discussoes || "");
        setDecisoes(dados.decisoes || "");
        setVotos(Array.isArray(dados.votos) ? dados.votos : []);

        const comRef = doc(db, "comissoes", dados.comissaoId);
        const comSnap = await getDoc(comRef);
        if (comSnap.exists()) setComissao(comSnap.data());
      } else {
        setNaoEncontrada(true);
      }
    } catch (err) {
      console.error("Erro ao carregar reunião:", err);
      setNaoEncontrada(true);
    }
  };

  const registrarVoto = async (voto) => {
    const docRef = doc(db, "reunioes_comissao", reuniaoId);
    await updateDoc(docRef, {
      votos: arrayUnion({ usuario: usuarioLogado, voto, hora: new Date().toLocaleTimeString() })
    });
    const novaLista = [...votos, { usuario: usuarioLogado, voto, hora: new Date().toLocaleTimeString() }];
    setVotos(novaLista);
  };

  const salvarAtaFinal = async () => {
    const horaFinal = new Date().toLocaleTimeString();
    const ataTexto = `ATA FINAL DA REUNIÃO\n\n` +
      `Comissão: ${comissao?.nome || "-"}\n` +
      `Data: ${reuniao.dataHora}\n` +
      `Hora de encerramento: ${horaFinal}\n` +
      `Pauta: ${reuniao.pauta}\n\n` +
      `Presentes: ${(reuniao.membrosPresentes || []).join(", ")}\n\n` +
      `Matérias: ${(reuniao.materias || []).join(", ")}\n\n` +
      `DISCUSSÕES:\n${discussoes}\n\n` +
      `DECISÕES:\n${decisoes}\n\n` +
      `VOTOS:\n${votos.map(v => `- ${v.usuario}: ${v.voto} (${v.hora || ""})`).join("\n")}\n\n` +
      `Resultado: ${calcularResultado()}`;

    const pdf = new jsPDF();
    pdf.setFontSize(12);
    const linhas = ataTexto.split("\n");
    let y = 10;
    linhas.forEach(linha => {
      if (y > 280) { pdf.addPage(); y = 10; }
      pdf.text(linha, 10, y);
      y += 8;
    });
    const pdfBlob = pdf.output("blob");
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result.split(",")[1];
      await updateDoc(doc(db, "reunioes_comissao", reuniaoId), {
        ata: base64,
        discussoes,
        decisoes,
        ataFinal: ataTexto,
        status: "Encerrada"
      });
      alert("Reunião encerrada e ata salva com sucesso!");
      navigate("/painel-comissao");
    };
    reader.readAsDataURL(pdfBlob);
  };

  const calcularResultado = () => {
    const totais = { Sim: 0, Nao: 0, "Abstenção": 0 };
    votos.forEach(v => { if (v.voto in totais) totais[v.voto]++; });
    if (totais.Sim > totais.Nao) return "Aprovado por maioria";
    if (totais.Sim === totais.Nao) return "Empate";
    return "Rejeitado";
  };

  if (naoEncontrada) return <p>❌ Reunião não encontrada.</p>;
  if (!reuniao) return <p>Carregando...</p>;

  return (
    <div style={{ maxWidth: 950, margin: "auto", padding: 24 }}>
      <TopoInstitucional />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <h2 style={{ margin: 0 }}>
          Reunião da Comissão {comissao?.nome || "..."} - Câmara Municipal
        </h2>
        <div>
          <button onClick={() => navigate("/painel-comissao")} style={{ marginRight: 10 }}>Voltar</button>
          <button onClick={salvarAtaFinal} style={{ background: '#222', color: '#fff', padding: '6px 18px', borderRadius: 5 }}>
            Encerrar Reunião
          </button>
        </div>
      </div>

      <p><strong>Pauta:</strong> {reuniao.pauta}</p>
      <p><strong>Data/Hora:</strong> {reuniao.dataHora}</p>
      <p><strong>Presentes:</strong> {(reuniao.membrosPresentes || []).join(", ")}</p>
      <p><strong>Matérias:</strong> {(reuniao.materias || []).join(", ")}</p>

      <hr />

      <h4>Discussões</h4>
      <textarea value={discussoes} onChange={e => setDiscussoes(e.target.value)} rows={8} style={{ width: "100%", fontSize: "15px" }} />

      <h4>Decisões Tomadas</h4>
      <textarea value={decisoes} onChange={e => setDecisoes(e.target.value)} rows={6} style={{ width: "100%", fontSize: "15px" }} />

      <h4>📎 Anexar Parecer do Relator (PDF)</h4>
      <input type="file" accept="application/pdf" onChange={(e) => setParecerRelator(e.target.files[0])} />
      {parecerRelator && <p><i>{parecerRelator.name}</i></p>}

      <h4>Votação</h4>
      <p>Usuário logado: <strong>{usuarioLogado}</strong></p>
      <button onClick={() => registrarVoto("Sim")}>Votar SIM</button>{" "}
      <button onClick={() => registrarVoto("Nao")}>Votar NÃO</button>{" "}
      <button onClick={() => registrarVoto("Abstenção")}>Abster</button>

      <h5>Resultado:</h5>
      <p>{resultado}</p>
      <ul>
        {votos.map((v, i) => (
          <li key={i}>{v.usuario}: <strong>{v.voto}</strong> {v.hora && `às ${v.hora}`}</li>
        ))}
      </ul>
    </div>
  );
}
