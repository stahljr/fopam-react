import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

// Tema personalizado utilizando a paleta da Serges
// Agora em modo claro para que o dashboard tenha fundo claro e texto escuro.
const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1f42e0',
    },
    secondary: {
      main: '#143d94',
    },
    background: {
      // Área geral do aplicativo (dashboard) em tom claro creme
      default: '#fffdf8',
      // Papel (cards, tabelas) em tom muito claro
      paper: '#f5faff',
    },
    text: {
      // Textos em tom escuro para melhor contraste no fundo claro
      primary: '#0a2648',
      secondary: '#143d94',
    },
    success: {
      main: '#28a745',
    },
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