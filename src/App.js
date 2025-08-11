// src/App.js

import React, { useState, useEffect } from 'react';
import {
  Box, Button, TextField, Typography, AppBar, Toolbar,
  Dialog, DialogTitle, DialogContent, DialogActions
} from '@mui/material';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import Dashboard from './Dashboard';
import AdminPanel from './AdminPanel';
import Relatorios from './Relatorios';

// URL e chave pública do seu projeto Supabase
const SUPABASE_URL = 'https://bylupnogyoedaitandav.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ5bHVwbm9neW9lZGFpdGFuZGF2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzgwOTQzOSwiZXhwIjoyMDY5Mzg1NDM5fQ.r9K_kzXWBrx6bXYHpkxNB_RD9YzGe9W-CyQIxxur0fQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function App() {
  // Login
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [session, setSession] = useState(null);
  const [error, setError] = useState('');

  // Solicitar acesso
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestName, setRequestName] = useState('');
  const [requestEmail, setRequestEmail] = useState('');
  const [requestFeedback, setRequestFeedback] = useState('');

  // Admin
  const [showAdmin, setShowAdmin] = useState(false);
  const [userRole, setUserRole] = useState('');
  const [userName, setUserName] = useState(''); // <<— novo

  // Página atual: "dashboard" | "relatorios"
  const [currentPage, setCurrentPage] = useState('dashboard');

  // Verifica se há sessão ativa ao carregar
  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        setSession(data.session);
        axios.defaults.headers.common['Authorization'] = 'Bearer ' + data.session.access_token;
      }
    };
    checkSession();
  }, []);

  // Busca o papel e o nome do usuário logado
  useEffect(() => {
    async function fetchUserInfo() {
      if (!session) return;
      try {
        const token = session.access_token;
        const res = await axios.get('/user_info', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setUserRole(res.data.role || '');
        // Prioriza nome retornado; fallback pro que vier do e-mail (antes do @)
        const nome = (res.data.name && res.data.name.trim())
          ? res.data.name.trim()
          : (session.user?.email?.split('@')[0] || '');
        setUserName(nome);
      } catch (err) {
        setUserRole('');
        setUserName(session?.user?.email?.split('@')[0] || '');
      }
    }
    fetchUserInfo();
  }, [session]);

  const handleLogin = async () => {
    setError('');
    const { data, error: loginError } = await supabase.auth.signInWithPassword({ email, password });
    if (loginError) {
      setError(loginError.message);
    } else if (data.session) {
      setSession(data.session);
      axios.defaults.headers.common['Authorization'] = 'Bearer ' + data.session.access_token;
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUserRole('');
    setUserName('');
    setCurrentPage('dashboard');
    delete axios.defaults.headers.common['Authorization'];
    setEmail('');
    setPassword('');
    setError('');
  };

  // Função do botão "Solicitar acesso"
  const handleSolicitarAcesso = async () => {
    if (!requestName.trim() || !requestEmail.trim()) {
      setRequestFeedback('Preencha todos os campos.');
      return;
    }
    setRequestFeedback('Enviando...');

    try {
      const res = await axios.post('/request_access', {
        name: requestName,
        email: requestEmail
      });
      if (res.data && res.data.status === 'pending') {
        setRequestFeedback('Solicitação enviada! Aguarde aprovação.');
        setRequestName('');
        setRequestEmail('');
      } else {
        setRequestFeedback(res.data.error || 'Erro desconhecido.');
      }
    } catch (err) {
      setRequestFeedback('Erro ao enviar solicitação: ' + (err.response?.data?.error || err.message));
    }
  };

  // ----------- TELA DE LOGIN -----------
  if (!session) {
    return (
      <Box
        sx={{
          position: 'relative',
          width: '100vw',
          height: '100vh',
          overflow: 'hidden',
          backgroundColor: '#0a2648',
          color: '#fffdf8',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Card de login */}
        <Box
          sx={{
            backgroundColor: '#0a2648',
            borderRadius: 2,
            padding: 4,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            width: { xs: '90%', sm: '400px' },
          }}
        >
          {/* Logo Serges */}
          <Box sx={{ mb: 2, textAlign: 'center' }}>
            <img src="/serges_logo.png" alt="Serges" style={{ maxWidth: '200px' }} />
          </Box>
          {/* Campos de login */}
          <TextField
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            sx={{ mb: 2, width: '100%' }}
            InputLabelProps={{ style: { color: '#fffdf8' } }}
            InputProps={{ style: { color: '#fffdf8' } }}
          />
          <TextField
            label="Senha"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            sx={{ mb: 2, width: '100%' }}
            InputLabelProps={{ style: { color: '#fffdf8' } }}
            InputProps={{ style: { color: '#fffdf8' } }}
          />
          {error && <Typography color="error" mb={1}>{error}</Typography>}
          <Button variant="contained" onClick={handleLogin}>Entrar</Button>
          {/* Botão Solicitar acesso */}
          <Button
            variant="outlined"
            color="primary"
            fullWidth
            sx={{ mt: 2 }}
            onClick={() => setRequestOpen(true)}
          >
            Solicitar acesso
          </Button>
        </Box>
        {/* Modal Solicitar acesso */}
        <Dialog open={requestOpen} onClose={() => setRequestOpen(false)}>
          <DialogTitle>Solicitar acesso</DialogTitle>
          <DialogContent>
            <TextField
              label="Nome completo"
              fullWidth
              sx={{ mt: 1 }}
              value={requestName}
              onChange={e => setRequestName(e.target.value)}
            />
            <TextField
              label="E-mail"
              fullWidth
              sx={{ mt: 2 }}
              value={requestEmail}
              onChange={e => setRequestEmail(e.target.value)}
            />
            {requestFeedback && (
              <Typography sx={{ mt: 2, color: 'green' }}>{requestFeedback}</Typography>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setRequestOpen(false)}>Cancelar</Button>
            <Button variant="contained" onClick={handleSolicitarAcesso}>
              Enviar solicitação
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    );
  }

  // ----------- APP PRINCIPAL (NAV + PAINÉIS) -----------
  return (
    <Box p={0} m={0} width="100vw" height="100vh" display="flex" flexDirection="column" bgcolor="background.default" color="text.primary">
      {/* Barra superior */}
      <AppBar position="static" color="transparent" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
        <Toolbar sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <img src="/serges_icon.png" alt="Serges" style={{ height: 28, marginRight: 12 }} />
          </Box>
          <Typography variant="h6" fontWeight="bold" sx={{ textAlign: 'center' }}>
            {currentPage === 'relatorios' ? 'Relatórios Personalizados' : 'Relatório Analítico FOPAM'}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {userRole === 'admin' && (
              <Button
                variant={showAdmin ? 'contained' : 'outlined'}
                color="primary"
                sx={{ mr: 1 }}
                onClick={() => setShowAdmin((prev) => !prev)}
              >
                {showAdmin ? 'Voltar ao Dashboard' : 'Administração'}
              </Button>
            )}
            <Button variant="outlined" color="error" onClick={handleLogout}>Sair</Button>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Painel principal */}
      <Box flex={1} overflow="auto">
        {showAdmin && userRole === 'admin' ? (
          <AdminPanel />
        ) : currentPage === 'dashboard' ? (
          <Dashboard
            userEmail={session.user.email}
            userName={userName}                 // <<— passa o nome para o Dashboard
            onMenuChange={setCurrentPage}
          />
        ) : (
          <Relatorios onMenuChange={setCurrentPage} />
        )}
      </Box>
    </Box>
  );
}

export default App;
