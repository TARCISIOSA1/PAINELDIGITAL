import React, { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  doc,
  addDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ================== AUXILIARES ====================
const getUsuarioLogado = () => {
  const raw = localStorage.getItem("usuarioLogado") || localStorage.getItem("nome");
  try {
    if (!raw) return "";
    const obj = JSON.parse(raw);
    return obj.nome || raw;
  } catch {
    return raw;
  }
};

const normalizarNome = nome =>
  (nome || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().trim();

const uploadArquivo = async (file) => {
  if (!file) return "";
  return URL.createObjectURL(file);
};

const isFinalizada = status => {
  if (!status) return false;
  const norm = status.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  return (
    norm.includes("finalizada") ||
    norm.includes("finalizada comissao") ||
    norm.includes("finalizado")
  );
};

// ================== EXPORTA ATA EM PDF ===================
function exportarAtaReuniaoPdf({
  data, hora, pauta, membrosPresentes = [], materias = [], ata, decisoes, debates, justificativas = {}, anexos = {}, assinaturas = {}, relator = "", usuarioCriador = ""
}) {
  const docu = new jsPDF();

  docu.setFontSize(16);
  docu.text("ATA DE REUNIÃO DE COMISSÃO", 105, 18, { align: "center" });

  docu.setFontSize(12);
  docu.text(`Data: ${data || "-"}     Hora: ${hora || "-"}`, 14, 30);
  docu.text(`Pauta: ${pauta || "-"}`, 14, 38);

  docu.text("Membros Presentes:", 14, 46);
  autoTable(docu, {
    head: [["Nome", "Justificativa", "Assinatura"]],
    body: membrosPresentes.map(nome => [
      nome,
      (justificativas && justificativas[nome]) ? justificativas[nome] : "",
      (assinaturas && assinaturas[nome]) ? "Assinado" : "",
    ]),
    startY: 52,
    headStyles: { fillColor: [41, 128, 185] },
    styles: { fontSize: 11 }
  });

  let finalY = docu.lastAutoTable ? docu.lastAutoTable.finalY + 8 : 62;

  docu.text("Matérias em Discussão:", 14, finalY);
  autoTable(docu, {
    head: [["Título/ID"]],
    body: materias.map(idOuTitulo => [idOuTitulo]),
    startY: finalY + 4,
    styles: { fontSize: 11 }
  });

  finalY = docu.lastAutoTable ? docu.lastAutoTable.finalY + 6 : finalY + 16;

  docu.text("Resumo da Ata:", 14, finalY);
  docu.setFont("times", "italic");
  docu.text((ata || "-"), 14, finalY + 7, { maxWidth: 180 });
  docu.setFont("helvetica", "normal");

  docu.text("Decisões:", 14, finalY + 23);
  docu.text((decisoes || "-"), 14, finalY + 29, { maxWidth: 180 });

  docu.text("Debates/Comentários:", 14, finalY + 39);
  docu.text((debates || "-"), 14, finalY + 45, { maxWidth: 180 });

  docu.text(`Relator: ${relator || "-"}`, 14, finalY + 56);
  docu.text(`Usuário responsável pelo registro: ${usuarioCriador || "-"}`, 14, finalY + 63);

  docu.setFontSize(9);
  docu.text("Gerado automaticamente pelo Painel Digital | plenario.digital", 14, 285);

  docu.save(`ATA_REUNIAO_COMISSAO_${data || ""}.pdf`);
}

// ================== FORMULÁRIO DE REUNIÃO EM ABAS ===================
function FormularioReuniao({
  novaReuniao, setNovaReuniao,
  materiasDisponiveis, membrosComissao,
  salvarReuniao, reuniaoRecente, exportarAtaReuniaoPdf
}) {
  const [abaTexto, setAbaTexto] = useState("ata");

  const handleMateriaCheckbox = id => {
    setNovaReuniao(r => ({
      ...r,
      materias: r.materias.includes(id)
        ? r.materias.filter(mid => mid !== id)
        : [...r.materias, id]
    }));
  };

  return (
    <div>
      <h4>Nova reunião da comissão</h4>
      <div style={{
        display: "grid", gridTemplateColumns: "1.2fr 2fr", gap: 36, marginBottom: 20, alignItems: "start"
      }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <label>Data:</label>
          <input type="date"
            value={novaReuniao.data}
            onChange={e => setNovaReuniao(r => ({ ...r, data: e.target.value }))}
            style={{ fontSize: 18, padding: 10, width: "90%" }}
          />
          <label>Hora:</label>
          <input type="time"
            value={novaReuniao.hora}
            onChange={e => setNovaReuniao(r => ({ ...r, hora: e.target.value }))}
            style={{ fontSize: 18, padding: 10, width: "90%" }}
          />

          <label>Pauta da reunião:</label>
          <textarea
            value={novaReuniao.pauta}
            onChange={e => setNovaReuniao(r => ({ ...r, pauta: e.target.value }))}
            rows={3}
            style={{ fontSize: 18, padding: 10, width: "95%", minHeight: 70, resize: "vertical" }}
            placeholder="Pauta da reunião"
          />

          <label>Membros presentes:</label>
          <select multiple value={novaReuniao.membrosPresentes}
            onChange={e => setNovaReuniao(r => ({
              ...r,
              membrosPresentes: Array.from(e.target.selectedOptions, o => o.value)
            }))}
            style={{ fontSize: 16, padding: 10, minHeight: 90, width: "95%" }}>
            {membrosComissao.map(m => (
              <option key={m.id} value={m.nome}>{m.nome} {m.funcao ? `- ${m.funcao}` : ""}</option>
            ))}
          </select>

          <label style={{ marginTop: 12 }}>Matérias discutidas:</label>
          <div style={{
            background: "#f8fafc", padding: 10, borderRadius: 5,
            maxHeight: 170, overflowY: "auto", minWidth: 220, border: "1px solid #ddd"
          }}>
            {materiasDisponiveis.length === 0 && <i>Nenhuma matéria em tramitação.</i>}
            {materiasDisponiveis.map(m => (
              <label key={m.id} style={{ display: "block", fontSize: 16, marginBottom: 6 }}>
                <input
                  type="checkbox"
                  checked={novaReuniao.materias.includes(m.id)}
                  onChange={() => handleMateriaCheckbox(m.id)}
                  style={{ marginRight: 8 }}
                />
                {m.titulo}
              </label>
            ))}
          </div>
        </div>

        {/* ----------- ABAS DOS CAMPOS GRANDES ------------ */}
        <div style={{ background: "#f3f5f9", borderRadius: 8, padding: 18 }}>
          <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
            <button
              style={{
                background: abaTexto === "ata" ? "#1976d2" : "#e0e3e8",
                color: abaTexto === "ata" ? "#fff" : "#222",
                border: "none", borderRadius: 4, padding: "7px 24px", fontWeight: "bold"
              }}
              onClick={() => setAbaTexto("ata")}
            >
              Ata (texto)
            </button>
            <button
              style={{
                background: abaTexto === "decisoes" ? "#1976d2" : "#e0e3e8",
                color: abaTexto === "decisoes" ? "#fff" : "#222",
                border: "none", borderRadius: 4, padding: "7px 24px", fontWeight: "bold"
              }}
              onClick={() => setAbaTexto("decisoes")}
            >
              Decisões
            </button>
            <button
              style={{
                background: abaTexto === "debates" ? "#1976d2" : "#e0e3e8",
                color: abaTexto === "debates" ? "#fff" : "#222",
                border: "none", borderRadius: 4, padding: "7px 24px", fontWeight: "bold"
              }}
              onClick={() => setAbaTexto("debates")}
            >
              Debates / Comentários
            </button>
          </div>
          {abaTexto === "ata" && (
            <div>
              <textarea
                value={novaReuniao.ata}
                onChange={e => setNovaReuniao(r => ({ ...r, ata: e.target.value }))}
                rows={9}
                style={{
                  fontSize: 20, padding: 16, minHeight: 200, resize: "vertical", width: "100%",
                  background: "#fff", border: "1px solid #bbb", borderRadius: 7
                }}
                placeholder="Digite aqui a Ata completa da reunião..."
              />
            </div>
          )}
          {abaTexto === "decisoes" && (
            <div>
              <textarea
                value={novaReuniao.decisoes}
                onChange={e => setNovaReuniao(r => ({ ...r, decisoes: e.target.value }))}
                rows={9}
                style={{
                  fontSize: 20, padding: 16, minHeight: 200, resize: "vertical", width: "100%",
                  background: "#fff", border: "1px solid #bbb", borderRadius: 7
                }}
                placeholder="Registre aqui todas as decisões, deliberações, encaminhamentos..."
              />
            </div>
          )}
          {abaTexto === "debates" && (
            <div>
              <textarea
                value={novaReuniao.debates}
                onChange={e => setNovaReuniao(r => ({ ...r, debates: e.target.value }))}
                rows={9}
                style={{
                  fontSize: 20, padding: 16, minHeight: 200, resize: "vertical", width: "100%",
                  background: "#fff", border: "1px solid #bbb", borderRadius: 7
                }}
                placeholder="Comentários, registros de debates e justificativas..."
              />
            </div>
          )}
        </div>
      </div>
      <button onClick={salvarReuniao} style={{
        background: "#222", color: "#fff", borderRadius: 5, padding: "16px 46px",
        fontSize: 20, fontWeight: "bold", marginBottom: 18
      }}>Salvar reunião</button>

      {reuniaoRecente && (
        <div style={{ margin: "24px 0" }}>
          <b>Última Reunião Registrada:</b><br />
          Data: {reuniaoRecente.data} - Hora: {reuniaoRecente.hora} <br />
          Pauta: {reuniaoRecente.pauta} <br />
          <button
            style={{
              background: "#1976d2", color: "#fff", borderRadius: 4, padding: "10px 28px", fontWeight: "bold", marginTop: 12, fontSize: 18
            }}
            onClick={() => exportarAtaReuniaoPdf(reuniaoRecente)}
          >
            Exportar Ata em PDF
          </button>
        </div>
      )}
    </div>
  );
}

// ================ COMPONENTE PRINCIPAL ================
export default function PainelComissao() {
  const [aba, setAba] = useState("materia");
  const [comissoes, setComissoes] = useState([]);
  const [materias, setMaterias] = useState([]);
  const [reunioes, setReunioes] = useState([]);
  const [comissaoSelecionada, setComissaoSelecionada] = useState("");
  const [membrosComissao, setMembrosComissao] = useState([]);
  const [parecerUpload, setParecerUpload] = useState({});
  const [parecerFile, setParecerFile] = useState({});
  const [votosComissao, setVotosComissao] = useState({});
  const usuarioLogado = getUsuarioLogado();

  const [novaReuniao, setNovaReuniao] = useState({
    data: "",
    hora: "",
    pauta: "",
    membrosPresentes: [],
    justificativas: {},
    materias: [],
    ata: "",
    decisoes: "",
    relator: "",
    debates: "",
    assinaturas: {},
    usuarioCriador: usuarioLogado,
  });

  const [reuniaoRecente, setReuniaoRecente] = useState(null);

  useEffect(() => {
    (async () => {
      const snapC = await getDocs(collection(db, "comissoes"));
      setComissoes(snapC.docs.map(d => ({ id: d.id, ...d.data() })));

      const snapM = await getDocs(collection(db, "materias"));
      setMaterias(snapM.docs.map(d => ({ id: d.id, ...d.data() })));

      const snapR = await getDocs(collection(db, "reunioes_comissao"));
      const reunioesArr = snapR.docs.map(d => ({ id: d.id, ...d.data() }));
      setReunioes(reunioesArr);
      setReuniaoRecente(reunioesArr.length ? reunioesArr[reunioesArr.length - 1] : null);
    })();
  }, []);

  useEffect(() => {
    async function fetchMembros() {
      if (!comissaoSelecionada) {
        setMembrosComissao([]);
        return;
      }
      const ref = collection(db, "comissoes", comissaoSelecionada, "membros");
      const snap = await getDocs(ref);
      setMembrosComissao(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }
    fetchMembros();
  }, [comissaoSelecionada]);

  const atualizarDados = async () => {
    const snapM = await getDocs(collection(db, "materias"));
    setMaterias(snapM.docs.map(d => ({ id: d.id, ...d.data() })));
    const snapR = await getDocs(collection(db, "reunioes_comissao"));
    const reunioesArr = snapR.docs.map(d => ({ id: d.id, ...d.data() }));
    setReunioes(reunioesArr);
    setReuniaoRecente(reunioesArr.length ? reunioesArr[reunioesArr.length - 1] : null);

    if (comissaoSelecionada) {
      const ref = collection(db, "comissoes", comissaoSelecionada, "membros");
      const snap = await getDocs(ref);
      setMembrosComissao(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }
  };

  const ehMembro = membrosComissao.some(
    m => normalizarNome(m.nome) === normalizarNome(usuarioLogado)
  );

  const handleParecerFile = (materiaId, file) => {
    setParecerFile((prev) => ({ ...prev, [materiaId]: file }));
  };

  const salvarParecerComissao = async (materia) => {
    const file = parecerFile[materia.id];
    let urlPDF = materia.parecerPDF || "";
    if (file) urlPDF = await uploadArquivo(file);

    await updateDoc(doc(db, "materias", materia.id), {
      parecerComissao: parecerUpload[materia.id] || "",
      parecerPDF: urlPDF,
      status: "Finalizada Comissão",
      statusComissao: "Finalizada",
      usuarioUltimaAcao: usuarioLogado,
    });
    setParecerUpload((prev) => ({ ...prev, [materia.id]: "" }));
    setParecerFile((prev) => ({ ...prev, [materia.id]: null }));
    await atualizarDados();
    alert("Parecer salvo!");
  };

  // --- REUNIÃO ---
  const salvarReuniao = async () => {
    if (!comissaoSelecionada || !novaReuniao.data) {
      alert("Preencha a comissão e a data!");
      return;
    }
    const ref = await addDoc(collection(db, "reunioes_comissao"), {
      ...novaReuniao,
      comissaoId: comissaoSelecionada,
      dataHora: `${novaReuniao.data} ${novaReuniao.hora}`,
      usuarioCriador: usuarioLogado,
    });
    await updateDoc(ref, { id: ref.id });

    setNovaReuniao({
      data: "",
      hora: "",
      pauta: "",
      membrosPresentes: [],
      justificativas: {},
      materias: [],
      ata: "",
      decisoes: "",
      relator: "",
      debates: "",
      assinaturas: {},
      usuarioCriador: usuarioLogado,
    });
    await atualizarDados();
    alert("Reunião salva!");
  };

  // --- VOTAÇÃO ---
  const registrarVoto = (materiaId, voto) => {
    setVotosComissao(v => ({
      ...v,
      [materiaId]: { ...(v[materiaId] || {}), [usuarioLogado]: voto },
    }));
  };

  const salvarVotoComissao = async (materiaId) => {
    const materia = materias.find(m => m.id === materiaId);
    const votosAnteriores = materia?.votosComissao || {};
    const novoVoto = votosComissao[materiaId]?.[usuarioLogado];

    if (!novoVoto) {
      alert("Selecione seu voto!");
      return;
    }
    if (votosAnteriores[usuarioLogado]) {
      alert("Você já votou nesta matéria.");
      return;
    }
    const votosFinais = { ...votosAnteriores, [usuarioLogado]: novoVoto };
    await updateDoc(doc(db, "materias", materiaId), {
      votosComissao: votosFinais,
      usuarioUltimaAcao: usuarioLogado,
    });
    await atualizarDados();
    alert("Voto registrado!");
  };

  // ------------ LISTAGEM DE MATÉRIAS ------------
  // Só permite em tramitação matérias NÃO finalizadas:
  const materiasDisponiveis = materias.filter(m =>
    m.comissaoDestino === comissaoSelecionada &&
    !isFinalizada(m.statusComissao) &&
    !isFinalizada(m.status)
  );

  // Só mostra como finalizadas as que realmente foram finalizadas:
  const materiasFinalizadas = materias.filter(
    m => m.comissaoDestino === comissaoSelecionada &&
      (isFinalizada(m.statusComissao) || isFinalizada(m.status))
  );

  const liberarMateriaParaPlenario = async (materia) => {
    await updateDoc(doc(db, "materias", materia.id), {
      status: "Aguardando Pauta Plenária",
      statusComissao: "Liberada",
      usuarioUltimaAcao: usuarioLogado,
    });
    await atualizarDados();
    alert("Matéria liberada para plenário!");
  };

  // ================== RENDER ===================
  return (
    <div style={{ maxWidth: 1200, margin: "auto", padding: 24 }}>
      <h2>Painel de Comissão</h2>
      <div style={{ marginBottom: 16 }}>
        <button onClick={() => setAba("materia")} style={{ marginRight: 8, background: aba === "materia" ? "#222" : "#eee", color: aba === "materia" ? "#fff" : "#333" }}>Tramitação/Matéria</button>
        <button onClick={() => setAba("reuniao")} style={{ marginRight: 8, background: aba === "reuniao" ? "#222" : "#eee", color: aba === "reuniao" ? "#fff" : "#333" }}>Reunião</button>
        <button onClick={() => setAba("votacao")} style={{ background: aba === "votacao" ? "#222" : "#eee", color: aba === "votacao" ? "#fff" : "#333" }}>Painel de Votação</button>
      </div>

      <div style={{ marginBottom: 24 }}>
        <label>
          Comissão:{" "}
          <select value={comissaoSelecionada} onChange={e => setComissaoSelecionada(e.target.value)}>
            <option value="">Selecione...</option>
            {comissoes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </label>
      </div>

      {membrosComissao && membrosComissao.length > 0 && (
        <div style={{ margin: "8px 0 16px 0", fontSize: 15 }}>
          <b>Membros da comissão selecionada:</b>
          <ul>
            {membrosComissao.map((m, i) => (
              <li key={i}>
                {m.nome} {m.funcao ? <span style={{ color: "#444" }}>- {m.funcao}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ========== Tramitação/Matéria ========== */}
      {aba === "materia" && (
        <>
          <h4>Matérias em Análise pela Comissão</h4>
          <table style={{ width: "100%", fontSize: 15, background: "#fafbfc", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#ececec" }}>
                <th>ID</th><th>Título</th><th>Status</th><th>Parecer (texto)</th><th>Parecer (PDF)</th><th>Salvar</th>
              </tr>
            </thead>
            <tbody>
              {materiasDisponiveis.map(m => (
                <tr key={m.id}>
                  <td>{m.id}</td>
                  <td>{m.titulo}</td>
                  <td>{m.statusComissao || m.status}</td>
                  <td>
                    <textarea
                      value={parecerUpload[m.id] !== undefined ? parecerUpload[m.id] : (m.parecerComissao || "")}
                      onChange={e => setParecerUpload(p => ({ ...p, [m.id]: e.target.value }))}
                      rows={2}
                      style={{ width: "95%", fontSize: 14 }}
                      placeholder="Parecer da Comissão"
                    />
                  </td>
                  <td>
                    {m.parecerPDF ? (
                      <a href={m.parecerPDF} target="_blank" rel="noopener noreferrer">Visualizar PDF</a>
                    ) : (
                      <input type="file" accept="application/pdf" onChange={e => handleParecerFile(m.id, e.target.files[0])} />
                    )}
                  </td>
                  <td>
                    <button onClick={() => salvarParecerComissao(m)} style={{ background: "#006400", color: "#fff", borderRadius: 4, padding: "4px 12px" }}>Salvar</button>
                  </td>
                </tr>
              ))}
              {materiasDisponiveis.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ color: "#999", textAlign: "center" }}>Nenhuma matéria disponível para tramitação.</td>
                </tr>
              )}
            </tbody>
          </table>
        </>
      )}

      {/* ========== REUNIÃO ========== */}
      {aba === "reuniao" && ehMembro && (
        <FormularioReuniao
          novaReuniao={novaReuniao}
          setNovaReuniao={setNovaReuniao}
          materiasDisponiveis={materiasDisponiveis}
          membrosComissao={membrosComissao}
          salvarReuniao={salvarReuniao}
          reuniaoRecente={reuniaoRecente}
          exportarAtaReuniaoPdf={exportarAtaReuniaoPdf}
        />
      )}
      {aba === "reuniao" && !ehMembro && (
        <div style={{ color: "red", fontWeight: "bold", marginTop: 30 }}>
          Acesso restrito: apenas membros da comissão podem acessar esta área.
        </div>
      )}

      {/* ========== VOTAÇÃO ========== */}
      {aba === "votacao" && ehMembro && (
        <>
          <h4>Painel de Votação da Comissão</h4>
          {materiasDisponiveis.map(m => {
            const votos = m.votosComissao || {};
            const jaVotou = !!votos[usuarioLogado];
            return (
              <div key={m.id} style={{ border: "1px solid #ddd", marginBottom: 12, padding: 10, borderRadius: 6 }}>
                <b>{m.titulo}</b>
                <div style={{ marginTop: 8 }}>
                  {!jaVotou ? (
                    <>
                      <label style={{ marginRight: 18 }}>
                        <input
                          type="radio"
                          name={`voto_${m.id}`}
                          checked={votosComissao[m.id]?.[usuarioLogado] === "sim"}
                          onChange={() => registrarVoto(m.id, "sim")}
                        /> Sim
                      </label>
                      <label style={{ marginRight: 18 }}>
                        <input
                          type="radio"
                          name={`voto_${m.id}`}
                          checked={votosComissao[m.id]?.[usuarioLogado] === "nao"}
                          onChange={() => registrarVoto(m.id, "nao")}
                        /> Não
                      </label>
                      <label>
                        <input
                          type="radio"
                          name={`voto_${m.id}`}
                          checked={votosComissao[m.id]?.[usuarioLogado] === "abstencao"}
                          onChange={() => registrarVoto(m.id, "abstencao")}
                        /> Abstenção
                      </label>
                      <button onClick={() => salvarVotoComissao(m.id)} style={{ marginLeft: 20, background: "#222", color: "#fff", borderRadius: 4, padding: "4px 12px" }}>
                        Salvar Voto
                      </button>
                    </>
                  ) : (
                    <span style={{ color: "#1976d2", fontWeight: "bold" }}>
                      Você já votou: <b>{(votos[usuarioLogado] || "").toUpperCase()}</b>
                    </span>
                  )}
                </div>
                <div style={{ marginTop: 6 }}>
                  <b>Resultado Parcial:</b> {Object.entries(votos).map(([membro, voto]) => (
                    <span key={membro} style={{ marginRight: 12 }}>
                      {membro}: <b>{voto.toUpperCase()}</b>
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </>
      )}
      {aba === "votacao" && !ehMembro && (
        <div style={{ color: "red", fontWeight: "bold", marginTop: 30 }}>
          Acesso restrito: apenas membros da comissão podem votar.
        </div>
      )}

      {/* ========== FINALIZADAS ========== */}
      <div style={{ marginTop: 32 }}>
        <h3>Matérias Finalizadas na Comissão</h3>
        <table style={{ width: "100%", background: "#f6f7fa", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#dedede" }}>
              <th>ID</th>
              <th>Título</th>
              <th>Status</th>
              <th>Parecer</th>
              <th>PDF</th>
              <th>Liberar</th>
            </tr>
          </thead>
          <tbody>
            {materiasFinalizadas.map(m => (
              <tr key={m.id}>
                <td>{m.id}</td>
                <td>{m.titulo}</td>
                <td>{m.statusComissao || m.status}</td>
                <td>{m.parecerComissao || <i>Sem parecer</i>}</td>
                <td>
                  {m.parecerPDF ?
                    <a href={m.parecerPDF} target="_blank" rel="noopener noreferrer">PDF</a>
                    : <i>Sem PDF</i>}
                </td>
                <td>
                  <button onClick={() => liberarMateriaParaPlenario(m)} style={{ background: "#1976d2", color: "#fff", borderRadius: 4, padding: "4px 12px" }}>Liberar Matéria</button>
                </td>
              </tr>
            ))}
            {materiasFinalizadas.length === 0 && (
              <tr>
                <td colSpan={6} style={{ color: "#999", textAlign: "center" }}>Nenhuma matéria finalizada encontrada.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
