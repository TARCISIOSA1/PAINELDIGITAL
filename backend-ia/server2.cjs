require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { OpenAI } = require('openai');
const admin = require('firebase-admin');
const axios = require('axios');

// =================== ATENÇÃO ===================
// Inicialização universal do Firebase Admin
let serviceAccount;
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  // No deploy/cloud: variável de ambiente base64
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
const port = process.env.PORT || 3334;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(cors());
app.use(express.json());

// ==== ENDPOINTS INSTITUCIONAIS (opcional, mantenha se quiser) ====

// Exemplo de boas-vindas
app.get('/api/boasvindas', async (req, res) => {
  try {
    const prompt = `Gere uma mensagem institucional curta e cordial para dar boas-vindas ao público em uma sessão plenária legislativa municipal. Use linguagem solene, positiva e destaque a importância da transparência, democracia e participação popular.`;
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: "system", content: "Você é um cerimonialista institucional do Legislativo." },
        { role: "user", content: prompt }
      ],
      max_tokens: 60,
    });
    const frase = completion.choices[0].message.content.trim();
    res.json({ frase });
  } catch (err) {
    res.status(500).json({ error: "Erro ao gerar frase de boas-vindas" });
  }
});

// ==== ENDPOINTS BÁSICOS ====

app.post('/api/atas', async (req, res) => {
  try {
    const { periodoInicio, periodoFim, sessaoId } = req.body;
    let queryRef = db.collection('atas');
    if (sessaoId) queryRef = queryRef.where('sessaoId', '==', sessaoId);
    if (periodoInicio) queryRef = queryRef.where('data', '>=', periodoInicio);
    if (periodoFim) queryRef = queryRef.where('data', '<=', periodoFim);
    const snapshot = await queryRef.get();
    const atas = [];
    snapshot.forEach(doc => atas.push({ id: doc.id, ...doc.data() }));
    res.json({ atas });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar atas' });
  }
});

app.get('/api/sessoes', async (req, res) => {
  try {
    const snapshot = await db.collection('sessoesLegislativas')
      .where('status', '==', 'Ativa')
      .orderBy('dataInicio', 'desc')
      .get();
    const sessoes = [];
    snapshot.forEach(doc => sessoes.push({ id: doc.id, ...doc.data() }));
    res.json({ sessoes });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar sessões' });
  }
});

// ==== ENDPOINT UNIVERSAL IA (COM TUDO) ====

app.post('/api/pergunte', async (req, res) => {
  try {
    const { pergunta } = req.body;

    // 1. Busca no Firestore (inclusive legislação)
    const sessoesSnap = await db.collection('sessoes').orderBy('dataInicio', 'desc').limit(10).get();
    const atasSnap = await db.collection('atas').get();
    const presencasSnap = await db.collection('presencas').get();
    const parlamentaresSnap = await db.collection('parlamentares').get();
    const materiasSnap = await db.collection('materias').get();

    const legislacaoLegislativaSnap = await db.collection('legislacao_legislacao').get();
    const legislacaoConstitucionalSnap = await db.collection('legislacao_constitucional').get();
    const legislacaoEleitoralSnap = await db.collection('legislacao_eleitoral').get();

    const sessoes = [];
    sessoesSnap.forEach(doc => sessoes.push({ id: doc.id, ...doc.data() }));
    const atas = [];
    atasSnap.forEach(doc => atas.push({ id: doc.id, ...doc.data() }));
    const presencas = [];
    presencasSnap.forEach(doc => presencas.push({ id: doc.id, ...doc.data() }));
    const parlamentares = [];
    parlamentaresSnap.forEach(doc => parlamentares.push({ id: doc.id, ...doc.data() }));
    const materias = [];
    materiasSnap.forEach(doc => materias.push({ id: doc.id, ...doc.data() }));

    const legislacaoLegislativa = [];
    legislacaoLegislativaSnap.forEach(doc => legislacaoLegislativa.push({ id: doc.id, ...doc.data() }));
    const legislacaoConstitucional = [];
    legislacaoConstitucionalSnap.forEach(doc => legislacaoConstitucional.push({ id: doc.id, ...doc.data() }));
    const legislacaoEleitoral = [];
    legislacaoEleitoralSnap.forEach(doc => legislacaoEleitoral.push({ id: doc.id, ...doc.data() }));

    // 2. Busca na web (Google Custom Search API)
    let resultadosWeb = '';
    try {
      const googleApiKey = process.env.GOOGLE_API_KEY;
      const googleCx = process.env.GOOGLE_CX;
      const resp = await axios.get('https://www.googleapis.com/customsearch/v1', {
        params: {
          key: googleApiKey,
          cx: googleCx,
          q: pergunta,
          num: 3
        }
      });
      if (resp.data.items) {
        resultadosWeb = resp.data.items.map((item, i) =>
          `${i + 1}. ${item.title}: ${item.snippet} (${item.link})`
        ).join('\n');
      }
    } catch (err) {
      resultadosWeb = 'Nenhum resultado relevante da web encontrado ou erro na busca.';
    }

    // Resumidores
    function resumoSessoes(arr, limit = 10) {
      return arr.slice(0, limit).map((sessao, i) => {
        const ordemDoDia = (sessao.ordemDoDia || []).map((item, idx) =>
          `${idx + 1}. ${item.titulo || item.nome || 'Item'} - Status: ${item.status || 'N/A'}`
        ).join('; ');
        return `Sessão ${i + 1}:
Número: ${sessao.numero || '-'}
Data Início: ${sessao.dataInicio || 'N/A'}
Data Fim: ${sessao.dataFim || 'N/A'}
Status: ${sessao.status || 'N/A'}
Ordem do Dia: ${ordemDoDia || 'Sem ordem do dia'}
`;
      }).join('\n');
    }
    function resumo(arr, nome, limit = 10) {
      return arr.slice(0, limit).map((item, i) =>
        `${nome} ${i + 1}: ${JSON.stringify(item)}`
      ).join('\n');
    }
    function resumoLegislacao(arr, nome, limit = 5) {
      return arr.slice(0, limit).map((item, i) =>
        `${nome} ${i + 1}: ${item.titulo || 'Sem título'}\n${item.texto ? item.texto.slice(0, 1200) : ''}\n`
      ).join('\n');
    }

    // 3. Monta contexto IA
    const contexto = `
Sessoes (mais recentes):
${resumoSessoes(sessoes, 10)}

Atas:
${resumo(atas, 'Ata', 5)}

Presenças:
${resumo(presencas, 'Presenca', 10)}

Parlamentares:
${resumo(parlamentares, 'Parlamentar', 10)}

Matérias:
${resumo(materias, 'Materia', 10)}

Leis Municipais:
${resumoLegislacao(legislacaoLegislativa, 'Lei Municipal', 5)}

Direito Constitucional:
${resumoLegislacao(legislacaoConstitucional, 'Texto Constitucional', 3)}

Direito Eleitoral:
${resumoLegislacao(legislacaoEleitoral, 'Texto Eleitoral', 3)}

Fontes da Web:
${resultadosWeb}
`;

    // 4. Prompt IA
    const prompt = `
Você é um assistente inteligente especializado em legislação municipal, sessões plenárias, regimento, constituição, direito eleitoral e todos os dados da Câmara.  
Responda à pergunta do usuário de forma clara, objetiva e completa, sempre priorizando os dados oficiais do banco acima.  
Pode citar as fontes da web se achar relevante, mas priorize a legislação local.

Contexto do sistema e da legislação:
${contexto}

Pergunta do usuário:
${pergunta}
`;

    // 5. Chama a OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'Você é um assistente legislativo e jurídico experiente. Use apenas fontes oficiais e, se necessário, complemente com fontes da web.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 1400,
      temperature: 0.1,
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
