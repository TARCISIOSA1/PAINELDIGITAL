import React, { useState, useEffect } from "react";
import { getAuth } from "firebase/auth";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  updateDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import TopoInstitucional from "./TopoInstitucional";
import "./SessaoAtivaParlamentar.css";
import PainelVotacao from "./PainelVotacao"; // Painel público como miniatura

export default function SessaoAtivaParlamentar() {
  const [carregando, setCarregando] = useState(true);
  const [usuario, setUsuario] = useState(null);
  const [presenca, setPresenca] = useState(null);
  const [votacaoAtual, setVotacaoAtual] = useState(null);
  const [votoAtual, setVotoAtual] = useState("");
  const [erro, setErro] = useState("");
  const [senhaModal, setSenhaModal] = useState(false);
  const [senha, setSenha] = useState("");
  const [novoVoto, setNovoVoto] = useState("");
  const [votoProcessando, setVotoProcessando] = useState(false);

  // 1. Busca usuário logado
  useEffect(() => {
    async function fetchUser() {
      setCarregando(true);
      setErro("");
      try {
        const auth = getAuth();
        const authUser = auth.currentUser;
        if (!authUser) {
          setErro("Usuário não autenticado.");
          setCarregando(false);
          return;
        }
        // Busca usuário em 'usuarios' (email igual ao do Auth)
        const usuariosRef = collection(db, "usuarios");
        const q = query(usuariosRef, where("email", "==", authUser.email));
        const snap = await getDocs(q);
        if (snap.empty) {
          setErro("Usuário não encontrado no cadastro de usuários.");
          setCarregando(false);
          return;
        }
        const userDoc = snap.docs[0];
        const userData = { id: userDoc.id, ...userDoc.data() };

        if (userData.tipoUsuario !== "Vereador") {
          setErro("Você não tem permissão para votar nesta tela.");
          setCarregando(false);
          return;
        }

        setUsuario(userData);

        // Busca sessão ativa (status: Ativa)
        const sessoesSnap = await getDocs(collection(db, "sessoes"));
        const sessaoAtiva = sessoesSnap.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .find((s) => s.status === "Ativa");
        if (!sessaoAtiva) {
          setErro("Nenhuma sessão ativa encontrada.");
          setCarregando(false);
          return;
        }

        // Busca presença do usuário na sessão ativa
        const presencasSnap = await getDocs(
          collection(db, "sessoes", sessaoAtiva.id, "presencas")
        );
        const presencaDoc = presencasSnap.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .find(
            (p) =>
              p.vereador_id === userData.uid ||
              p.vereador_id === userDoc.id
          );
        if (
          !presencaDoc ||
          !presencaDoc.presente ||
          !presencaDoc.habilitado
        ) {
          setErro(
            "Você não está habilitado para votar nesta sessão (verifique presença e habilitação com a Mesa Diretora)."
          );
          setPresenca(null);
          setCarregando(false);
          return;
        }
        setPresenca(presencaDoc);

        // Busca votação atual (painelAtivo/votacaoAtual)
        const votacaoSnap = await getDoc(
          doc(db, "painelAtivo", "votacaoAtual")
        );
        if (!votacaoSnap.exists()) {
          setErro("Nenhuma votação em andamento.");
          setCarregando(false);
          return;
        }
        const votacaoData = votacaoSnap.data();
        setVotacaoAtual(votacaoData);

        // Descobre voto atual do vereador (se já existe)
        const votoUser =
          votacaoData.votos?.find(
            (v) =>
              v.vereador_id === userData.uid ||
              v.vereador_id === userDoc.id
          )?.voto || "";

        setVotoAtual(votoUser);
        setCarregando(false);
      } catch (e) {
        setErro("Erro ao carregar dados. " + e.message);
        setCarregando(false);
      }
    }
    fetchUser();
    // Escuta: se precisar atualizar em tempo real, pode implementar snapshot.
  }, []);

  // Votação está ativa?
  const votacaoLiberada =
    votacaoAtual && votacaoAtual.status === "votando";

  // Função para iniciar voto/alteração
  function handleVotarClick(voto) {
    setNovoVoto(voto);
    setSenha("");
    setSenhaModal(true);
    setErro("");
  }

  // Confirmação da senha e voto
  async function confirmarVoto() {
    setVotoProcessando(true);
    setErro("");
    try {
      // Busca senha do usuário (do campo, não Auth)
      if (senha !== usuario.senha) {
        setErro("Senha incorreta!");
        setVotoProcessando(false);
        return;
      }
      // Atualiza voto no array de votos de painelAtivo/votacaoAtual
      const votacaoRef = doc(db, "painelAtivo", "votacaoAtual");
      const votacaoSnap = await getDoc(votacaoRef);
      if (!votacaoSnap.exists()) {
        setErro("Votação não encontrada.");
        setVotoProcessando(false);
        setSenhaModal(false);
        return;
      }
      const votacaoData = votacaoSnap.data();
      const votos = votacaoData.votos?.map((v) => {
        if (
          v.vereador_id === usuario.uid ||
          v.vereador_id === usuario.id
        ) {
          return {
            ...v,
            voto: novoVoto,
            timestamp: new Date().toISOString(),
          };
        }
        return v;
      });

      await updateDoc(votacaoRef, { votos });
      setVotoAtual(novoVoto);
      setSenhaModal(false);
    } catch (e) {
      setErro("Erro ao registrar voto: " + e.message);
    }
    setVotoProcessando(false);
  }

  // ---- Renderização ----
  if (carregando) return <div className="p-4">Carregando...</div>;
  if (erro)
    return (
      <div className="p-4 text-red-600 bg-red-100 rounded">{erro}</div>
    );

  return (
    <div>
      {/* TOPO INSTITUCIONAL */}
      <TopoInstitucional />

      {/* PAINEL PARLAMENTAR */}
      <div className="max-w-3xl mx-auto p-4 bg-white rounded shadow mt-6">
        <h2 className="text-2xl font-semibold mb-4 text-center">
          Sessão Ativa - Painel do Parlamentar
        </h2>

        <div className="mb-4">
          <strong>Bem-vindo, {usuario.nome}</strong>
        </div>

        {votacaoAtual && (
          <>
            <div className="mb-2">
              <span className="font-semibold">Matéria em Votação:</span>{" "}
              {votacaoAtual.titulo} ({votacaoAtual.tipo})<br />
              <span className="italic">
                Autor: {votacaoAtual.autor || "-"}
              </span>
            </div>

            <div className="mb-2">
              <span className="font-semibold">Status:</span>{" "}
              <span className="capitalize">{votacaoAtual.status}</span>
            </div>

            {votacaoLiberada ? (
              <div className="my-4">
                <span className="font-semibold">Seu voto:</span>
                <div className="flex space-x-2 mt-2">
                  {["Sim", "Não", "Abstenção"].map((v) => (
                    <button
                      key={v}
                      className={`px-4 py-2 rounded font-bold shadow ${
                        votoAtual === v
                          ? "bg-blue-600 text-white"
                          : "bg-gray-200"
                      }`}
                      disabled={senhaModal}
                      onClick={() => handleVotarClick(v)}
                    >
                      {v}
                    </button>
                  ))}
                </div>
                <div className="mt-2">
                  {votoAtual && (
                    <span>
                      Seu voto atual:{" "}
                      <span className="font-bold">{votoAtual}</span>
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="my-4">
                <span className="text-gray-700">
                  Votação encerrada ou não iniciada.
                </span>
              </div>
            )}
          </>
        )}

        {/* Modal de senha */}
        {senhaModal && (
          <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
            <div className="bg-white rounded p-6 max-w-sm w-full shadow-lg">
              <h3 className="text-lg font-bold mb-2">
                Confirme sua senha para votar
              </h3>
              <input
                type="password"
                className="w-full border rounded p-2 mb-4"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="Digite sua senha"
                disabled={votoProcessando}
              />
              {erro && (
                <div className="text-red-500 mb-2">{erro}</div>
              )}
              <div className="flex justify-end space-x-2">
                <button
                  className="bg-gray-300 px-3 py-1 rounded"
                  onClick={() => setSenhaModal(false)}
                  disabled={votoProcessando}
                >
                  Cancelar
                </button>
                <button
                  className="bg-blue-600 text-white px-3 py-1 rounded"
                  onClick={confirmarVoto}
                  disabled={votoProcessando}
                >
                  Confirmar Voto
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Mini painel público */}
        <div className="mt-6 p-2 bg-gray-100 rounded">
          <h3 className="font-semibold mb-2 text-blue-700">
            Painel Público - Acompanhe a Sessão
          </h3>
          <PainelVotacao mini />
        </div>
      </div>
    </div>
  );
}
