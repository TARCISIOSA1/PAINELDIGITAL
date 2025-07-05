import React, { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  setDoc,
  doc,
} from "firebase/firestore";
import { db } from "../firebase";

// ---- PADRÕES INTERNOS (sem acento, sem espaço) ----
const TELAS = [
  "Materias",
  "Sessoes",
  "SessaoLegislativa",
  "PainelDeControle",
  "PainelPublico",
  "PainelPublicoIA",
  "Comissoes",
  "Presencas",
  "Usuarios",
  "Parlamentares",
  "Tramitacao",
  "Pauta",
  "Atas",
  "VisualizarAtas",
  "Relatorios",
  "Legislatura",
  "NovoProtocolo",
  "ProtocolosAdmin",
  "PainelJuridico",
  "PainelComissao",
  "PedidosIA",
  "Email",
  "Chat",
  "Permissoes",
  "Agenda",
  "Login",
  "AlterarSenha",
 "ConsultaPublica",
"GerenciarConsultaPublica",
 "CentralConsulta",
 "PainelParlamentar",
];

// ---- DICIONÁRIO PARA EXIBIÇÃO BONITA ----
const TELAS_LABEL = {
  Materias: "Matérias",
  Sessoes: "Sessões",
  SessaoLegislativa: "Sessão Legislativa",
  PainelDeControle: "Painel de Controle",
  PainelPublico: "Painel Público",
  PainelPublicoIA: "Painel Público (IA)",
  Comissoes: "Comissões",
  Presencas: "Presenças",
  Usuarios: "Usuários",
  Parlamentares: "Parlamentares",
  Tramitacao: "Tramitação",
  Pauta: "Pauta",
  Atas: "Atas",
  VisualizarAtas: "Visualizar Atas",
  Relatorios: "Relatórios",
  Legislatura: "Legislatura",
  NovoProtocolo: "Novo Protocolo",
  ProtocolosAdmin: "Protocolos (Admin)",
  PainelJuridico: "Painel Jurídico",
  PainelComissao: "Painel Comissão",
  PedidosIA: "Pedidos IA",
  Email: "Email",
  Chat: "Chat",
  Permissoes: "Permissões",
  Agenda: "Agenda",
  Login: "Login",
  AlterarSenha: "Alterar Senha",
  ConsultaPublica: "Consulta Pública",
  GerenciarConsultaPublica: "Gerenciar Consulta Pública",
  CentralConsulta: "Central de Consulta",
   PainelParlamentar: "Painel Parlamentar",
};

const TIPOS_USUARIO = [
  "Vereador",
  "Administrativo",
  "Juridico",
  "Presidente",
  "MasterAdm"
];
const TIPOS_LABEL = {
  Vereador: "Vereador",
  Administrativo: "Administrativo",
  Juridico: "Jurídico",
  Presidente: "Presidente",
  MasterAdm: "MasterAdm"
};

const ACOES = [
  { chave: "visualizar", label: "Visualizar" },
  { chave: "adicionar", label: "Adicionar" },
  { chave: "editar", label: "Editar" },
  { chave: "excluir", label: "Excluir" },
];

export default function GerenciarPermissoes() {
  const [permissoes, setPermissoes] = useState({});
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    async function carregar() {
      setCarregando(true);
      const snap = await getDocs(collection(db, "permissoes"));
      const dados = {};
      snap.forEach(docRef => {
        const d = docRef.data();
        const telaKey = d.tela;
        const tipoKey = d.tipoUsuario;
        if (!dados[telaKey]) dados[telaKey] = {};
        dados[telaKey][tipoKey] = d.permissoes;
      });
      setPermissoes(dados);
      setCarregando(false);
    }
    carregar();
  }, []);

  const alterarPermissao = (tela, tipoUsuario, acao, valor) => {
    setPermissoes(prev => {
      const novo = { ...prev };
      if (!novo[tela]) novo[tela] = {};
      if (!novo[tela][tipoUsuario]) novo[tela][tipoUsuario] = {};
      novo[tela][tipoUsuario][acao] = valor;
      return novo;
    });
  };

  const salvar = async () => {
    setSalvando(true);
    const batch = [];
    for (let i = 0; i < TELAS.length; i++) {
      const tela = TELAS[i];
      for (let j = 0; j < TIPOS_USUARIO.length; j++) {
        const tipoUsuario = TIPOS_USUARIO[j];
        const permissoesObj = (permissoes[tela] && permissoes[tela][tipoUsuario]) || {};
        const docId = `${tela}_${tipoUsuario}`;
        const docRef = doc(db, "permissoes", docId);
        batch.push(
          setDoc(
            docRef,
            {
              tela,         // <-- PADRÃO
              tipoUsuario,  // <-- PADRÃO
              permissoes: {
                visualizar: !!permissoesObj.visualizar,
                adicionar: !!permissoesObj.adicionar,
                editar: !!permissoesObj.editar,
                excluir: !!permissoesObj.excluir,
              },
            },
            { merge: true }
          )
        );
      }
    }
    await Promise.all(batch);
    setSalvando(false);
    alert("Permissões salvas com sucesso!");
  };

  return (
    <div style={{ maxWidth: 1100, margin: "auto", padding: 24 }}>
      <h2 style={{ marginBottom: 12 }}>Controle de Permissões</h2>
      {carregando ? (
        <div style={{ padding: 40 }}>Carregando permissões...</div>
      ) : (
        <div style={{ overflowX: "auto", background: "#fafcff", borderRadius: 10, border: "1px solid #e5e8f0" }}>
          <table style={{ minWidth: 950, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f6f8fc" }}>
                <th style={{ padding: 12, borderBottom: "2px solid #ddd" }}>Tela/Função</th>
                {TIPOS_USUARIO.map(tipo => (
                  <th key={tipo} style={{ padding: 12, borderBottom: "2px solid #ddd" }}>
                    {TIPOS_LABEL[tipo]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TELAS.map((tela) => (
                <tr key={tela}>
                  <td style={{ padding: 10, borderBottom: "1px solid #eee", fontWeight: 500 }}>{TELAS_LABEL[tela]}</td>
                  {TIPOS_USUARIO.map((tipo) => (
                    <td key={tipo} style={{ padding: 7, borderBottom: "1px solid #eee", minWidth: 170 }}>
                      <div style={{ display: "flex", flexDirection: "row", gap: 8 }}>
                        {ACOES.map(acao => (
                          <label key={acao.chave} style={{ fontSize: 14, display: "flex", alignItems: "center" }}>
                            <input
                              type="checkbox"
                              checked={
                                !!(
                                  permissoes[tela] &&
                                  permissoes[tela][tipo] &&
                                  permissoes[tela][tipo][acao.chave]
                                )
                              }
                              onChange={e =>
                                alterarPermissao(tela, tipo, acao.chave, e.target.checked)
                              }
                              style={{ marginRight: 2 }}
                            />
                            {acao.label}
                          </label>
                        ))}
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <button
        onClick={salvar}
        disabled={carregando || salvando}
        style={{
          marginTop: 30,
          background: "#1854b4",
          color: "#fff",
          padding: "12px 28px",
          border: "none",
          fontSize: 17,
          borderRadius: 7,
          cursor: "pointer",
        }}
      >
        {salvando ? "Salvando..." : "Salvar Permissões"}
      </button>
    </div>
  );
}
