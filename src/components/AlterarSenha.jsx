import React, { useState } from "react";
import { db } from "../firebase";
import { doc, updateDoc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import "./AlterarSenha.css";

// Função de hash igual cadastro/login
function hashSenha(str) {
  let hash = 0, i, chr;
  for (i = 0; i < str.length; i++) {
    chr = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return hash.toString();
}

export default function AlterarSenha() {
  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmaSenha, setConfirmaSenha] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [loading, setLoading] = useState(false);

  // Dados do usuário logado (do localStorage)
  const usuarioLogado = JSON.parse(localStorage.getItem("usuarioLogado") || "{}");

  // Coleção: pode ser "usuarios" ou "vereadores" (ajuste conforme seu sistema)
  const COLECAO = "usuarios";

  const handleAlterar = async (e) => {
    e.preventDefault();
    setMensagem("");

    if (!senhaAtual || !novaSenha || !confirmaSenha) {
      setMensagem("Preencha todos os campos.");
      return;
    }
    if (novaSenha !== confirmaSenha) {
      setMensagem("Nova senha e confirmação não conferem.");
      return;
    }
    if (novaSenha.length < 6) {
      setMensagem("A nova senha deve ter pelo menos 6 caracteres.");
      return;
    }

    setLoading(true);
    try {
      // Buscar usuário pelo login salvo no localStorage
      const snap = await getDocs(query(collection(db, COLECAO), where("login", "==", usuarioLogado.login)));
      if (snap.empty) {
        setMensagem("Usuário não encontrado.");
        setLoading(false);
        return;
      }
      const userDoc = snap.docs[0];
      const userData = userDoc.data();

      // Confere senha atual
      if (userData.senha !== hashSenha(senhaAtual)) {
        setMensagem("Senha atual incorreta.");
        setLoading(false);
        return;
      }

      // Atualiza a senha
      await updateDoc(doc(db, COLECAO, userDoc.id), {
        senha: hashSenha(novaSenha)
      });

      setMensagem("Senha alterada com sucesso!");
      setSenhaAtual("");
      setNovaSenha("");
      setConfirmaSenha("");
    } catch (err) {
      setMensagem("Erro ao alterar senha. Tente novamente.");
    }
    setLoading(false);
  };

  return (
    <div className="alterar-senha-container">
      <h2>Alterar Senha</h2>
      <form className="form-alterar-senha" onSubmit={handleAlterar}>
        <input
          type="password"
          placeholder="Senha atual"
          value={senhaAtual}
          onChange={e => setSenhaAtual(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Nova senha"
          value={novaSenha}
          onChange={e => setNovaSenha(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Confirmar nova senha"
          value={confirmaSenha}
          onChange={e => setConfirmaSenha(e.target.value)}
          required
        />
        <button type="submit" disabled={loading}>
          {loading ? "Alterando..." : "Alterar Senha"}
        </button>
        {mensagem && <div className="mensagem">{mensagem}</div>}
      </form>
    </div>
  );
}
