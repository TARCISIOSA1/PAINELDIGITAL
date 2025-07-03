import React, { useEffect, useState, useRef } from "react";

export default function TribunaAtual({ tribuna }) {
  const [tempoRestante, setTempoRestante] = useState(tribuna?.tempoRestante || 0);
  const timerRef = useRef(null);
  const audioRef = useRef(null);

  useEffect(() => {
    setTempoRestante(tribuna?.tempoRestante || 0);
  }, [tribuna]);

  useEffect(() => {
    if (!tempoRestante || tribuna?.status !== "Em andamento") return;

    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      setTempoRestante((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [tribuna]);

  useEffect(() => {
    if (tempoRestante > 0 && tempoRestante <= 15) {
      if (audioRef.current) {
        audioRef.current.play().catch(() => {});
      }
    }
  }, [tempoRestante]);

  if (!tribuna) return <p className="p-4">Nenhum orador ativo no momento.</p>;

  return (
    <section className="mt-8 max-w-4xl mx-auto p-4 bg-white rounded shadow">
      <h3 className="text-xl font-semibold mb-2">Tribuna Atual</h3>
      <div className="flex items-center space-x-4">
        <img
          src={tribuna.fotoURL || "https://via.placeholder.com/80x80?text=Foto"}
          alt={tribuna.nome}
          className="w-20 h-20 rounded-full object-cover border border-gray-300"
        />
        <div>
          <p className="text-lg font-bold">{tribuna.nome}</p>
          <p className="text-sm italic">{tribuna.partido}</p>
        </div>
        <div
          className={`ml-auto font-mono text-2xl font-bold w-24 text-center rounded ${
            tempoRestante <= 15 && tempoRestante > 0 ? "bg-red-600 text-white animate-pulse" : "bg-gray-200"
          }`}
        >
          {new Date(tempoRestante * 1000).toISOString().substr(14, 5)}
        </div>
      </div>
      <audio ref={audioRef} src="/beep.mp3" preload="auto" />
    </section>
  );
}
