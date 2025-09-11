// src/App.js
import React, { useState, useEffect } from 'react';
import {
  Box, Button, TextField, Typography, AppBar, Toolbar,
  Dialog, DialogTitle, DialogContent, DialogActions, Alert, Stack
} from '@mui/material';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import Dashboard from './Dashboard';
import AdminPanel from './AdminPanel';
import Relatorios from './Relatorios';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';

// URL e chave pública do seu projeto Supabase
const SUPABASE_URL = 'https://bylupnogyoedaitandav.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ5bHVwbm9neW9lZGFpdGFuZGF2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzgwOTQzOSwiZXhwIjoyMDY5Mzg1NDM5fQ.r9K_kzXWBrx6bXYHpkxNB_RD9YzGe9W-CyQIxxur0fQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function App() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [session, setSession] = useState(null);
  const [error, setError] = useState('');
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestName, setRequestName] = useState('');
  const [requestEmail, setRequestEmail] = useState('');
  const [requestFeedback, setRequestFeedback] = useState('');
  const [showAdmin, setShowAdmin] = useState(false);
  const [userRole, setUserRole] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [currentPage, setCurrentPage] = useState('dashboard');

  // Drawer retrátil: controle global aqui
  const [navOpen, setNavOpen] = useState(false);

  // Dialog de importação
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadMes, setUploadMes] = useState('');
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState({ type: '', text: '' });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setSession(data.session);
        axios.defaults.headers.common.Authorization = 'Bearer ' + data.session.access_token;
      }
    });
  }, []);

  useEffect(() => {
    if (!session) return;
    axios
      .get('/user_info', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      .then((res) => {
        setUserRole(res.data.role || '');
        setDisplayName(res.data.name || '');
      })
      .catch(() => {
        setUserRole('');
        setDisplayName('');
      });
  }, [session]);

  const handleLogin = async () => {
    setError('');
    const { data, error: loginError } = await supabase.auth.signInWithPassword({ email, password });
    if (loginError) setError(loginError.message);
    else if (data.session) {
      setSession(data.session);
      axios.defaults.headers.common.Authorization = 'Bearer ' + data.session.access_token;
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUserRole('');
    setDisplayName('');
    setCurrentPage('dashboard');
    delete axios.defaults.headers.common.Authorization;
    setEmail('');
    setPassword('');
    setError('');
    setNavOpen(false);
  };

  const handleSolicitarAcesso = async () => {
    if (!requestName.trim() || !requestEmail.trim()) {
      setRequestFeedback('Preencha todos os campos.');
      return;
    }
    setRequestFeedback('Enviando...');
    try {
      const res = await axios.post('/request_access', {
        name: requestName,
        email: requestEmail,
      });
      if (res.data.status === 'pending') {
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

  // Upload handlers
  const resetUpload = () => {
    setUploadFile(null);
    setUploadMes('');
    setUploadLoading(false);
    setUploadMsg({ type: '', text: '' });
  };

  const handleUploadSubmit = async () => {
    if (!uploadFile) {
      setUploadMsg({ type: 'error', text: 'Selecione um arquivo .xlsx.' });
      return;
    }
    setUploadLoading(true);
    setUploadMsg({ type: '', text: '' });
    try {
      const fd = new FormData();
      fd.append('file', uploadFile);
      if (uploadMes.trim()) fd.append('mes', uploadMes.trim()); // opcional YYYY-MM
      const res = await axios.post('/importar/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setUploadMsg({ type: 'success', text: `Importação concluída. Registros inseridos: ${res.data.inserted}.` });
    } catch (err) {
      const t = err.response?.data?.error || err.message;
      const faltando = err.response?.data?.faltando;
      setUploadMsg({
        type: 'error',
        text: `Falha na importação: ${t}${faltando ? ` | Faltando colunas: ${faltando.join(', ')}` : ''}`,
      });
    } finally {
      setUploadLoading(false);
    }
  };

  if (!session) {
    return (
      <Box
        sx={{
          position: 'relative',
          width: '100vw',
          height: '100vh',
          backgroundColor: '#0a2648',
          color: '#fffdf8',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Box
          sx={{
            backgroundColor: '#0a2648',
            borderRadius: 2,
            p: 4,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            width: { xs: '90%', sm: '400px' },
          }}
        >
          <Box sx={{ mb: 2, textAlign: 'center' }}>
            <img src="/serges_logo.png" alt="Serges" style={{ maxWidth: '200px' }} />
          </Box>
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
          {error && (
            <Typography color="error" mb={1}>
              {error}
            </Typography>
          )}
          <Button variant="contained" fullWidth onClick={handleLogin}>
            Entrar
          </Button>
          <Button variant="outlined" fullWidth sx={{ mt: 2 }} onClick={() => setRequestOpen(true)}>
            Solicitar acesso
          </Button>
        </Box>

        <Dialog open={requestOpen} onClose={() => setRequestOpen(false)}>
          <DialogTitle>Solicitar acesso</DialogTitle>
          <DialogContent>
            <TextField
              label="Nome completo"
              fullWidth
              sx={{ mt: 1 }}
              value={requestName}
              onChange={(e) => setRequestName(e.target.value)}
            />
            <TextField
              label="E-mail"
              fullWidth
              sx={{ mt: 2 }}
              value={requestEmail}
              onChange={(e) => setRequestEmail(e.target.value)}
            />
            {requestFeedback && <Typography sx={{ mt: 2, color: 'green' }}>{requestFeedback}</Typography>}
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

  return (
    <Box display="flex" flexDirection="column" width="100vw" height="100vh">
      <AppBar
        position="static"
        color="transparent"
        elevation={0}
        sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}
      >
        <Toolbar sx={{ px: 2 }}>
          <Box sx={{ flex: 1, display: 'flex', alignItems: 'center' }}>
            {/* Logo abre/fecha o Drawer */}
            <img
              src="/serges_icon.png"
              alt="Serges"
              style={{ height: 28, cursor: 'pointer' }}
              onClick={() => setNavOpen((o) => !o)}
              title="Abrir menu"
            />
          </Box>
          <Typography variant="h6" fontWeight="bold" sx={{ flex: 1, textAlign: 'center' }}>
            {currentPage === 'relatorios' ? 'Relatórios Personalizados' : 'Relatório Analítico FOPAM'}
          </Typography>
          <Box sx={{ flex: 1, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            {userRole === 'admin' && (
              <>
                <Button
                  variant="outlined"
                  startIcon={<CloudUploadIcon />}
                  onClick={() => {
                    resetUpload();
                    setUploadOpen(true);
                  }}
                >
                  Importar planilha
                </Button>
                <Button
                  variant={showAdmin ? 'contained' : 'outlined'}
                  color="primary"
                  onClick={() => setShowAdmin((prev) => !prev)}
                >
                  {showAdmin ? 'Voltar ao Dashboard' : 'Administração'}
                </Button>
              </>
            )}
            <Button variant="outlined" color="error" onClick={handleLogout}>
              Sair
            </Button>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Dialog de Upload */}
      <Dialog open={uploadOpen} onClose={() => setUploadOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Importar planilha (Excel)</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Button variant="outlined" component="label">
              Selecionar arquivo (.xlsx)
              <input
                hidden
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
              />
            </Button>
            <Typography variant="body2" color="text.secondary">
              {uploadFile ? `Arquivo: ${uploadFile.name}` : 'Nenhum arquivo selecionado.'}
            </Typography>
            <TextField
              label="Mês (YYYY-MM) – opcional"
              value={uploadMes}
              onChange={(e) => setUploadMes(e.target.value)}
              placeholder="2025-08"
              helperText="Use se a planilha não tiver a coluna 'mes'."
            />
            {uploadMsg.text && <Alert severity={uploadMsg.type || 'info'}>{uploadMsg.text}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUploadOpen(false)}>Fechar</Button>
          <Button onClick={handleUploadSubmit} disabled={uploadLoading} variant="contained">
            {uploadLoading ? 'Enviando...' : 'Importar'}
          </Button>
        </DialogActions>
      </Dialog>

      <Box flex={1} overflow="auto">
        {showAdmin && userRole === 'admin' ? (
          <AdminPanel />
        ) : currentPage === 'dashboard' ? (
          <Dashboard
            userEmail={session.user.email}
            userName={displayName}
            navOpen={navOpen}
            setNavOpen={setNavOpen}
            onNavigate={() => setNavOpen(false)} // fecha ao navegar
          />
        ) : (
          <Relatorios />
        )}
      </Box>
    </Box>
  );
}

export default App;
