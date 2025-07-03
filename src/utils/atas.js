// src/utils/atas.js
import { db } from "../firebase";
import { doc, updateDoc } from "firebase/firestore";

/**
 * Atualiza o status da ata pelo ID.
 * @param {string} ataId - ID da ata
 * @param {string} novoStatus - Status novo ("Aprovada", "Rejeitada", etc)
 */
export async function atualizarStatusAta(ataId, novoStatus) {
  await updateDoc(doc(db, "atas", ataId), { status: novoStatus });
}
