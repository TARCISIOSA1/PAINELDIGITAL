// regrasVotacao.js
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";

export function atualizarTipoVotacao(id, novoTipo, materiasVotacao, setMateriasVotacao) {
  const atualizada = materiasVotacao.map((m) =>
    m.id === id ? { ...m, tipoVotacao: novoTipo } : m
  );
  setMateriasVotacao(atualizada);
}

export function atualizarQuorum(id, novoValor, materiasVotacao, setMateriasVotacao) {
  const atualizada = materiasVotacao.map((m) =>
    m.id === id ? { ...m, quorum: novoValor } : m
  );
  setMateriasVotacao(atualizada);
}

export async function salvarRegrasVotacao(sessaoId, materiasVotacao) {
  if (!sessaoId) return;
  await updateDoc(doc(db, "sessoes", sessaoId), {
    ordemDoDia: materiasVotacao,
  });
  alert("Regras de votação salvas com sucesso.");
}
