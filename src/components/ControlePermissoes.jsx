// ControlePermissoes.jsx
import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import {
  collection,
  doc,
  setDoc,
  getDocs,
  updateDoc,
} from "firebase/firestore";
import "./ControlePermissoes.css";

const tiposUsuarios = ["Vereador", "Administrativo", "Jurídico", "Presidente", "MasterAdm"];
const telasDisponiveis = [
  "Cadastro de Usuários",
  "Cadastro de Sessão",
  "Cadastro de Matérias",
  "Controle de Votação",
  "Painel de Sessão",
  "Relatórios",
  "Painel Público",
];
const funcoesDisponiveis = [
  "Excluir Usuários",
  "Excluir Matérias",
  "Excluir Sessões",
  "Excluir Atas",
  "Editar Sessões",
  "Gerar PDF",
];

export default function ControlePermissoes() {
  const [permissoes, setPermissoes] = useState({});

  useEffect(() => {
    async function carregarPermissoes() {
      const snap = await getDocs(collection(db, "permissoes"));
      const dados = {};
      snap.forEach((doc) => {
        dados[doc.id] = doc.data();
      });
      setPermissoes(dados);
    }
    carregarPermissoes();
  }, []);

  const handleChangeTela = (tipo, tela) => {
    const atual = permissoes[tipo]?.telas || [];
    const novo = atual.includes(tela)
      ? atual.filter((t) => t !== tela)
      : [...atual, tela];
    setPermissoes((prev) => ({
      ...prev,
      [tipo]: {
        ...prev[tipo],
        telas: novo,
      },
    }));
  };

  const handleChangeFuncao = (tipo, funcao) => {
    const atual = permissoes[tipo]?.funcoes || [];
    const novo = atual.includes(funcao)
      ? atual.filter((f) => f !== funcao)
      : [...atual, funcao];
    setPermissoes((prev) => ({
      ...prev,
      [tipo]: {
        ...prev[tipo],
        funcoes: novo,
      },
    }));
  };

  const salvarPermissoes = async (tipo) => {
    const ref = doc(db, "permissoes", tipo);
    await setDoc(ref, permissoes[tipo]);
    alert("Permissões salvas para " + tipo);
  };

  return (
    <div className="permissoes-container">
      <h2>Controle de Permissões por Tipo de Usuário</h2>
      {tiposUsuarios.map((tipo) => (
        <div className="card" key={tipo}>
          <h3>{tipo}</h3>
          <div className="colunas">
            <div>
              <h4>Acesso às Telas:</h4>
              {telasDisponiveis.map((tela) => (
                <label key={tela}>
                  <input
                    type="checkbox"
                    checked={permissoes[tipo]?.telas?.includes(tela) || false}
                    onChange={() => handleChangeTela(tipo, tela)}
                  />
                  {tela}
                </label>
              ))}
            </div>
            <div>
              <h4>Funções Permitidas:</h4>
              {funcoesDisponiveis.map((funcao) => (
                <label key={funcao}>
                  <input
                    type="checkbox"
                    checked={permissoes[tipo]?.funcoes?.includes(funcao) || false}
                    onChange={() => handleChangeFuncao(tipo, funcao)}
                  />
                  {funcao}
                </label>
              ))}
            </div>
          </div>
          <button className="btn-salvar" onClick={() => salvarPermissoes(tipo)}>
            Salvar Permissões
          </button>
        </div>
      ))}
    </div>
  );
}
