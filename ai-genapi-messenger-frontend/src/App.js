import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import DialogList from './components/DialogList';
import DialogChat from './components/DialogChat';
import DialogCreate from './components/DialogCreate';
import ImageGeneration from './components/ImageGeneration';
import Container from '@mui/material/Container';
import AuthForm from './components/AuthForm';
import { auth } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { Button, Box } from '@mui/material';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  if (loading) return null;

  if (!user) return <AuthForm onAuth={setUser} />;

  return (
    <Router>
      <Container disableGutters maxWidth={false} sx={{ minHeight: '100vh', p: 0 }}>
        <Box sx={{ position: 'absolute', top: 8, right: 16, zIndex: 10 }}>
          <Button variant="outlined" size="small" onClick={() => signOut(auth)}>Выйти</Button>
        </Box>
        <Routes>
          <Route path="/" element={<DialogList user={user} />} />
          <Route path="/dialogs/new" element={<DialogCreate user={user} />} />
          <Route path="/dialogs/:id" element={<DialogChat user={user} />} />
          <Route path="/image-generation" element={<ImageGeneration />} />
        </Routes>
      </Container>
    </Router>
  );
}

export default App;
