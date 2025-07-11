require('dotenv').config();
console.log('Valor de TESTE_BASE:', process.env.TESTE_BASE);
console.log(
  'Qtd de caracteres FIREBASE_SERVICE_ACCOUNT:',
  process.env.FIREBASE_SERVICE_ACCOUNT ? process.env.FIREBASE_SERVICE_ACCOUNT.length : 'VAZIO'
);

const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { OpenAI } = require('openai');
const admin = require('firebase-admin');

// --- Firebase Admin: Universal Initialization ---
let serviceAccount;
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  // Em produção/deploy (Railway, Render, etc): variável de ambiente base64
  serviceAccount = JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT, 'base64').toString('utf-8'));
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

  // Corrige a extensão do arquivo para .webm, se necessário
  let originalPath = req.file.path;
  let webmPath = originalPath.endsWith('.webm') ? originalPath : originalPath + '.webm';
  if (!originalPath.endsWith('.webm')) {
    fs.renameSync(originalPath, webmPath);
  }

  try {
    // Use o arquivo COM extensão correta!
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
    // Limpa o arquivo temporário
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

// Endpoint para listar atas com filtros (período, sessão)
app.post('/api/atas', async (req, res) => {
  try {
    const { periodoInicio, periodoFim, sessaoId } = req.body;
    let queryRef = db.collection('atas');

    if (sessaoId) {
      queryRef = queryRef.where('sessaoId', '==', sessaoId);
    }
    if (periodoInicio) {
      queryRef = queryRef.where('data', '>=', periodoInicio);
    }
    if (periodoFim) {
      queryRef = queryRef.where('data', '<=', periodoFim);
    }

    const snapshot = await queryRef.get();
    const atas = [];
    snapshot.forEach(doc => {
      atas.push({ id: doc.id, ...doc.data() });
    });

    res.json({ atas });
  } catch (err) {
    console.error('Erro ao buscar atas:', err);
    res.status(500).json({ error: 'Erro ao buscar atas' });
  }
});

// Endpoint para listar sessões legislativas (só ativas)
app.get('/api/sessoes', async (req, res) => {
  try {
    const snapshot = await db.collection('sessoesLegislativas')
      .where('status', '==', 'Ativa')
      .orderBy('dataInicio', 'desc')
      .get();

    const sessoes = [];
    snapshot.forEach(doc => {
      sessoes.push({ id: doc.id, ...doc.data() });
    });
    res.json({ sessoes });
  } catch (err) {
    console.error('Erro ao buscar sessões:', err);
    res.status(500).json({ error: 'Erro ao buscar sessões' });
  }
});

// Endpoint para perguntas em linguagem natural (OpenAI ChatCompletion)
app.post('/api/pergunte', async (req, res) => {
  try {
    const { pergunta, filtros } = req.body;
    let queryRef = db.collection('atas');
    if (filtros?.sessaoId) {
      queryRef = queryRef.where('sessaoId', '==', filtros.sessaoId);
    }
    if (filtros?.periodoInicio) {
      queryRef = queryRef.where('data', '>=', filtros.periodoInicio);
    }
    if (filtros?.periodoFim) {
      queryRef = queryRef.where('data', '<=', filtros.periodoFim);
    }

    const snapshot = await queryRef.get();

    let contextoTextos = '';
    snapshot.forEach(doc => {
      const data = doc.data();
      contextoTextos += `\nAta (${data.data}): ${data.texto}\n`;
    });

    if (contextoTextos.length > 3000) {
      contextoTextos = contextoTextos.slice(-3000);
    }

    const prompt = `Você é um assistente que responde perguntas sobre atas legislativas com base nos seguintes textos: ${contextoTextos}\nPergunta: ${pergunta}\nResposta curta e objetiva:`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Você é um assistente para atas legislativas.' },
        { role: 'user', content: prompt },
      ],
      max_tokens: 400,
    });

    const resposta = completion.choices[0].message.content.trim();
    res.json({ resposta });
  } catch (err) {
    console.error('Erro na API de pergunta:', err);
    res.status(500).json({ error: 'Erro ao processar pergunta' });
  }
});

app.listen(port, () => {
  console.log(`🚀 Servidor rodando na porta ${port}`);
});
