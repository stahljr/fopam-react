// src/index.js

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import axios from 'axios';

// Base URL da API: em produção (Render) use REACT_APP_API_URL; em dev cai no localhost:5000
axios.defaults.baseURL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

// === Inclusão: interceptador para anexar token do Supabase em todas as requests ===
axios.interceptors.request.use((config) => {
  try {
    // Supabase armazena a sessão no localStorage
    const sb = JSON.parse(localStorage.getItem('supabase.auth.token') || 'null');
    const token = sb?.currentSession?.access_token || sb?.access_token;
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
  } catch (err) {
    console.warn('Não foi possível recuperar token do Supabase:', err);
  }
  return config;
});

// Tema personalizado utilizando a paleta da Serges (modo claro)
const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#1f42e0' },
    secondary: { main: '#143d94' },
    background: {
      default: '#fffdf8', // área geral
      paper: '#f5faff',   // cards/tabelas
    },
    text: {
      primary: '#0a2648',
      secondary: '#143d94',
    },
    success: { main: '#28a745' },
  },
});

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </React.StrictMode>
);
