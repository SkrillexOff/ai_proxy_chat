import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, MenuItem, TextField, Typography, Slider } from '@mui/material';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

const TEXT_MODELS = [
  'gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano'
];
const IMAGE_MODELS = [
  'gpt-image-1'
];
const MODELS = [
  { value: 'gpt-4o', label: 'GPT-4o (текст)' },
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini (текст)' },
  { value: 'gpt-4.1', label: 'GPT-4.1 (текст)' },
  { value: 'gpt-4.1-mini', label: 'GPT-4.1 Mini (текст)' },
  { value: 'gpt-4.1-nano', label: 'GPT-4.1 Nano (текст)' },
  { value: 'gpt-image-1', label: 'GPT-Image 1 (изображения)' }
];
const SIZES = [
  '1024x1024', '1536x1024', '1024x1536', 'auto'
];
const QUALITIES = ['auto', 'low', 'medium', 'high'];
const FORMATS = ['png', 'jpeg', 'webp'];
const BACKGROUNDS = ['auto', 'transparent', 'opaque'];
const DALL_E3_QUALITIES = ['standard', 'hd'];

export default function DialogCreate({ user }) {
  const [title, setTitle] = useState('');
  const [model, setModel] = useState(MODELS[0].value);
  const [temperature, setTemperature] = useState(0.7);
  const [size, setSize] = useState('1024x1024');
  const [quality, setQuality] = useState('auto');
  const [outputFormat, setOutputFormat] = useState('png');
  const [background, setBackground] = useState('auto');
  const navigate = useNavigate();

  const handleCreate = async () => {
    let settings = {};
    if (TEXT_MODELS.includes(model)) {
      settings = { temperature };
    } else if (model === 'gpt-image-1') {
      settings = { size, quality, output_format: outputFormat, background };
    }
    const dialogTitle = title.trim() ? title : 'Новый чат';
    const docRef = await addDoc(
      collection(db, 'users', user.uid, 'dialogs'),
      {
        title: dialogTitle,
        model,
        settings,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }
    );
    navigate(`/dialogs/${docRef.id}`);
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom>Создать новый диалог</Typography>
      <TextField
        label="Название диалога"
        value={title}
        onChange={e => setTitle(e.target.value)}
        fullWidth
        sx={{ mb: 2 }}
      />
      <TextField
        select
        label="Модель"
        value={model}
        onChange={e => setModel(e.target.value)}
        fullWidth
        sx={{ mb: 2 }}
      >
        {MODELS.map(opt => (
          <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
        ))}
      </TextField>
      {TEXT_MODELS.includes(model) && (
        <>
          <Typography gutterBottom>Temperature: {temperature}</Typography>
          <Slider
            value={temperature}
            min={0}
            max={1}
            step={0.01}
            onChange={(_, v) => setTemperature(v)}
            sx={{ mb: 2 }}
          />
        </>
      )}
      {IMAGE_MODELS.includes(model) && (
        <>
          <TextField
            select
            label="Размер (size)"
            value={size}
            onChange={e => setSize(e.target.value)}
            fullWidth
            sx={{ mb: 2 }}
          >
            {SIZES.map(opt => (
              <MenuItem key={opt} value={opt}>{opt}</MenuItem>
            ))}
          </TextField>
          {model === 'gpt-image-1' && (
            <TextField
              select
              label="Качество (quality)"
              value={quality}
              onChange={e => setQuality(e.target.value)}
              fullWidth
              sx={{ mb: 2 }}
            >
              {QUALITIES.map(opt => (
                <MenuItem key={opt} value={opt}>{opt}</MenuItem>
              ))}
            </TextField>
          )}
          {model === 'gpt-image-1' && (
            <TextField
              select
              label="Формат (output_format)"
              value={outputFormat}
              onChange={e => setOutputFormat(e.target.value)}
              fullWidth
              sx={{ mb: 2 }}
            >
              {FORMATS.map(opt => (
                <MenuItem key={opt} value={opt}>{opt}</MenuItem>
              ))}
            </TextField>
          )}
          {model === 'gpt-image-1' && (
            <TextField
              select
              label="Фон (background)"
              value={background}
              onChange={e => setBackground(e.target.value)}
              fullWidth
              sx={{ mb: 2 }}
            >
              {BACKGROUNDS.map(opt => (
                <MenuItem key={opt} value={opt}>{opt}</MenuItem>
              ))}
            </TextField>
          )}
        </>
      )}
      <Button variant="contained" onClick={handleCreate}>Создать</Button>
    </Box>
  );
} 