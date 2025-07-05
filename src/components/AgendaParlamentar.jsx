 import React, { useRef, useState, useEffect } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import ptBrLocale from "@fullcalendar/core/locales/pt-br";
import { db } from "../firebase";
import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";

// Função para pegar usuário logado no localStorage
function getUsuarioLogado() {
  try {
    const user = JSON.parse(localStorage.getItem("usuarioLogado"));
    return user || null;
  } catch {
    return null;
  }
}

export default function AgendaParlamentar() {
  const calendarRef = useRef();
  const [eventos, setEventos] = useState([]);
  const [form, setForm] = useState({
    title: "",
    start: "",
    end: "",
    descricao: "",
  });
  const [abrirModal, setAbrirModal] = useState(false);
  const [carregando, setCarregando] = useState(true);

  const usuario = getUsuarioLogado();

  // Carrega eventos do Firebase
  useEffect(() => {
    async function carregarEventos() {
      setCarregando(true);
      const q = query(collection(db, "agenda"), orderBy("start", "asc"));
      const snap = await getDocs(q);
      const lista = snap.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          title: data.title,
          start: data.start.toDate ? data.start.toDate() : new Date(data.start),
          end: data.end && data.end.toDate ? data.end.toDate() : (data.end ? new Date(data.end) : null),
          descricao: data.descricao || "",
          parlamentarNome: data.parlamentarNome || "",
          parlamentarId: data.parlamentarId || "",
        };
      });
      setEventos(lista);
      setCarregando(false);
    }
    carregarEventos();
  }, [abrirModal]); // recarrega quando adicionar evento

  // Manipula input do formulário
  function handleChange(e) {
    setForm((f) => ({
      ...f,
      [e.target.name]: e.target.value,
    }));
  }

  // Adiciona evento ao Firebase
  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.title || !form.start) {
      alert("Preencha ao menos título e data de início!");
      return;
    }
    try {
      await addDoc(collection(db, "agenda"), {
        title: form.title,
        start: new Date(form.start),
        end: form.end ? new Date(form.end) : new Date(form.start),
        descricao: form.descricao,
        criadoEm: serverTimestamp(),
        parlamentarNome: usuario.nome,
        parlamentarId: usuario.id,
      });
      setForm({ title: "", start: "", end: "", descricao: "" });
      setAbrirModal(false);
    } catch (err) {
      alert("Erro ao salvar evento: " + err.message);
    }
  }

  return (
    <div style={{ maxWidth: 900, margin: "40px auto", background: "#fff", borderRadius: 16, boxShadow: "0 4px 24px #0002", padding: 30 }}>
      <h2 style={{ textAlign: "center", color: "#17335a" }}>Agenda Parlamentar</h2>

      {usuario && (
        <button
          style={{ display: "block", margin: "0 auto 20px auto", background: "#17335a", color: "#fff", border: "none", borderRadius: 8, padding: "10px 24px", fontSize: "1.12rem", fontWeight: "bold" }}
          onClick={() => setAbrirModal(true)}
        >
          + Adicionar Evento
        </button>
      )}

      {abrirModal && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000
        }}>
          <form
            onSubmit={handleSubmit}
            style={{ background: "#fff", borderRadius: 18, boxShadow: "0 8px 32px #0003", padding: 32, minWidth: 340, maxWidth: 420 }}
          >
            <h3>Novo Evento</h3>
            <input
              type="text"
              name="title"
              placeholder="Título do evento"
              value={form.title}
              onChange={handleChange}
              required
              style={{ marginBottom: 14, width: "100%", padding: 9, borderRadius: 7, border: "1px solid #bbb" }}
            />
            <label style={{ fontSize: 14 }}>Data e hora de início:</label>
            <input
              type="datetime-local"
              name="start"
              value={form.start}
              onChange={handleChange}
              required
              style={{ marginBottom: 14, width: "100%", padding: 9, borderRadius: 7, border: "1px solid #bbb" }}
            />
            <label style={{ fontSize: 14 }}>Data e hora de término:</label>
            <input
              type="datetime-local"
              name="end"
              value={form.end}
              onChange={handleChange}
              style={{ marginBottom: 14, width: "100%", padding: 9, borderRadius: 7, border: "1px solid #bbb" }}
            />
            <textarea
              name="descricao"
              placeholder="Descrição (opcional)"
              value={form.descricao}
              onChange={handleChange}
              style={{ marginBottom: 18, width: "100%", minHeight: 54, padding: 9, borderRadius: 7, border: "1px solid #bbb", fontSize: 15 }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button type="button" onClick={() => setAbrirModal(false)} style={{ background: "#bbb", color: "#333", border: "none", borderRadius: 7, padding: "8px 22px" }}>
                Cancelar
              </button>
              <button type="submit" style={{ background: "#17335a", color: "#fff", border: "none", borderRadius: 7, padding: "8px 22px" }}>
                Salvar
              </button>
            </div>
          </form>
        </div>
      )}

      {carregando ? (
        <div style={{ textAlign: "center", color: "#333", margin: 30 }}>Carregando agenda...</div>
      ) : (
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "dayGridMonth,timeGridWeek,timeGridDay"
          }}
          locales={[ptBrLocale]}
          locale="pt-br"
          events={eventos}
          eventContent={renderEventContent}
          height={540}
          eventDisplay="block"
          dayMaxEvents={3}
        />
      )}
    </div>
  );
}

// Exibe nome do parlamentar no evento
function renderEventContent(eventInfo) {
  return (
    <div>
      <b>{eventInfo.event.title}</b>
      {eventInfo.event.extendedProps.parlamentarNome && (
        <div style={{ fontSize: 13, color: "#235", marginTop: 2 }}>
          {eventInfo.event.extendedProps.parlamentarNome}
        </div>
      )}
      {eventInfo.event.extendedProps.descricao && (
        <div style={{ fontSize: 12, color: "#556", marginTop: 2, fontStyle: "italic" }}>
          {eventInfo.event.extendedProps.descricao}
        </div>
      )}
    </div>
  );
}
