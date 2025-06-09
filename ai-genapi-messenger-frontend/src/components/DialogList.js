import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  List, ListItem, ListItemText, Button, Typography, Box, CircularProgress, IconButton, Menu, MenuItem as MuiMenuItem, Dialog as MuiDialog, DialogTitle, DialogContent, DialogActions
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { collection, query, orderBy, onSnapshot, doc, getDocs, limit, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';

export default function DialogList({ user }) {
  const [dialogs, setDialogs] = useState([]);
  const [lastMessages, setLastMessages] = useState({});
  const [loading, setLoading] = useState(true);
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedDialog, setSelectedDialog] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Получаем список диалогов
  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const q = query(
      collection(db, 'users', user.uid, 'dialogs'),
      orderBy('updatedAt', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      const ds = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setDialogs(ds);
      setLoading(false);
      // Для каждого диалога получаем последнее сообщение
      ds.forEach(async (dialog) => {
        const msgsSnap = await getDocs(query(
          collection(db, 'users', user.uid, 'dialogs', dialog.id, 'messages'),
          orderBy('createdAt', 'desc'),
          limit(1)
        ));
        const msg = msgsSnap.docs[0]?.data();
        setLastMessages(prev => ({ ...prev, [dialog.id]: msg }));
      });
    });
    return () => unsub();
  }, [user, location]);

  // Открыть меню настроек
  const handleMenuOpen = (event, dialog) => {
    setAnchorEl(event.currentTarget);
    setSelectedDialog(dialog);
  };
  const handleMenuClose = () => {
    setAnchorEl(null);
  };
  // Открыть модалку настроек
  const handleSettingsOpen = () => {
    setSettingsOpen(true);
    setAnchorEl(null);
  };
  const handleSettingsClose = () => {
    setSettingsOpen(false);
    setSelectedDialog(null);
  };
  // Удаление диалога
  const handleDelete = async () => {
    if (!selectedDialog) return;
    setDeleteLoading(true);
    // Удаляем все сообщения
    const msgsSnap = await getDocs(collection(db, 'users', user.uid, 'dialogs', selectedDialog.id, 'messages'));
    await Promise.all(msgsSnap.docs.map(d => deleteDoc(d.ref)));
    // Удаляем сам диалог
    await deleteDoc(doc(db, 'users', user.uid, 'dialogs', selectedDialog.id));
    setDeleteLoading(false);
    setSettingsOpen(false);
    setSelectedDialog(null);
    navigate('/');
  };

  return (
    <Box sx={{ maxWidth: 480, mx: 'auto', mt: 2 }}>
      <Typography variant="h5" gutterBottom>Диалоги</Typography>
      <Button
        variant="contained"
        startIcon={<AddIcon />}
        sx={{ mb: 2 }}
        onClick={() => navigate('/dialogs/new')}
        fullWidth
      >
        Новый диалог
      </Button>
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Box>
      ) : (
        <List>
          {dialogs.map(dialog => {
            const msg = lastMessages[dialog.id];
            let preview = '';
            let isImage = false;
            let imageUrl = '';
            if (msg) {
              if (msg.image) {
                preview = 'Изображение';
                isImage = true;
                imageUrl = msg.image;
              } else if (msg.content) {
                preview = msg.content;
              }
            }
            return (
              <ListItem
                key={dialog.id}
                secondaryAction={
                  <IconButton edge="end" onClick={e => { e.stopPropagation(); e.preventDefault(); handleMenuOpen(e, dialog); }}>
                    <MoreVertIcon />
                  </IconButton>
                }
                button
                component={Link}
                to={`/dialogs/${dialog.id}`}
                sx={{ alignItems: 'center', pr: 7 }}
              >
                <ListItemText
                  primary={dialog.title}
                  secondary={
                    <>
                      <Typography component="span" variant="caption" color="text.secondary">
                        {dialog.model}
                      </Typography>
                      <br />
                      {isImage ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <img src={imageUrl} alt="preview" style={{ width: 24, height: 24, borderRadius: 4, objectFit: 'cover' }} />
                          <Typography component="span" variant="body2" color="text.secondary" noWrap sx={{ maxWidth: 180, display: 'inline-block', verticalAlign: 'middle' }}>
                            Изображение
                          </Typography>
                        </span>
                      ) : (
                        <Typography
                          component="span"
                          variant="body2"
                          color="text.secondary"
                          noWrap
                          sx={{ maxWidth: 220, display: 'inline-block', verticalAlign: 'middle' }}
                        >
                          {preview || 'Нет сообщений'}
                        </Typography>
                      )}
                    </>
                  }
                />
              </ListItem>
            );
          })}
        </List>
      )}
      {/* Меню троеточие */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MuiMenuItem onClick={handleSettingsOpen}>Настройки</MuiMenuItem>
      </Menu>
      {/* Модалка настроек */}
      <MuiDialog open={settingsOpen} onClose={handleSettingsClose}>
        <DialogTitle>Настройки диалога</DialogTitle>
        <DialogContent>
          <Typography>Название: {selectedDialog?.title}</Typography>
          <Typography>Модель: {selectedDialog?.model}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleSettingsClose}>Закрыть</Button>
          <Button color="error" variant="contained" onClick={handleDelete} disabled={deleteLoading}>
            {deleteLoading ? 'Удаление...' : 'Удалить'}
          </Button>
        </DialogActions>
      </MuiDialog>
    </Box>
  );
} 