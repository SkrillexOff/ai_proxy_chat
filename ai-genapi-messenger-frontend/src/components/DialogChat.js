import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Typography, TextField, Button, List, ListItem, CircularProgress, IconButton, MenuItem, Slider, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper } from '@mui/material';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { materialLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SettingsIcon from '@mui/icons-material/Settings';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import { doc, onSnapshot, collection, addDoc, updateDoc, serverTimestamp, query, orderBy, getDocs, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { getStorage } from 'firebase/storage';
import DeleteIcon from '@mui/icons-material/Delete';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import remarkGfm from 'remark-gfm';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
const IMGBB_API_KEY = '35d5072c96908b371af5cbf57a36b24e';

const MODELS = [
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
  { value: 'gpt-4.1', label: 'GPT-4.1' },
  { value: 'gpt-4.1-mini', label: 'GPT-4.1 Mini' },
  { value: 'gpt-4.1-nano', label: 'GPT-4.1 Nano' },
  { value: 'gpt-image-1', label: 'GPT-Image 1' }
];

const TEXT_MODELS = [
  'gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano'
];
const IMAGE_MODELS = [
  'gpt-image-1'
];
const VISION_MODELS = [
  'gpt-4o', 'gpt-4o-mini'
];
const SIZES = [
  '1024x1024', '1536x1024', '1024x1536', 'auto'
];
const QUALITIES = ['auto', 'low', 'medium', 'high'];
const FORMATS = ['png', 'jpeg', 'webp'];
const BACKGROUNDS = ['auto', 'transparent', 'opaque'];

export default function DialogChat({ user }) {
  const { id } = useParams();
  const [dialog, setDialog] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const navigate = useNavigate();
  const [firstLoad, setFirstLoad] = useState(true);
  const [scrollOnSend, setScrollOnSend] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editModel, setEditModel] = useState('');
  const [editTemp, setEditTemp] = useState(0.7);
  const [editSize, setEditSize] = useState('1024x1024');
  const [editQuality, setEditQuality] = useState('auto');
  const [editOutputFormat, setEditOutputFormat] = useState('png');
  const [editBackground, setEditBackground] = useState('auto');
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState('');
  // Сохраняем scrollTop при скролле
  const listRef = useRef(null);
  const [restoredScroll, setRestoredScroll] = useState(false);
  const [showTyping, setShowTyping] = useState(false);
  const storage = getStorage();
  // Защита от повторных запросов
  const [sending, setSending] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState([]); // [{file, url, width, height, uploading, error}]
  const [attachedError, setAttachedError] = useState('');

  // Загрузка диалога
  useEffect(() => {
    if (!user || !id) return;
    const unsub = onSnapshot(doc(db, 'users', user.uid, 'dialogs', id), (snap) => {
      setDialog(snap.exists() ? { id: snap.id, ...snap.data() } : null);
    });
    return () => unsub();
  }, [user, id]);

  // Загрузка сообщений
  useEffect(() => {
    if (!user || !id) return;
    const q = query(collection(db, 'users', user.uid, 'dialogs', id, 'messages'), orderBy('createdAt'));
    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, [user, id]);

  useEffect(() => {
    if (dialog && firstLoad) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
      setFirstLoad(false);
    }
  }, [dialog]);

  // Восстанавливаем scrollTop только при первом входе
  useEffect(() => {
    if (!dialog || restoredScroll) return;
    const list = listRef.current;
    if (!list) return;
    const saved = localStorage.getItem(`chat-scroll-${id}`);
    if (saved) {
      list.scrollTop = parseInt(saved, 10);
    } else {
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
    }
    setRestoredScroll(true);
  }, [id, dialog, restoredScroll]);

  // Автоскролл только при отправке сообщения
  useEffect(() => {
    if (scrollOnSend && restoredScroll) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      setScrollOnSend(false);
    }
  }, [scrollOnSend, restoredScroll, dialog]);

  useEffect(() => {
    if (dialog) {
      setEditTitle(dialog.title);
      setEditModel(dialog.model);
      setEditTemp(dialog.settings?.temperature ?? 0.7);
      setEditSize(dialog.settings?.size ?? '1024x1024');
      setEditQuality(dialog.settings?.quality ?? 'auto');
      setEditOutputFormat(dialog.settings?.output_format === 'auto' ? 'png' : (dialog.settings?.output_format ?? 'png'));
      setEditBackground(dialog.settings?.background ?? 'auto');
    }
  }, [dialog, settingsOpen]);

  // Сохраняем scrollTop при скролле
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const handleScroll = () => {
      localStorage.setItem(`chat-scroll-${id}`, list.scrollTop);
    };
    list.addEventListener('scroll', handleScroll);
    return () => list.removeEventListener('scroll', handleScroll);
  }, [id]);

  // Показываем 'Пишет...' если последнее сообщение от пользователя и нет нового ассистента
  useEffect(() => {
    if (!loading && isTyping) setIsTyping(false);
    // Если последнее сообщение от пользователя и нет ассистента после него — показываем 'Пишет...'
    if (messages.length > 0) {
      const last = messages[messages.length - 1];
      const prev = messages[messages.length - 2];
      if (last.role === 'user' && loading) {
        setShowTyping(true);
      } else if (last.role === 'assistant' && loading) {
        setShowTyping(false);
      } else if (last.role === 'assistant') {
        setShowTyping(false);
      }
    } else {
      setShowTyping(false);
    }
  }, [messages, loading]);

  // Проверка и загрузка файлов на imgbb
  const handleAttachFiles = async (e) => {
    setAttachedError('');
    let files = Array.from(e.target.files || []);
    if (files.length + attachedFiles.length > 4) {
      setAttachedError('Можно прикрепить не более 4 изображений.');
      return;
    }
    // Проверяем типы и размеры
    for (let file of files) {
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
        setAttachedError('Разрешены только PNG, JPEG, WebP.');
        return;
      }
      if (file.size > 25 * 1024 * 1024) {
        setAttachedError('Размер каждого изображения не должен превышать 25MB.');
        return;
      }
    }
    // Получаем размеры всех изображений
    let newFiles = [];
    for (let file of files) {
      let url = URL.createObjectURL(file);
      let img = new window.Image();
      await new Promise((resolve) => {
        img.onload = resolve;
        img.onerror = resolve;
        img.src = url;
      });
      newFiles.push({ file, url, width: img.width, height: img.height, uploading: true, error: '' });
    }
    // Определяем эталонный размер (размер первого выбранного изображения)
    let allFiles = [...attachedFiles, ...newFiles];
    const targetWidth = allFiles[0].width;
    const targetHeight = allFiles[0].height;
    // Функция crop по центру
    async function cropToSize(file, srcUrl, srcW, srcH, targetW, targetH) {
      return new Promise((resolve) => {
        const img = new window.Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = targetW;
          canvas.height = targetH;
          const ctx = canvas.getContext('2d');
          // Вычисляем crop
          let sx = 0, sy = 0, sw = srcW, sh = srcH;
          const srcRatio = srcW / srcH;
          const targetRatio = targetW / targetH;
          if (srcRatio > targetRatio) {
            // Обрезаем по ширине
            sw = targetRatio * srcH;
            sx = (srcW - sw) / 2;
          } else if (srcRatio < targetRatio) {
            // Обрезаем по высоте
            sh = srcW / targetRatio;
            sy = (srcH - sh) / 2;
          }
          ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetW, targetH);
          canvas.toBlob(blob => {
            const reader = new FileReader();
            reader.onloadend = () => {
              resolve({
                base64: reader.result.split(',')[1],
                previewUrl: canvas.toDataURL(),
              });
            };
            reader.readAsDataURL(blob);
          }, file.type);
        };
        img.src = srcUrl;
      });
    }
    // Приводим все новые изображения к нужному размеру (если требуется)
    for (let i = 0; i < newFiles.length; i++) {
      const f = newFiles[i];
      if (f.width !== targetWidth || f.height !== targetHeight) {
        const { base64, previewUrl } = await cropToSize(f.file, f.url, f.width, f.height, targetWidth, targetHeight);
        newFiles[i].croppedBase64 = base64;
        newFiles[i].url = previewUrl;
        newFiles[i].width = targetWidth;
        newFiles[i].height = targetHeight;
      } else {
        // Получаем base64 для загрузки
        const reader = new FileReader();
        await new Promise((resolve, reject) => {
          reader.onloadend = () => {
            newFiles[i].croppedBase64 = reader.result.split(',')[1];
            resolve();
          };
          reader.onerror = reject;
          reader.readAsDataURL(f.file);
        });
      }
    }
    // Загружаем на imgbb
    for (let i = 0; i < newFiles.length; i++) {
      const base64 = newFiles[i].croppedBase64;
      const formData = new FormData();
      formData.append('image', base64);
      try {
        const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
          method: 'POST',
          body: formData,
        });
        const data = await res.json();
        if (data.success) {
          newFiles[i].imgbbUrl = data.data.url;
          newFiles[i].uploading = false;
        } else {
          newFiles[i].error = 'Ошибка загрузки на imgbb';
          newFiles[i].uploading = false;
        }
      } catch {
        newFiles[i].error = 'Ошибка загрузки на imgbb';
        newFiles[i].uploading = false;
      }
    }
    setAttachedFiles([...attachedFiles, ...newFiles]);
  };

  // Удаление прикреплённого файла
  const handleRemoveAttached = (idx) => {
    setAttachedFiles(files => files.filter((_, i) => i !== idx));
  };

  // Отправка сообщения пользователя и получение ответа
  const sendMessage = async () => {
    if ((!input.trim() && attachedFiles.length === 0) || sending) return;
    setSending(true);
    setLoading(true);
    setIsTyping(true);
    // Добавляем сообщение пользователя
    const messageData = {
      role: 'user',
      content: input,
      createdAt: serverTimestamp(),
    };
    if (attachedFiles.length > 0) {
      messageData.images = attachedFiles.map(f => f.imgbbUrl).filter(Boolean);
    }
    await addDoc(collection(db, 'users', user.uid, 'dialogs', id, 'messages'), messageData);
    setInput('');
    setAttachedFiles([]);
    setScrollOnSend(true);
    // Обновляем updatedAt у диалога
    await updateDoc(doc(db, 'users', user.uid, 'dialogs', id), { updatedAt: serverTimestamp() });
    try {
      // Формируем сообщения для vision только для поддерживаемых моделей
      let msgs;
      if (VISION_MODELS.includes(dialog.model)) {
        const contentArr = [];
        if (input.trim()) {
          contentArr.push({ type: 'text', text: input });
        }
        if (attachedFiles.length > 0) {
          for (const f of attachedFiles) {
            contentArr.push({ type: 'image_url', image_url: { url: f.imgbbUrl } });
          }
        }
        msgs = [
          ...messages.map(m => {
            const content = [];
            if (m.content) content.push({ type: 'text', text: m.content });
            if (m.images && Array.isArray(m.images) && m.images.length > 0) {
              for (const url of m.images) {
                content.push({ type: 'image_url', image_url: { url } });
              }
            }
            return { role: m.role, content };
          }),
          { role: 'user', content: contentArr }
        ];
      } else {
        // Для остальных моделей — только текст
        msgs = [
          ...messages.map(m => {
            const msg = { role: m.role, content: m.content };
            if (m.images && Array.isArray(m.images) && m.images.length > 0) {
              msg.images = m.images;
            }
            return msg;
          }),
        ];
        const newMsg = { role: 'user', content: input };
        msgs.push(newMsg);
      }
      const res = await axios.post(`${API_URL}/dialogs/${id}/messages`, {
        content: input,
        messages: msgs,
        model: dialog.model,
        settings: dialog.settings,
        images: attachedFiles.length > 0 ? attachedFiles.map(f => f.imgbbUrl).filter(Boolean) : [],
      });
      // Добавляем сообщение ассистента
      if (res.data.image) {
        let imageUrl = '';
        if (res.data.image.b64_json) {
          // gpt-image-1: загружаем base64 на imgbb
          const base64 = res.data.image.b64_json;
          const formData = new FormData();
          formData.append('image', base64);
          let imgbbRes;
          try {
            imgbbRes = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
              method: 'POST',
              body: formData,
            });
            const imgbbData = await imgbbRes.json();
            imageUrl = imgbbData.data?.url || '';
          } catch (e) {
            imageUrl = '';
          }
        } else if (res.data.image.url) {
          // DALL·E: скачиваем по url через backend, конвертируем в base64 и загружаем на imgbb
          try {
            // Получаем base64 через backend (обход CORS)
            const base64Res = await fetch('/api/fetch-image-base64', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ url: res.data.image.url })
            });
            const base64Data = await base64Res.json();
            const base64 = base64Data.base64;
            const formData = new FormData();
            formData.append('image', base64);
            let imgbbRes = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
              method: 'POST',
              body: formData,
            });
            const imgbbData = await imgbbRes.json();
            imageUrl = imgbbData.data?.url || res.data.image.url;
          } catch (e) {
            imageUrl = res.data.image.url;
          }
        }
        await addDoc(collection(db, 'users', user.uid, 'dialogs', id, 'messages'), {
          role: 'assistant',
          content: '',
          image: imageUrl,
          createdAt: serverTimestamp(),
        });
      } else {
        await addDoc(collection(db, 'users', user.uid, 'dialogs', id, 'messages'), {
          role: 'assistant',
          content: res.data.content,
          createdAt: serverTimestamp(),
        });
      }
      await updateDoc(doc(db, 'users', user.uid, 'dialogs', id), { updatedAt: serverTimestamp() });
    } finally {
      setLoading(false);
      setIsTyping(false);
      setSending(false);
    }
  };

  // Удаление диалога
  const handleDeleteDialog = async () => {
    setDeleteLoading(true);
    // Удаляем все сообщения
    const msgsSnap = await getDocs(collection(db, 'users', user.uid, 'dialogs', dialog.id, 'messages'));
    await Promise.all(msgsSnap.docs.map(d => deleteDoc(d.ref)));
    // Удаляем сам диалог
    await deleteDoc(doc(db, 'users', user.uid, 'dialogs', dialog.id));
    setDeleteLoading(false);
    setSettingsOpen(false);
    navigate('/');
  };

  if (!dialog) return <Typography>Диалог не найден или удалён.</Typography>;

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, p: 2, pb: 0 }}>
        <IconButton onClick={() => navigate('/')} sx={{ mr: 1 }}>
          <ArrowBackIcon />
        </IconButton>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h5" gutterBottom sx={{ mb: 0 }}>{dialog.title}</Typography>
          <Typography variant="body2" color="text.secondary">Модель: {dialog.model}</Typography>
        </Box>
        <IconButton onClick={() => setSettingsOpen(true)}>
          <SettingsIcon />
        </IconButton>
      </Box>
      {/* Модалка настроек */}
      <Dialog open={settingsOpen} onClose={() => setSettingsOpen(false)}>
        <DialogTitle>Настройки диалога</DialogTitle>
        <DialogContent sx={{ minWidth: 320 }}>
          <TextField
            label="Название диалога"
            value={editTitle}
            onChange={e => setEditTitle(e.target.value)}
            fullWidth
            sx={{ mb: 2 }}
          />
          <TextField
            select
            label="Модель"
            value={editModel}
            onChange={e => setEditModel(e.target.value)}
            fullWidth
            sx={{ mb: 2 }}
          >
            {(TEXT_MODELS.includes(dialog.model) ? TEXT_MODELS : IMAGE_MODELS).map(opt => (
              <MenuItem key={opt} value={opt}>{MODELS.find(m => m.value === opt)?.label || opt}</MenuItem>
            ))}
          </TextField>
          {TEXT_MODELS.includes(editModel) && (
            <>
              <Typography gutterBottom>Temperature: {editTemp}</Typography>
              <Slider
                value={editTemp}
                min={0}
                max={1}
                step={0.01}
                onChange={(_, v) => setEditTemp(v)}
                sx={{ mb: 2 }}
              />
            </>
          )}
          {IMAGE_MODELS.includes(editModel) && (
            <>
              <TextField
                select
                label="Размер (size)"
                value={editSize}
                onChange={e => setEditSize(e.target.value)}
                fullWidth
                sx={{ mb: 2 }}
              >
                {SIZES.map(opt => (
                  <MenuItem key={opt} value={opt}>{opt}</MenuItem>
                ))}
              </TextField>
              {editModel === 'gpt-image-1' && (
                <TextField
                  select
                  label="Качество (quality)"
                  value={editQuality}
                  onChange={e => setEditQuality(e.target.value)}
                  fullWidth
                  sx={{ mb: 2 }}
                >
                  {QUALITIES.map(opt => (
                    <MenuItem key={opt} value={opt}>{opt}</MenuItem>
                  ))}
                </TextField>
              )}
              {editModel === 'gpt-image-1' && (
                <TextField
                  select
                  label="Формат (output_format)"
                  value={editOutputFormat}
                  onChange={e => setEditOutputFormat(e.target.value)}
                  fullWidth
                  sx={{ mb: 2 }}
                >
                  {FORMATS.map(opt => (
                    <MenuItem key={opt} value={opt}>{opt}</MenuItem>
                  ))}
                </TextField>
              )}
              {editModel === 'gpt-image-1' && (
                <TextField
                  select
                  label="Фон (background)"
                  value={editBackground}
                  onChange={e => setEditBackground(e.target.value)}
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
          {settingsError && <Typography color="error" sx={{ mt: 1 }}>{settingsError}</Typography>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSettingsOpen(false)}>Закрыть</Button>
          <Button color="error" variant="contained" startIcon={<DeleteIcon />} onClick={handleDeleteDialog} disabled={deleteLoading}>
            {deleteLoading ? 'Удаление...' : 'Удалить'}
          </Button>
          <Button variant="contained" disabled={savingSettings} onClick={async () => {
            setSavingSettings(true);
            setSettingsError('');
            try {
              let settings = {};
              if (TEXT_MODELS.includes(editModel)) {
                settings = { temperature: editTemp };
              } else if (editModel === 'gpt-image-1') {
                settings = { size: editSize, quality: editQuality, output_format: editOutputFormat, background: editBackground };
              }
              await updateDoc(doc(db, 'users', user.uid, 'dialogs', dialog.id), {
                title: editTitle,
                model: editModel,
                settings,
                updatedAt: serverTimestamp(),
              });
              setDialog(prev => ({ ...prev, title: editTitle, model: editModel, settings }));
              setSettingsOpen(false);
            } catch (e) {
              setSettingsError('Ошибка сохранения: ' + (e.message || e));
            }
            setSavingSettings(false);
          }}>Сохранить</Button>
        </DialogActions>
      </Dialog>
      <List ref={listRef} sx={{ flex: 1, minHeight: 0, maxHeight: '100%', overflow: 'auto', bgcolor: '#f5f5f5', mb: 2, px: 2, py: 0 }}>
        {messages.map((msg, idx) => (
          <ListItem
            key={msg.id || idx}
            disableGutters
            sx={{
              display: 'flex',
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              mb: 1
            }}
          >
            <Box
              sx={{
                maxWidth: '75%',
                bgcolor: msg.role === 'user' ? '#1976d2' : '#e3f2fd',
                color: msg.role === 'user' ? '#fff' : 'inherit',
                borderRadius: 3,
                borderTopRightRadius: msg.role === 'user' ? 0 : 24,
                borderTopLeftRadius: msg.role === 'user' ? 24 : 0,
                p: 1.5,
                boxShadow: 1,
                wordBreak: 'break-word',
              }}
            >
              {/* Показываем прикреплённые изображения пользователя */}
              {msg.role === 'user' && msg.images && Array.isArray(msg.images) && msg.images.length > 0 && (
                <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                  {msg.images.map((img, i) => (
                    <img key={i} src={img} alt="ref" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 6, border: '1px solid #ccc' }} />
                  ))}
                </Box>
              )}
              {msg.role === 'assistant' && msg.image ? (
                <Box sx={{ textAlign: 'center' }}>
                  <img src={msg.image} alt="AI generated" style={{ maxWidth: 320, borderRadius: 8 }} />
                </Box>
              ) : msg.role === 'assistant' && msg.content === 'Пишет...' ? (
                <TypingDots />
              ) : msg.role === 'assistant' ? (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    code({ node, inline, className, children, ...props }) {
                      const match = /language-(\w+)/.exec(className || '');
                      const codeString = String(children).replace(/\n$/, '');
                      if (inline) {
                        return <code className={className} {...props}>{children}</code>;
                      }
                      return (
                        <Box sx={{ position: 'relative', mb: 1 }}>
                          <SyntaxHighlighter
                            style={materialLight}
                            language={match ? match[1] : 'plaintext'}
                            PreTag="div"
                            customStyle={{ borderRadius: 8, fontSize: 14, margin: 0 }}
                          >
                            {codeString}
                          </SyntaxHighlighter>
                          <IconButton
                            size="small"
                            sx={{ position: 'absolute', top: 8, right: 8, zIndex: 1, bgcolor: '#fff8', backdropFilter: 'blur(2px)' }}
                            onClick={() => navigator.clipboard.writeText(codeString)}
                          >
                            <ContentCopyIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      );
                    },
                    table({ children }) {
                      return (
                        <TableContainer component={Paper} sx={{ my: 2 }}>
                          <Table size="small">{children}</Table>
                        </TableContainer>
                      );
                    },
                    thead({ children }) {
                      return <TableHead>{children}</TableHead>;
                    },
                    tbody({ children }) {
                      return <TableBody>{children}</TableBody>;
                    },
                    tr({ children }) {
                      return <TableRow>{children}</TableRow>;
                    },
                    th({ children }) {
                      return <TableCell component="th" sx={{ fontWeight: 'bold', bgcolor: '#f5f5f5' }}>{children}</TableCell>;
                    },
                    td({ children }) {
                      return <TableCell>{children}</TableCell>;
                    },
                  }}
                >
                  {msg.content}
                </ReactMarkdown>
              ) : (
                <Typography variant="body1">{msg.content}</Typography>
              )}
            </Box>
          </ListItem>
        ))}
        {showTyping && (
          <ListItem
            key="typing"
            disableGutters
            sx={{ display: 'flex', justifyContent: 'flex-start', mb: 1 }}
          >
            <Box
              sx={{
                maxWidth: '75%',
                bgcolor: '#e3f2fd',
                color: 'inherit',
                borderRadius: 3,
                borderTopRightRadius: 24,
                p: 1.5,
                boxShadow: 1,
                wordBreak: 'break-word',
              }}
            >
              <TypingDots />
            </Box>
          </ListItem>
        )}
        <div ref={messagesEndRef} />
      </List>
      <Box sx={{ display: 'flex', gap: 1, p: 2, pt: 0, bgcolor: '#fff', alignItems: 'flex-end' }}>
        {/* Иконка прикрепления теперь только для vision-моделей */}
        {VISION_MODELS.includes(dialog.model) && (
          <>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              style={{ display: 'none' }}
              id="attach-input"
              onChange={handleAttachFiles}
            />
            <label htmlFor="attach-input">
              <IconButton component="span" sx={{ mb: 0.5 }}>
                <AttachFileIcon />
              </IconButton>
            </label>
          </>
        )}
        <TextField
          value={input}
          onChange={e => setInput(e.target.value)}
          fullWidth
          label="Ваш запрос"
          disabled={loading}
          onKeyDown={e => { if (e.key === 'Enter') sendMessage(); }}
        />
        <Button variant="contained" onClick={sendMessage} disabled={loading || (!input.trim() && attachedFiles.length === 0)}>
          Отправить
        </Button>
      </Box>
      {/* Предпросмотр выбранных файлов теперь только для vision-моделей */}
      {VISION_MODELS.includes(dialog.model) && attachedFiles.length > 0 && (
        <Box sx={{ display: 'flex', gap: 1, px: 2, pb: 1, alignItems: 'center' }}>
          {attachedFiles.map((f, i) => (
            <Box key={i} sx={{ position: 'relative' }}>
              <img src={f.url} alt="preview" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 6, border: '1px solid #ccc', opacity: f.uploading ? 0.5 : 1 }} />
              <IconButton size="small" sx={{ position: 'absolute', top: -8, right: -8, bgcolor: '#fff', p: 0.5 }} onClick={() => handleRemoveAttached(i)} disabled={f.uploading}>
                <DeleteIcon fontSize="small" />
              </IconButton>
              {f.uploading && <CircularProgress size={24} sx={{ position: 'absolute', top: 12, left: 12 }} />}
            </Box>
          ))}
        </Box>
      )}
      {attachedError && <Typography color="error" sx={{ px: 2, pb: 1 }}>{attachedError}</Typography>}
    </Box>
  );
}

function TypingDots() {
  const [dots, setDots] = useState('');
  useEffect(() => {
    const interval = setInterval(() => {
      setDots(d => (d.length < 3 ? d + '.' : ''));
    }, 400);
    return () => clearInterval(interval);
  }, []);
  return <Typography variant="body2" sx={{ fontStyle: 'italic', color: '#888' }}>Пишет{dots}</Typography>;
} 