export async function corrigirTextoPorIA(texto) {
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: "Corrija o texto da fala parlamentar mantendo o sentido original, sem adicionar ou remover conteúdo relevante.",
          },
          {
            role: "user",
            content: texto,
          },
        ],
        temperature: 0.4,
      }),
    });

    const result = await response.json();
    return result.choices?.[0]?.message?.content || "Erro ao corrigir texto.";
  } catch (error) {
    console.error("Erro na correção por IA:", error);
    return "Erro ao corrigir texto.";
  }
}

export async function resumirTextoPorIA(texto) {
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: "Resuma a seguinte fala parlamentar em tópicos claros e objetivos.",
          },
          {
            role: "user",
            content: texto,
          },
        ],
        temperature: 0.4,
      }),
    });

    const result = await response.json();
    const respostaTexto = result.choices?.[0]?.message?.content;

    if (respostaTexto) {
      return respostaTexto
        .split("\n")
        .filter((l) => l.trim() !== "")
        .map((l) => l.replace(/^[-*•\d.\s]+/, "").trim());
    }

    return ["Não foi possível gerar um resumo."];
  } catch (error) {
    console.error("Erro ao resumir por IA:", error);
    return ["Erro ao gerar resumo."];
  }
}
