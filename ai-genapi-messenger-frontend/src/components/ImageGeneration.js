import React, { useState } from 'react';
import { Box, Button, MenuItem, TextField, Typography, CircularProgress, Select, FormControl, InputLabel } from '@mui/material';
import axios from 'axios';

const MODELS = [
  { value: 'gpt-image-1', label: 'GPT-Image 1' }
];

export default function ImageGeneration() {
  const [model, setModel] = useState(MODELS[0].value);
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    setLoading(true);
    setResult(null);
    setError('');
    try {
      const res = await axios.post(
        '/api/image-generation',
        { model, prompt },
      );
      if (model === 'gpt-image-1') {
        setResult(`data:image/png;base64,${res.data.data[0].b64_json}`);
      } else {
        setResult(res.data.data[0].url);
      }
    } catch (e) {
      setError('Ошибка генерации: ' + (e.response?.data?.error || e.message));
    }
    setLoading(false);
  };

  return (
    <Box sx={{ maxWidth: 480, mx: 'auto', mt: 4 }}>
      <Typography variant="h5" gutterBottom>Генерация изображений</Typography>
      <FormControl fullWidth sx={{ mb: 2 }}>
        <InputLabel>Модель</InputLabel>
        <Select value={model} label="Модель" onChange={e => setModel(e.target.value)}>
          {MODELS.map(m => <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>)}
        </Select>
      </FormControl>
      <TextField
        label="Запрос (prompt)"
        value={prompt}
        onChange={e => setPrompt(e.target.value)}
        fullWidth
        sx={{ mb: 2 }}
      />
      <Button variant="contained" onClick={handleGenerate} disabled={loading || !prompt} fullWidth>
        Сгенерировать
      </Button>
      {loading && <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}><CircularProgress /></Box>}
      {error && <Typography color="error" sx={{ mt: 2 }}>{error}</Typography>}
      {result && (
        <Box sx={{ mt: 3, textAlign: 'center' }}>
          <img src={result} alt="result" style={{ maxWidth: 400, borderRadius: 8 }} />
        </Box>
      )}
    </Box>
  );
} 