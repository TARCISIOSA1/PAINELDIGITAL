import React, { useState, useEffect } from "react";
import { getAuth } from "firebase/auth";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import TopoInstitucional from "./TopoInstitucional";
import "./SessaoAtivaParlamentar.css";
import PainelVotacao from "./PainelVotacao";

export default function SessaoAtivaParlamentar() {
  const [carregando, setCarregando] = useState(true);
  const [parlamentar, setParlamentar] = useState(null);
  const [sessaoAtiva, setSessaoAtiva] = useState(null);
  const [votacaoAtual, setVotacaoAtual] = useState(null);
  const [erro, setErro] = useState("");
  const [senhaModal, setSenhaModal] = useState(false);
  const [senha, setSenha] = useState("");
  const [novoVoto, setNovoVoto] = useState("");
  const [votoProcessando, setVotoProcessando] = useState(false);
  const [votoAtual, setVotoAtual] = useState("");

  useEffect(() => {
    async function fetchData() {
      setCarregando(true);
      setErro("");
      try {
        // 1. Busca usuário logado (e-mail do Auth)
        const auth = getAuth();
        const user = auth.currentUser;
        if (!user) {
          setErro("Faça login para votar.");
          setCarregando(false);
          return;
        }

        // 2. Busca parlamentar pelo e-mail (coleção 'parlamentares')
        const snap = await getDocs(query(collection(db, "parlamentares"), where("email", "==", user.email)));
        if (snap.empty) {
          setErro("Seu usuário não está cadastrado como parlamentar.");
          setCarregando(false);
          return;
        }
        const parlamentarDoc = snap.docs[0];
        const parlamentarData = { id: parlamentarDoc.id, ...parlamentarDoc.data() };
        setParlamentar(parlamentarData);

        // 3. Busca sessão ativa (status === "Ativa")
        const sessoesSnap = await getDocs(collection(db, "sessoes"));
        const sessao = sessoesSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })).find((s) => s.status === "Ativa");
        if (!sessao) {
          setErro("Nenhuma sessão ativa encontrada.");
          setCarregando(false);
          return;
        }
        setSessaoAtiva(sessao);

        // 4. Verifica se está habilitado no array de habilitados
        if (!sessao.habilitados || !sessao.habilitados.includes(parlamentarDoc.id)) {
          setErro("Você não está habilitado para votar nesta sessão. Procure a Mesa Diretora.");
          setCarregando(false);
          return;
        }

        // 5. Busca votação atual no painelAtivo/ativo
        const painelSnap = await getDoc(doc(db, "painelAtivo", "ativo"));
        if (!painelSnap.exists()) {
          setErro("Nenhuma votação em andamento.");
          setCarregando(false);
          return;
        }
        const painelData = painelSnap.data();
        if (!painelData.votacaoAtual) {
          setErro("Nenhuma votação em andamento.");
          setCarregando(false);
          return;
        }
        setVotacaoAtual(painelData.votacaoAtual);

        // 6. Busca voto atual do parlamentar, se já existe
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
    }
    fetchData();
  }, []);

  // Votação está ativa?
  const votacaoLiberada = votacaoAtual && (votacaoAtual.status === "em_votacao" || votacaoAtual.status === "votando");

  function handleVotarClick(voto) {
    setNovoVoto(voto);
    setSenha("");
    setSenhaModal(true);
    setErro("");
  }

  async function confirmarVoto() {
    setVotoProcessando(true);
    setErro("");
    try {
      // Confere senha (texto claro)
      if (senha !== parlamentar.senha) {
        setErro("Senha incorreta!");
        setVotoProcessando(false);
        return;
      }
      // Atualiza voto no array de votos de painelAtivo/ativo
      const painelRef = doc(db, "painelAtivo", "ativo");
      const painelSnap = await getDoc(painelRef);
      if (!painelSnap.exists()) {
        setErro("Votação não encontrada.");
        setVotoProcessando(false);
        setSenhaModal(false);
        return;
      }
      const painelData = painelSnap.data();
      let votos = Array.isArray(painelData.votacaoAtual.votos)
        ? painelData.votacaoAtual.votos
        : [];
      let jaVotou = false;
      votos = votos.map((v) => {
        if (v.vereador_id === parlamentar.id) {
          jaVotou = true;
          return {
            ...v,
            voto: novoVoto,
            timestamp: new Date().toISOString(),
          };
        }
        return v;
      });
      if (!jaVotou) {
        votos.push({
          vereador_id: parlamentar.id,
          nome: parlamentar.nome,
          voto: novoVoto,
          timestamp: new Date().toISOString(),
        });
      }
      await updateDoc(painelRef, { "votacaoAtual.votos": votos });
      setVotoAtual(novoVoto);
      setSenhaModal(false);
    } catch (e) {
      setErro("Erro ao registrar voto: " + e.message);
    }
    setVotoProcessando(false);
  }

  if (carregando) return <div className="p-4">Carregando...</div>;
  if (erro)
    return (
      <div className="p-4 text-red-600 bg-red-100 rounded">{erro}</div>
    );

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
              {votacaoAtual.materias && votacaoAtual.materias[0]
                ? votacaoAtual.materias[0].titulo
                : "-"}
              <br />
              <span className="italic">
                Autor:{" "}
                {votacaoAtual.materias && votacaoAtual.materias[0]
                  ? votacaoAtual.materias[0].autor
                  : "-"}
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
