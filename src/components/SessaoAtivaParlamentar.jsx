import React, { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { db } from "../firebase";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  updateDoc,
} from "firebase/firestore";
import TopoInstitucional from "./TopoInstitucional";
import PainelVotacao from "./PainelVotacao";
import "./SessaoAtivaParlamentar.css";

export default function SessaoAtivaParlamentar() {
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [parlamentar, setParlamentar] = useState(null);
  const [sessaoAtiva, setSessaoAtiva] = useState(null);
  const [votacaoAtual, setVotacaoAtual] = useState(null);
  const [votoAtual, setVotoAtual] = useState("");
  const [senhaModal, setSenhaModal] = useState(false);
  const [senha, setSenha] = useState("");
  const [novoVoto, setNovoVoto] = useState("");
  const [votoProcessando, setVotoProcessando] = useState(false);

  // MONTA tudo na autenticação
  useEffect(() => {
    setCarregando(true);
    setErro("");
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setErro("Faça login para votar.");
        setCarregando(false);
        return;
      }
      try {
        // Busca parlamentar
        const snap = await getDocs(
          query(collection(db, "parlamentares"), where("email", "==", user.email))
        );
        if (snap.empty) {
          setErro("Seu usuário não está cadastrado como parlamentar.");
          setCarregando(false);
          return;
        }
        const parlamentarDoc = snap.docs[0];
        const parlamentarData = { id: parlamentarDoc.id, ...parlamentarDoc.data() };
        setParlamentar(parlamentarData);

        // Busca sessão ativa
        const sessoesSnap = await getDocs(collection(db, "sessoes"));
        const sessao = sessoesSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
          .find((s) => s.status === "Ativa");
        if (!sessao) {
          setErro("Nenhuma sessão ativa encontrada.");
          setCarregando(false);
          return;
        }
        setSessaoAtiva(sessao);

        // Confere se está habilitado (id do parlamentar tem que estar em habilitados)
        if (!sessao.habilitados || !Array.isArray(sessao.habilitados) || !sessao.habilitados.includes(parlamentarDoc.id)) {
          setErro("Você não está habilitado para votar nesta sessão. Procure a Mesa Diretora.");
          setCarregando(false);
          return;
        }

        // Busca votação atual do painel
        const painelSnap = await getDoc(doc(db, "painelAtivo", "ativo"));
        if (!painelSnap.exists() || !painelSnap.data().votacaoAtual) {
          setErro("Nenhuma votação em andamento.");
          setCarregando(false);
          return;
        }
        const painelData = painelSnap.data();
        setVotacaoAtual(painelData.votacaoAtual);

        // Busca voto atual
        let voto = "";
        if (painelData.votacaoAtual.votos && Array.isArray(painelData.votacaoAtual.votos)) {
          const votoObj = painelData.votacaoAtual.votos.find((v) => v.vereador_id === parlamentarDoc.id);
          if (votoObj) voto = votoObj.voto;
        }
        setVotoAtual(voto);

        setCarregando(false);
      } catch (e) {
        setErro("Erro ao carregar dados. " + e.message);
        setCarregando(false);
      }
    });
    return () => unsub();
  }, []);

  // Só vota se status em_votacao
  const votacaoLiberada = votacaoAtual && votacaoAtual.status === "em_votacao";

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
      if (senha !== parlamentar.senha) {
        setErro("Senha incorreta!");
        setVotoProcessando(false);
        return;
      }

      // Atualiza voto no painel
      const painelRef = doc(db, "painelAtivo", "ativo");
      const painelSnap = await getDoc(painelRef);
      if (!painelSnap.exists()) {
        setErro("Votação não encontrada.");
        setVotoProcessando(false);
        setSenhaModal(false);
        return;
      }
      const painelData = painelSnap.data();
      let votos = painelData.votacaoAtual.votos || [];

      let votou = false;
      votos = votos.map((v) => {
        if (v.vereador_id === parlamentar.id) {
          votou = true;
          return { ...v, voto: novoVoto, timestamp: new Date().toISOString() };
        }
        return v;
      });
      if (!votou) {
        votos.push({
          vereador_id: parlamentar.id,
          nome: parlamentar.nome,
          voto: novoVoto,
          timestamp: new Date().toISOString(),
        });
      }

      await updateDoc(painelRef, {
        "votacaoAtual.votos": votos,
      });

      setVotoAtual(novoVoto);
      setSenhaModal(false);
    } catch (e) {
      setErro("Erro ao registrar voto: " + e.message);
    }
    setVotoProcessando(false);
  }

  if (carregando) return <div className="p-4">Carregando...</div>;
  if (erro) return <div className="p-4 text-red-600 bg-red-100 rounded">{erro}</div>;

  return (
    <div>
      <TopoInstitucional />
      <div className="max-w-3xl mx-auto p-4 bg-white rounded shadow mt-6">
        <h2 className="text-2xl font-semibold mb-4 text-center">
          Sessão Ativa - Painel do Parlamentar
        </h2>
        <div className="mb-4">
          <strong>Bem-vindo, {parlamentar.nome}</strong>
        </div>
        {votacaoAtual && (
          <>
            <div className="mb-2">
              <span className="font-semibold">Matéria em Votação:</span>{" "}
              {votacaoAtual.titulo} ({votacaoAtual.tipo})<br />
              <span className="italic">Autor: {votacaoAtual.autor || "-"}</span>
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
                      className={`px-4 py-2 rounded font-bold shadow ${votoAtual === v ? "bg-blue-600 text-white" : "bg-gray-200"}`}
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
                      Seu voto atual: <span className="font-bold">{votoAtual}</span>
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
