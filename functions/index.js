const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { Configuration, OpenAIApi } = require("openai");  // <— certifique-se de ter isto

admin.initializeApp();
const db = admin.firestore();

// Lê a chave armazenada no ambiente:
const openaiConfig = new Configuration({
  apiKey: functions.config().openai.key,
});
const openai = new OpenAIApi(openaiConfig);

exports.helloWorld = functions.https.onRequest((req, res) => {
  res.send("Olá, mundo!");
});

exports.corrigirLegendas = functions.https.onRequest(async (req, res) => {
  try {
    const { textoBruto } = req.body || {};
    if (!textoBruto) {
      return res.status(400).json({ erro: "textoBruto é obrigatório" });
    }
    const completion = await openai.createChatCompletion({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Você é um assistente que corrige transcrições de oratória de sessões legislativas em português formal.",
        },
        { role: "user", content: textoBruto },
      ],
    });
    const textoCorrigido = completion.data.choices[0].message.content;
    return res.json({ textoCorrigido });
  } catch (erro) {
    console.error("Erro em corrigirLegendas:", erro);
    return res.status(500).json({ erro: "Erro interno no servidor" });
  }
});
