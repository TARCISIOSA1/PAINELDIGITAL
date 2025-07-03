// votacaoService.js
import { doc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";

export async function habilitarParaVotacao(materiaAtual, parlamentares, quorumMinimo, sessaoAtiva) {
  if (!materiaAtual || !sessaoAtiva) return;

  const presentes = parlamentares.filter((p) => p.presente).length;
  const quorumNecessario = materiaAtual.quorum || quorumMinimo;

  if (presentes < quorumNecessario) {
    alert(`Quórum insuficiente: presentes ${presentes} / necessário ${quorumNecessario}`);
    return;
  }

  const habilitados = parlamentares
    .filter((p) => p.presente && p.habilitado)
    .map((p) => ({ vereador_id: p.id, nome: p.nome, partido: p.partido, voto: "", habilitado: true }));

  await setDoc(doc(db, "painelAtivo", "votacaoAtual"), {
    titulo: materiaAtual.titulo || "",
    tipo: materiaAtual.tipo || "",
    tipoVotacao: materiaAtual.tipoVotacao || "Simples",
    status: "votando",
    votos: habilitados,
    data: new Date().toISOString(),
    statusSessao: sessaoAtiva.status,
  });

  alert("Parlamentares habilitados para votar.");
}
