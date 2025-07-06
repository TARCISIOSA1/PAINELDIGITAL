import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import "./Login.css";

export default function Login() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setErro("");
    setLoading(true);
    try {
      const auth = getAuth();
      // Autentica o usuário pelo Firebase Auth
      const userCredential = await signInWithEmailAndPassword(auth, email, senha);
      const user = userCredential.user;

      // Busca dados adicionais do usuário no Firestore
      const snap = await getDocs(query(
        collection(db, "usuarios"),
        where("email", "==", user.email)
      ));
      if (snap.empty) {
        setErro("Usuário não encontrado no banco.");
        setLoading(false);
        return;
      }
      const userData = snap.docs[0].data();
      if (userData.bloqueado) {
        setErro("Usuário bloqueado. Fale com o administrador.");
        setLoading(false);
        return;
      }

      // Salva usuário logado no localStorage (objeto)
      localStorage.setItem("usuarioLogado", JSON.stringify({
        id: snap.docs[0].id,
        nome: userData.nome,
        tipoUsuario: userData.tipoUsuario,
        email: userData.email,
      }));

      // Salva individualmente os campos esperados pelas telas!
      localStorage.setItem("id", snap.docs[0].id);
      localStorage.setItem("nome", userData.nome || "");
      localStorage.setItem("partido", userData.partido || "");
      localStorage.setItem("foto", userData.foto || "");
      localStorage.setItem("tipo", userData.tipoUsuario || "");
      localStorage.setItem("email", userData.email || "");

      // Também salva tipoUsuario separado, igual ao banco
      localStorage.setItem("tipoUsuario", userData.tipoUsuario);

      // Redireciona conforme o tipo de usuário
      const tipoUsuarioPadronizado = (userData.tipoUsuario || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();

      if (tipoUsuarioPadronizado === "vereador") {
        navigate(`/votar/${snap.docs[0].id}`);
      } else if (["masteradm", "presidente", "administrativo"].includes(tipoUsuarioPadronizado)) {
        navigate(`/painel`);
      } else if (tipoUsuarioPadronizado === "juridico") {
        navigate(`/painel-juridico`);
      } else {
        navigate(`/`);
      }
    } catch (err) {
      setErro("Login ou senha inválidos.");
    }
    setLoading(false);
  };

  return (
    <div className="login-container">
      <h2>Login do Sistema</h2>
      <form onSubmit={handleLogin} className="form-login">
        <input
          type="email"
          placeholder="E-mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Senha"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          required
        />
        <button type="submit" disabled={loading}>
          {loading ? "Entrando..." : "Entrar"}
        </button>
        {erro && <p className="erro">{erro}</p>}
      </form>
    </div>
  );
}
