// src/components/TopoInstitucional.jsx
import React, { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";
import panelConfig from "../config/panelConfig.json";
import "./TopoInstitucional.css";

export default function TopoInstitucional() {
  const [legislaturaAtiva, setLegislaturaAtiva] = useState(null);
  const [sessaoAtiva, setSessaoAtiva] = useState(null);

  useEffect(() => {
    const carregarDados = async () => {
      // Busca legislatura ativa
      const legislaturaQuery = query(
        collection(db, "legislaturas"),
        where("status", "==", "Ativa")
      );
      const legislaturaSnapshot = await getDocs(legislaturaQuery);
      const legislatura = legislaturaSnapshot.docs[0]?.data() || {};
      const legislaturaId = legislaturaSnapshot.docs[0]?.id || null;
      setLegislaturaAtiva({ id: legislaturaId, ...legislatura });

      // Busca sessão legislativa ativa associada
      if (legislaturaId) {
        const sessaoQuery = query(
          collection(db, "sessoesLegislativas"),
          where("legislaturaId", "==", legislaturaId),
          where("status", "==", "Ativa")
        );
        const sessaoSnapshot = await getDocs(sessaoQuery);
        const sessao = sessaoSnapshot.docs[0]?.data() || {};
        setSessaoAtiva(sessao);
      }
    };

    carregarDados();
  }, []);

  return (
    <header className="painel-header">
      <div className="topo-institucional">
        <div className="logo-nome">
          {panelConfig.logoPath && (
            <img src={panelConfig.logoPath} alt="Logo da Câmara" className="logo-camara" />
          )}
          <div className="nome-camara">{panelConfig.nomeCamara || "Câmara Municipal"}</div>
        </div>

        {legislaturaAtiva && (
          <div className="info-bloco">
            <strong>{legislaturaAtiva.numero || "-"}ª Legislatura</strong>
            {" "}
            ({legislaturaAtiva.anoInicio || "-"} - {legislaturaAtiva.anoTermino || "-"})
            {legislaturaAtiva.presidente ? (
              <> — Presidente: {legislaturaAtiva.presidente}</>
            ) : null}
          </div>
        )}

        {sessaoAtiva && (
          <div className="info-bloco">
            <strong>{sessaoAtiva.numero || "-"}ª Sessão Legislativa</strong>
            {" — Ano: "} {sessaoAtiva.ano || "-"}
            {sessaoAtiva.dataInicio && sessaoAtiva.dataFim ? (
              <> ({sessaoAtiva.dataInicio} a {sessaoAtiva.dataFim})</>
            ) : null}
          </div>
        )}
      </div>
    </header>
  );
}
