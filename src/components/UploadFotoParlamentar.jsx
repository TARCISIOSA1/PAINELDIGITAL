import React, { useState } from "react";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db } from "../firebase"; // ajuste se necessário
import { doc, updateDoc } from "firebase/firestore";

export default function UploadFotoParlamentar({ parlamentarId, onFotoSalva }) {
  const [fotoPreview, setFotoPreview] = useState(null);
  const [carregando, setCarregando] = useState(false);

  async function handleUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    setCarregando(true);

    // Cria o nome do arquivo: timestamp-nomeoriginal
    const nomeArquivo = `fotosParlamentares/${Date.now()}-${file.name}`;
    const storage = getStorage();
    const storageRef = ref(storage, nomeArquivo);

    // Faz upload usando o SDK (sem erro de CORS)
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);

    // Salva a url no Firestore do parlamentar
    if (parlamentarId) {
      const parlamentarRef = doc(db, "parlamentares", parlamentarId);
      await updateDoc(parlamentarRef, { foto: url });
    }
    setFotoPreview(url);
    setCarregando(false);

    if (onFotoSalva) onFotoSalva(url);
    alert("Foto enviada com sucesso!");
  }

  return (
    <div>
      <input type="file" accept="image/*" onChange={handleUpload} disabled={carregando} />
      {carregando && <span>Enviando...</span>}
      {fotoPreview && (
        <div style={{ marginTop: 8 }}>
          <img src={fotoPreview} alt="Foto do parlamentar" style={{ width: 80, borderRadius: 8 }} />
        </div>
      )}
    </div>
  );
}
