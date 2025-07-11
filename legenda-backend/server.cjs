require('dotenv').config();

const admin = require('firebase-admin');
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { OpenAI } = require('openai');

// --- Firebase Admin: Universal Initialization ---
let serviceAccount;
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  // Produção: variável de ambiente base64
  let firebaseAccountStr = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT, 'base64').toString('utf-8');
  firebaseAccountStr = firebaseAccountStr.replace(/\r\n/g, '\n'); // limpa quebras se necessário
  serviceAccount = JSON.parse(firebaseAccountStr);
} else {
  // Local: arquivo json
  serviceAccount = require('./camaravotacao-firebase-adminsdk-fbsvc-160f151a05.json');
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

const app = express();
const port = process.env.PORT || 3333;

const upload = multer({ dest: 'uploads/' });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(cors());
app.use(express.json());

// ============ ENDPOINT WHISPER (GARANTE EXTENSÃO .webm) ================
app.post('/api/whisper', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Nenhum arquivo enviado!' });
  }

  console.log("Arquivo recebido:", req.file);

  let originalPath = req.file.path;
  let webmPath = originalPath.endsWith('.webm') ? originalPath : originalPath + '.webm';
  if (!originalPath.endsWith('.webm')) {
    fs.renameSync(originalPath, webmPath);
  }

  try {
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(webmPath),
      model: 'whisper-1',
      response_format: 'json',
      language: 'pt',
    });

    const text = transcription.text || transcription.data?.text || '';
    return res.json({ text });
  } catch (err) {
    console.error('Erro no Whisper (webm):', err);
    return res.status(err.status || 500).json({ error: err.message || String(err) });
  } finally {
    fs.unlink(webmPath, () => {});
  }
});

// 1) SALVAR FALA DA TRIBUNA NA COLEÇÃO atasFalas (SEM CORREÇÃO IA)
app.post('/api/atasFalas', async (req, res) => {
  const { fala, orador, partido, data, horario, sessaoId } = req.body;
  try {
    await db.collection('atasFalas').add({
      fala,
      orador,
      partido,
      data,
      horario,
      sessaoId,
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('Erro ao salvar fala na ata:', err);
    res.status(500).json({ error: "Erro ao salvar fala" });
  }
});

// 2) EXPORTAR ATA CORRIGIDA POR IA
app.post('/api/atasFalas/gerarAtaCorrigida', async (req, res) => {
  const { data, sessaoId } = req.body;
  try {
    let queryRef = db.collection('atasFalas');
    if (sessaoId) queryRef = queryRef.where('sessaoId', '==', sessaoId);
    if (data) queryRef = queryRef.where('data', '==', data);

    const snapshot = await queryRef.orderBy('horario').get();

    const falas = [];
    snapshot.forEach(doc => {
      const d = doc.data();
      falas.push(`[${d.horario}] ${d.orador} (${d.partido}): ${d.fala}`);
    });
    const textoJunto = falas.join('\n');

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: "system", content: "Você é responsável por montar a ata de uma sessão legislativa. Cada fala deve aparecer com horário, nome do orador e partido, exemplo: [20:50:03] TARCISIO ARAUJO (PL): Texto da fala corrigido. NÃO altere a identificação do orador. Corrija apenas o português e pontuação das falas." },
        { role: "user", content: textoJunto }
      ]
    });
    const ataCorrigida = completion.choices[0].message.content.trim();

    res.json({ ataCorrigida });
  } catch (err) {
    console.error('Erro ao gerar ata corrigida:', err);
    res.status(500).json({ error: "Erro ao gerar ata corrigida" });
  }
});

// ... (continua igual para os demais endpoints, usando `db` sempre do `admin`)

app.listen(port, () => {
  console.log(`🚀 Servidor rodando na porta ${port}`);
});
