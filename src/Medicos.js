// src/Medicos.js
import React, { useEffect, useState } from 'react';
import {
  Box, Paper, Typography, TextField, IconButton, Button,
  Table, TableHead, TableRow, TableCell, TableBody,
  LinearProgress, Snackbar, Alert
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import axios from 'axios';

export default function Medicos() {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState(null);
  const [snack, setSnack] = useState({ open:false, message:'', severity:'success' });

  const fetchRows = async () => {
    setLoading(true);
    try {
      const r = await axios.get('/medicos/list', { params: { q } });
      const list = (r.data || []).map(x => ({
        ...x,
        telefone: x.telefone || '',
        email: x.email || '',
      }));
      setRows(list);
    } catch (e) {
      setSnack({ open:true, severity:'error', message:'Falha ao carregar lista' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRows(); }, []);

  const onSave = async (row) => {
    setSavingId(row.id || row.profissional);
    try {
      await axios.post('/medicos/upsert', {
        profissional: row.profissional,
        telefone: row.telefone,
        whatsapp: row.telefone, // o backend normaliza
        email: row.email,
      });
      setSnack({ open:true, severity:'success', message:'Contato salvo!' });
      await fetchRows();
    } catch (e) {
      setSnack({ open:true, severity:'error', message:'Falha ao salvar' });
    } finally {
      setSavingId(null);
    }
  };

  const onSync = async () => {
    setLoading(true);
    try {
      await axios.post('/medicos/sync-from-fopam');
      setSnack({ open:true, severity:'success', message:'Sincronizado com FOPAM' });
      await fetchRows();
    } catch (e) {
      setSnack({ open:true, severity:'error', message:'Falha ao sincronizar' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom>Médicos</Typography>

      <Paper sx={{ p:2, mb:2, display:'flex', gap:1, alignItems:'center' }}>
        <TextField
          size="small"
          label="Buscar (nome)"
          value={q}
          onChange={e=>setQ(e.target.value)}
          onKeyDown={(e)=>{ if(e.key==='Enter') fetchRows(); }}
        />
        <Button startIcon={<SearchIcon/>} variant="outlined" onClick={fetchRows}>Buscar</Button>
        <Button startIcon={<RefreshIcon/>} onClick={onSync}>Sincronizar com FOPAM</Button>
      </Paper>

      {loading && <LinearProgress />}

      <Paper sx={{ overflow:'auto' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight:'bold' }}>Profissional</TableCell>
              <TableCell sx={{ fontWeight:'bold' }}>Telefone (WhatsApp)</TableCell>
              <TableCell sx={{ fontWeight:'bold' }}>E-mail</TableCell>
              <TableCell align="center" sx={{ fontWeight:'bold' }}>Ações</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r, idx)=>(
              <TableRow key={r.id || r.profissional || idx}>
                <TableCell width={320}>{r.profissional}</TableCell>
                <TableCell width={220}>
                  <TextField
                    size="small"
                    fullWidth
                    placeholder="(DDD) 9xxxx-xxxx"
                    value={r.telefone}
                    onChange={e=>{
                      const v = e.target.value;
                      setRows(prev=>{
                        const cp = [...prev];
                        cp[idx] = { ...cp[idx], telefone: v };
                        return cp;
                      });
                    }}
                  />
                </TableCell>
                <TableCell width={260}>
                  <TextField
                    size="small"
                    fullWidth
                    placeholder="email@exemplo.com"
                    value={r.email}
                    onChange={e=>{
                      const v = e.target.value;
                      setRows(prev=>{
                        const cp = [...prev];
                        cp[idx] = { ...cp[idx], email: v };
                        return cp;
                      });
                    }}
                  />
                </TableCell>
                <TableCell align="center" width={120}>
                  <IconButton
                    onClick={()=>onSave(r)}
                    disabled={savingId === (r.id || r.profissional)}
                    title="Salvar"
                  >
                    <SaveIcon/>
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {!loading && rows.length===0 && (
              <TableRow><TableCell colSpan={4}>Nenhum médico encontrado.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>

      <Snackbar
        open={snack.open}
        autoHideDuration={3000}
        onClose={()=>setSnack(s=>({ ...s, open:false }))}
        anchorOrigin={{ vertical:'bottom', horizontal:'left' }}
      >
        <Alert severity={snack.severity} onClose={()=>setSnack(s=>({ ...s, open:false }))}>
          {snack.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
