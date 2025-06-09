require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const fetch = require('node-fetch');
const FormData = require('form-data');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// In-memory storage for MVP
const dialogs = [];

const VISION_MODELS = ['gpt-4o', 'gpt-4o-mini'];

app.get('/', (req, res) => {
  res.json({ message: 'AI GenAPI Messenger backend is running!' });
});

// Get all dialogs
app.get('/api/dialogs', (req, res) => {
  res.json(dialogs.map(({ messages, ...rest }) => rest));
});

// Get dialog by id
app.get('/api/dialogs/:id', (req, res) => {
  const dialog = dialogs.find(d => d.id === req.params.id);
  if (!dialog) return res.status(404).json({ error: 'Dialog not found' });
  res.json(dialog);
});

// Create new dialog
app.post('/api/dialogs', (req, res) => {
  const { title, model, settings } = req.body;
  const dialog = {
    id: uuidv4(),
    title: title || `Диалог с ${model}`,
    model,
    settings: settings || {},
    messages: []
  };
  dialogs.push(dialog);
  res.status(201).json(dialog);
});

// Send message and get AI response
app.post('/api/dialogs/:id/messages', async (req, res) => {
  const { model, settings, messages, images } = req.body;
  if (!model || !messages) return res.status(400).json({ error: 'model and messages are required' });
  try {
    if (["gpt-image-1"].includes(model)) {
      const prompt = messages[messages.length - 1]?.content || '';
      // Если есть референсы
      if (images && Array.isArray(images) && images.length > 0) {
        try {
          // 1. Скачиваем изображения
          const imageBuffers = await Promise.all(images.map(async (url) => {
            const resp = await fetch(url);
            if (!resp.ok) throw new Error('Failed to fetch image');
            return await resp.buffer();
          }));
          // 2. Собираем form-data
          const form = new FormData();
          form.append('model', 'gpt-image-1');
          form.append('prompt', prompt);
          if (settings) {
            Object.entries(settings).forEach(([k, v]) => form.append(k, v));
          }
          imageBuffers.forEach((buf, i) => {
            form.append('image[]', buf, { filename: `ref${i}.png` });
          });
          // 3. Отправляем на ProxyAPI (edits)
          const proxyRes = await axios.post(
            'https://api.proxyapi.ru/openai/v1/images/edits',
            form,
            {
              headers: {
                ...form.getHeaders(),
                'Authorization': `Bearer ${process.env.PROXYAPI_KEY}`,
              },
              maxBodyLength: Infinity,
            }
          );
          // Логируем ответ ProxyAPI
          console.log('ProxyAPI edit response:', proxyRes.data);
          const b64 = proxyRes.data.data[0]?.b64_json;
          console.log('b64_json:', b64 ? b64.slice(0, 100) + '...' : 'EMPTY');
          // 4. Загружаем результат на imgbb
          const imgbbRes = await fetch(`https://api.imgbb.com/1/upload?key=${process.env.IMGBB_API_KEY}` || '35d5072c96908b371af5cbf57a36b24e', {
            method: 'POST',
            body: (() => { const fd = new FormData(); fd.append('image', b64); return fd; })(),
          });
          const imgbbData = await imgbbRes.json();
          console.log('imgbb upload response:', imgbbData);
          const imageUrl = imgbbData.data?.url || '';
          res.json({ image: { url: imageUrl } });
        } catch (error) {
          console.error('ProxyAPI image edit error:', error?.response?.data || error.message);
          res.status(500).json({ error: 'AI image edit failed', details: error?.response?.data || error.message });
        }
      } else {
        // Старое поведение: генерация по prompt
        let payload = { model, prompt, ...settings };
        console.log('ProxyAPI image payload:', payload);
        try {
          const response = await axios.post(
            'https://api.proxyapi.ru/openai/v1/images/generations',
            payload,
            {
              headers: {
                'Authorization': `Bearer ${process.env.PROXYAPI_KEY}`,
                'Content-Type': 'application/json'
              }
            }
          );
          res.json({ image: response.data.data[0] });
        } catch (error) {
          console.error('ProxyAPI image generation error:', error?.response?.data || error.message);
          res.status(500).json({ error: 'AI request failed', details: error?.response?.data || error.message });
        }
      }
    } else if (VISION_MODELS.includes(model)) {
      // Vision-запрос для gpt-4o, gpt-4o-mini
      try {
        console.log('ProxyAPI VISION payload:', JSON.stringify({ model, messages, ...settings }, null, 2));
        const response = await axios.post(
          'https://api.proxyapi.ru/openai/v1/chat/completions',
          { model, messages, ...settings },
          {
            headers: {
              'Authorization': `Bearer ${process.env.PROXYAPI_KEY}`,
              'Content-Type': 'application/json'
            }
          }
        );
        const aiMessage = response.data.choices?.[0]?.message?.content || '';
        res.json({ role: 'assistant', content: aiMessage });
      } catch (error) {
        console.error('ProxyAPI vision error:', error?.response?.data || error.message);
        res.status(500).json({ error: 'AI vision request failed', details: error?.response?.data || error.message });
      }
    } else {
      // Обычный текстовый запрос
      try {
        const response = await axios.post(
          'https://api.proxyapi.ru/openai/v1/chat/completions',
          { model, messages, ...settings },
          {
            headers: {
              'Authorization': `Bearer ${process.env.PROXYAPI_KEY}`,
              'Content-Type': 'application/json'
            }
          }
        );
        const aiMessage = response.data.choices?.[0]?.message?.content || '';
        res.json({ role: 'assistant', content: aiMessage });
      } catch (error) {
        console.error('ProxyAPI text error:', error?.response?.data || error.message);
        res.status(500).json({ error: 'AI request failed', details: error?.response?.data || error.message });
      }
    }
  } catch (error) {
    res.status(500).json({ error: 'AI request failed', details: error?.response?.data || error.message });
  }
});

// PATCH update dialog model/settings
app.patch('/api/dialogs/:id', (req, res) => {
  const dialog = dialogs.find(d => d.id === req.params.id);
  if (!dialog) return res.status(404).json({ error: 'Dialog not found' });
  if (req.body.title) dialog.title = req.body.title;
  if (req.body.model) dialog.model = req.body.model;
  if (req.body.settings) dialog.settings = req.body.settings;
  res.json(dialog);
});

// Проксирование генерации изображений
app.post('/api/image-generation', async (req, res) => {
  const { model, prompt } = req.body;
  if (!model || !prompt) return res.status(400).json({ error: 'model and prompt are required' });
  try {
    const response = await axios.post(
      'https://api.proxyapi.ru/openai/v1/images/generations',
      { model, prompt },
      {
        headers: {
          'Authorization': `Bearer ${process.env.PROXYAPI_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: 'Image generation failed', details: error?.response?.data || error.message });
  }
});

// Проксирование скачивания изображения по url и возврат base64
app.post('/api/fetch-image-base64', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'url is required' });
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch image');
    const buffer = await response.buffer();
    const base64 = buffer.toString('base64');
    res.json({ base64 });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch image', details: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
}); 