import React, { useEffect, useState, useRef } from "react";
import { db, storage } from "../firebase";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  doc,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa";

export default function ParlamentaresCarousel() {
  const [parlamentares, setParlamentares] = useState([]);
  const [novo, setNovo] = useState({ nome: "", partido: "", id: "", fotoFile: null, fotoUrl: "" });
  const [carregando, setCarregando] = useState(true);
  const [addModal, setAddModal] = useState(false);
  const [atualizando, setAtualizando] = useState(false);

  // Controle do carrossel
  const [start, setStart] = useState(0);
  const maxPorVez = 6;

  const fileInputRef = useRef();

  // Carrega parlamentares
  useEffect(() => {
    async function fetchData() {
      setCarregando(true);
      const snap = await getDocs(collection(db, "parlamentares"));
      const lista = snap.docs.map((doc) => ({ ...doc.data(), docId: doc.id }));
      setParlamentares(lista);
      setCarregando(false);
    }
    fetchData();
  }, [addModal, atualizando]);

  // Upload e obtém a URL da foto
  async function uploadFoto(id, file) {
    const storageRef = ref(storage, `parlamentares/${id}.jpg`);
    await uploadBytes(storageRef, file);
    return await getDownloadURL(storageRef);
  }

  // Adiciona novo parlamentar
  async function handleNovo(e) {
    e.preventDefault();
    if (!novo.nome || !novo.id || !novo.fotoFile) {
      alert("Preencha todos os campos e selecione uma foto!");
      return;
    }
    setAtualizando(true);
    try {
      // Adiciona primeiro sem foto
      const docRef = await addDoc(collection(db, "parlamentares"), {
        nome: novo.nome,
        partido: novo.partido,
        id: novo.id,
        fotoUrl: "",
      });
      // Faz upload da foto e atualiza doc
      const url = await uploadFoto(novo.id, novo.fotoFile);
      await updateDoc(doc(db, "parlamentares", docRef.id), { fotoUrl: url });
      setAddModal(false);
      setNovo({ nome: "", partido: "", id: "", fotoFile: null, fotoUrl: "" });
    } catch (err) {
      alert("Erro ao salvar parlamentar: " + err.message);
    }
    setAtualizando(false);
  }

  // Paginação do carrossel
  function handlePrev() {
    setStart((s) => Math.max(0, s - maxPorVez));
  }
  function handleNext() {
    setStart((s) => Math.min(parlamentares.length - maxPorVez, s + maxPorVez));
  }

  return (
    <div style={{ maxWidth: 1100, margin: "30px auto", background: "#fff", borderRadius: 18, boxShadow: "0 4px 24px #0002", padding: 26 }}>
      <h2 style={{ textAlign: "center", color: "#17335a", fontSize: 32 }}>Parlamentares</h2>
      <div style={{ textAlign: "right", margin: "12px 0" }}>
        <button
          style={{ background: "#17335a", color: "#fff", border: "none", borderRadius: 8, padding: "8px 22px", fontWeight: 600 }}
          onClick={() => setAddModal(true)}
        >
          + Novo Parlamentar
        </button>
      </div>

      {/* Modal de cadastro */}
      {addModal && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "#0005",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999
        }}>
          <form
            onSubmit={handleNovo}
            style={{ background: "#fff", borderRadius: 14, boxShadow: "0 8px 32px #0003", padding: 34, minWidth: 320, maxWidth: 420 }}
          >
            <h3>Novo Parlamentar</h3>
            <div style={{ marginBottom: 12, display: "flex", justifyContent: "center" }}>
              <label style={{
                width: 130, height: 130, borderRadius: 15, border: "2px dashed #17335a",
                overflow: "hidden", background: "#eee", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center"
              }}>
                {novo.fotoFile ? (
                  <img
                    src={URL.createObjectURL(novo.fotoFile)}
                    alt="Preview"
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : (
                  <span style={{ color: "#aaa", fontSize: 30 }}>+</span>
                )}
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={e => setNovo(f => ({ ...f, fotoFile: e.target.files[0] }))}
                  ref={fileInputRef}
                />
              </label>
            </div>
            <input
              name="nome"
              value={novo.nome}
              onChange={e => setNovo(f => ({ ...f, nome: e.target.value }))}
              placeholder="Nome Completo"
              style={{ marginBottom: 10, width: "100%", padding: 9, borderRadius: 7, border: "1px solid #bbb" }}
              required
            />
            <input
              name="partido"
              value={novo.partido}
              onChange={e => setNovo(f => ({ ...f, partido: e.target.value }))}
              placeholder="Partido"
              style={{ marginBottom: 10, width: "100%", padding: 9, borderRadius: 7, border: "1px solid #bbb" }}
            />
            <input
              name="id"
              value={novo.id}
              onChange={e => setNovo(f => ({ ...f, id: e.target.value }))}
              placeholder="ID (Ex: TARCISIOSA1)"
              style={{ marginBottom: 20, width: "100%", padding: 9, borderRadius: 7, border: "1px solid #bbb" }}
              required
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button type="button" onClick={() => setAddModal(false)} style={{ background: "#bbb", color: "#333", border: "none", borderRadius: 7, padding: "8px 22px" }}>
                Cancelar
              </button>
              <button type="submit" disabled={atualizando} style={{ background: "#17335a", color: "#fff", border: "none", borderRadius: 7, padding: "8px 22px" }}>
                {atualizando ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </form>
        </div>
      )}

      {carregando ? (
        <div style={{ textAlign: "center", margin: 40 }}>Carregando...</div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16 }}>
          <button onClick={handlePrev} disabled={start === 0} style={{
            background: "#17335a", color: "#fff", border: "none", borderRadius: 22, width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, opacity: start === 0 ? 0.3 : 1
          }}>
            <FaChevronLeft />
          </button>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gridTemplateRows: "repeat(2, 1fr)",
              gap: 28,
              width: "100%",
              maxWidth: 950,
              minHeight: 310,
              padding: 12,
              overflowX: "auto",
            }}
          >
            {parlamentares.slice(start, start + maxPorVez).map((p, i) => (
              <div
                key={p.id + i}
                style={{
                  background: "#f5f7fa",
                  borderRadius: 16,
                  boxShadow: "0 2px 10px #0001",
                  padding: 18,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  minWidth: 145,
                  maxWidth: 230,
                  width: "100%",
                  minHeight: 140,
                  position: "relative",
                }}
              >
                <div style={{
                  width: 100, height: 100, borderRadius: 15,
                  overflow: "hidden", background: "#ccc", marginBottom: 14,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  border: "2px solid #17335a"
                }}>
                  {p.fotoUrl ? (
                    <img src={p.fotoUrl} alt={p.nome} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <span style={{ color: "#888", fontSize: 26 }}>Sem Foto</span>
                  )}
                </div>
                <div style={{ fontWeight: "bold", fontSize: 18, color: "#17335a", textAlign: "center" }}>{p.nome}</div>
                <div style={{ color: "#444", fontSize: 15, margin: "2px 0 0 0", textAlign: "center" }}>{p.partido}</div>
                <div style={{
                  marginTop: 10,
                  color: "#17335a",
                  background: "#e8ecf3",
                  borderRadius: 6,
                  padding: "2px 10px",
                  fontWeight: 600,
                  fontSize: 15,
                  letterSpacing: 0.5,
                  border: "1.5px solid #17335a"
                }}>
                  ID: {p.id}
                </div>
              </div>
            ))}
          </div>
          <button onClick={handleNext} disabled={start + maxPorVez >= parlamentares.length} style={{
            background: "#17335a", color: "#fff", border: "none", borderRadius: 22, width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, opacity: start + maxPorVez >= parlamentares.length ? 0.3 : 1
          }}>
            <FaChevronRight />
          </button>
        </div>
      )}
    </div>
  );
}
