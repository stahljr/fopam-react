// src/Dashboard.js
import React, { useState, useEffect, useRef } from 'react';
import Relatorios from './Relatorios';
import {
  Box,
  Drawer,
  List,
  ListItemButton,
  ListItemText,
  Typography,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Checkbox,
  FormControlLabel,
  Button,
  Paper,
  Collapse,
  Avatar,
  Switch,
  Tooltip,
  LinearProgress,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import ExpandMoreIcon from '@mui/icons-material/KeyboardArrowRight';
import ExpandLessIcon from '@mui/icons-material/KeyboardArrowDown';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import ClearIcon from '@mui/icons-material/Clear';
import axios from 'axios';

// Largura fixa da barra lateral
const drawerWidth = 240;

// Meses do menu lateral
const monthsList = [
  { value: '2025-08', label: 'Agosto 2025' },
  { value: '2025-07', label: 'Julho 2025' },
];

export default function Dashboard({ userEmail, userName }) {
  // controla qual painel interno mostrar: "fopam" ou "relatorios"
  const [painelAtivo, setPainelAtivo] = useState('fopam');

  // --- Estados do FOPAM ---
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [data, setData] = useState([]);
  const [hierarchy, setHierarchy] = useState([]);
  const [totals, setTotals] = useState({ horas: 0, pagamento: 0, faturamento: 0 });
  const [openDates, setOpenDates] = useState({});
  const [openProjects, setOpenProjects] = useState({});

  // diálogo de adicionar/editar
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState('new');
  const [dialogGlobal, setDialogGlobal] = useState({});
  const [dialogRows, setDialogRows] = useState([]);
  const [dialogFlags, setDialogFlags] = useState({
    producao_validada: false,
    pagamento_lancado: false,
    faturamento_validado: false,
  });
  const [dialogRatePay, setDialogRatePay] = useState(0);
  const [dialogRateBill, setDialogRateBill] = useState(0);

  // autocálculo DESLIGADO por padrão
  const [autoCalcPay, setAutoCalcPay] = useState(false);
  const [autoCalcBill, setAutoCalcBill] = useState(false);

  // abas de menu FOPAM
  const [openYearMenu, setOpenYearMenu] = useState(false);
  const [openMesesMenu, setOpenMesesMenu] = useState(false);

  // --- Perfil (nome + avatar) ---
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileName, setProfileName] = useState(userName || '');
  const [avatarUrl, setAvatarUrl] = useState(null);        // vindo do backend (se/tq)
  const [avatarFile, setAvatarFile] = useState(null);      // arquivo selecionado
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    // sempre que o prop userName mudar, sincroniza
    setProfileName(userName || '');
  }, [userName]);

  // opcional: tenta buscar avatar atual (se backend der suporte em /user_info)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const r = await axios.get('/user_info');
        // se o backend passar avatar_url, usa aqui:
        if (mounted && r?.data?.avatar_url) {
          setAvatarUrl(r.data.avatar_url);
        }
        // também atualiza nome caso venha mais novo do backend
        if (mounted && r?.data?.name && !userName) {
          setProfileName(r.data.name);
        }
      } catch {
        // silencioso
      }
    })();
    return () => { mounted = false; };
  }, []); // uma vez

  const displayName = (profileName && profileName.trim()) || userEmail || '';

  // monta hierarquia (datas > projetos > profissionais)
  const buildHierarchy = (raw) => {
    const datesMap = {};
    const globalTotals = { horas: 0, pagamento: 0, faturamento: 0 };
    raw.forEach((row) => {
      const dateKey = row.data_pagamento;
      const projectKey = row.projeto || '';
      const profKey = row.profissional || '';
      if (!datesMap[dateKey]) {
        datesMap[dateKey] = { projects: {}, totals: { horas: 0, pagamento: 0, faturamento: 0 }, projectCount: 0 };
      }
      const dateObj = datesMap[dateKey];

      if (!dateObj.projects[projectKey]) {
        dateObj.projects[projectKey] = { professionals: {}, totals: { horas: 0, pagamento: 0, faturamento: 0 }, count: 0 };
        dateObj.projectCount++;
      }
      const projObj = dateObj.projects[projectKey];

      if (!projObj.professionals[profKey]) {
        projObj.professionals[profKey] = {
          rows: [],
          totals: { horas: 0, pagamento: 0, faturamento: 0 },
          producao_validada: true,
          pagamento_lancado: true,
          faturamento_validado: true,
        };
        projObj.count++;
      }
      const profObj = projObj.professionals[profKey];

      profObj.rows.push(row);

      const h = parseFloat(row.horas) || 0;
      const p = parseFloat(row.pagamento) || 0;
      const f = parseFloat(row.faturamento) || 0;

      profObj.totals.horas += h;
      profObj.totals.pagamento += p;
      profObj.totals.faturamento += f;

      profObj.producao_validada = profObj.producao_validada && !!row.producao_validada;
      profObj.pagamento_lancado = profObj.pagamento_lancado && !!row.pagamento_lancado;
      profObj.faturamento_validado = profObj.faturamento_validado && !!row.faturamento_validado;

      projObj.totals.horas += h;
      projObj.totals.pagamento += p;
      projObj.totals.faturamento += f;

      dateObj.totals.horas += h;
      dateObj.totals.pagamento += p;
      dateObj.totals.faturamento += f;

      globalTotals.horas += h;
      globalTotals.pagamento += p;
      globalTotals.faturamento += f;
    });

    const dateKeys = Object.keys(datesMap).sort((a, b) => new Date(a) - new Date(b));
    const datesList = dateKeys.map((dateKey) => {
      const dObj = datesMap[dateKey];
      const projKeys = Object.keys(dObj.projects).sort();
      const projList = projKeys.map((projKey) => {
        const pObj = dObj.projects[projKey];
        const profKeys = Object.keys(pObj.professionals).sort();
        const profList = profKeys.map((profKey) => {
          const prObj = pObj.professionals[profKey];
          return {
            type: 'professional',
            profissional: profKey,
            ids: prObj.rows.map((r) => r.id),
            rows: prObj.rows,
            totals: { ...prObj.totals },
            producao_validada: prObj.producao_validada,
            pagamento_lancado: prObj.pagamento_lancado,
            faturamento_validado: prObj.faturamento_validado,
          };
        });
        return {
          type: 'project',
          project: projKey,
          totals: { ...pObj.totals },
          professionals: profList,
          count: profList.length,
        };
      });
      return {
        type: 'date',
        date: dateKey,
        totals: { ...dObj.totals },
        projects: projList,
        projectCount: projList.length,
      };
    });
    return { datesList, globalTotals };
  };

  // busca dados do backend
  const fetchData = async (mes) => {
    try {
      const res = await axios.get('/data', { params: { mes } });
      const raw = res.data || [];
      setData(raw);
      const { datesList, globalTotals } = buildHierarchy(raw);
      setHierarchy(datesList);
      setTotals(globalTotals);

      const initDates = {};
      const initProjects = {};
      datesList.forEach((d) => {
        initDates[d.date] = false;
        initProjects[d.date] = {};
        d.projects.forEach((p) => {
          initProjects[d.date][p.project] = false;
        });
      });
      setOpenDates(initDates);
      setOpenProjects(initProjects);
    } catch (err) {
      console.error('Erro ao buscar dados:', err);
      setData([]);
      setHierarchy([]);
      setTotals({ horas: 0, pagamento: 0, faturamento: 0 });
    }
  };

  useEffect(() => {
    if (selectedMonth) fetchData(selectedMonth);
  }, [selectedMonth]);

  // Helpers de recálculo quando switches forem ligados
  const recalcPagamentos = (rows, rate) =>
    rows.map((r) => {
      const h = parseFloat(r.horas) || 0;
      return { ...r, pagamento: parseFloat((h * rate).toFixed(2)) };
    });

  const recalcFaturamentos = (rows, rate) =>
    rows.map((r) => {
      const h = parseFloat(r.horas) || 0;
      return { ...r, faturamento: parseFloat((h * rate).toFixed(2)) };
    });

  // abrir diálogo novo
  const handleOpenNew = () => {
    if (!selectedMonth) return;
    setDialogMode('new');
    setDialogGlobal({
      projeto: '',
      profissional: '',
      vinculo: '',
      data_pagamento: `${selectedMonth}-01`,
      mes: `${selectedMonth}-01`,
    });
    setDialogRows([
      { id: null, data_servico: `${selectedMonth}-01`, horas: 0, pagamento: 0, faturamento: 0 },
    ]);
    setDialogFlags({ producao_validada: false, pagamento_lancado: false, faturamento_validado: false });
    setDialogRatePay(0);
    setDialogRateBill(0);
    setAutoCalcPay(false);
    setAutoCalcBill(false);
    setDialogOpen(true);
  };

  // abrir diálogo editar
  const handleOpenEdit = (row) => {
    setDialogMode('edit');
    const first = row.rows?.[0] || row;
    setDialogGlobal({
      projeto: first.projeto || '',
      profissional: first.profissional || '',
      vinculo: first.vinculo || '',
      data_pagamento: first.data_pagamento || '',
      mes: first.mes || '',
    });
    const rowsArr = (row.rows || [row]).map((r) => ({
      id: r.id,
      data_servico: r.data_servico,
      horas: parseFloat(r.horas) || 0,
      pagamento: parseFloat(r.pagamento) || 0,
      faturamento: parseFloat(r.faturamento) || 0,
    }));
    setDialogRows(rowsArr);
    const hrs = rowsArr.reduce((sum, r) => sum + (parseFloat(r.horas) || 0), 0);
    const pag = rowsArr.reduce((sum, r) => sum + (parseFloat(r.pagamento) || 0), 0);
    const fat = rowsArr.reduce((sum, r) => sum + (parseFloat(r.faturamento) || 0), 0);
    setDialogRatePay(hrs > 0 ? pag / hrs : 0);
    setDialogRateBill(hrs > 0 ? fat / hrs : 0);
    setDialogFlags({
      producao_validada: row.producao_validada ?? false,
      pagamento_lancado: row.pagamento_lancado ?? false,
      faturamento_validado: row.faturamento_validado ?? false,
    });
    setAutoCalcPay(false);
    setAutoCalcBill(false);
    setDialogOpen(true);
  };

  // salvar (new/edit)
  const handleSaveDialog = async () => {
    try {
      if (dialogMode === 'new') {
        for (const r of dialogRows) {
          const payload = {
            projeto: dialogGlobal.projeto,
            profissional: dialogGlobal.profissional,
            vinculo: dialogGlobal.vinculo,
            data_servico: r.data_servico,
            data_pagamento: dialogGlobal.data_pagamento,
            mes: dialogGlobal.mes,
            horas: r.horas,
            pagamento: r.pagamento,
            faturamento: r.faturamento,
            producao_validada: dialogFlags.producao_validada,
            pagamento_lancado: dialogFlags.pagamento_lancado,
            faturamento_validado: dialogFlags.faturamento_validado,
            valor_hora_pag: dialogRatePay,
            valor_hora_fat: dialogRateBill,
          };
          await axios.post('/add', payload);
        }
      } else {
        for (const r of dialogRows) {
          const fields = {
            projeto: dialogGlobal.projeto,
            profissional: dialogGlobal.profissional,
            vinculo: dialogGlobal.vinculo,
            data_servico: r.data_servico,
            data_pagamento: dialogGlobal.data_pagamento,
            mes: dialogGlobal.mes,
            horas: r.horas,
            pagamento: r.pagamento,
            faturamento: r.faturamento,
            producao_validada: dialogFlags.producao_validada,
            pagamento_lancado: dialogFlags.pagamento_lancado,
            faturamento_validado: dialogFlags.faturamento_validado,
          };
          if (r.id) {
            for (const [field, value] of Object.entries(fields)) {
              await axios.post('/update', { id: r.id, field, value });
            }
            await axios.post('/update', { id: r.id, field: 'valor_hora_pag', value: dialogRatePay });
            await axios.post('/update', { id: r.id, field: 'valor_hora_fat', value: dialogRateBill });
          } else {
            await axios.post('/add', {
              ...fields,
              valor_hora_pag: dialogRatePay,
              valor_hora_fat: dialogRateBill,
            });
          }
        }
      }
      setDialogOpen(false);
      await fetchData(selectedMonth);
    } catch (err) {
      console.error('Erro ao salvar alterações:', err);
    }
  };

  // atualizar flags booleanos
  const handleBoolChange = async (idOrObj, field, value) => {
    try {
      if (typeof idOrObj === 'object' && Array.isArray(idOrObj.ids)) {
        for (const rid of idOrObj.ids) {
          await axios.post('/update', { id: rid, field, value });
        }
        await fetchData(selectedMonth);
      } else {
        await axios.post('/update', { id: idOrObj, field, value });
        setData((prev) => prev.map((r) => (r.id === idOrObj ? { ...r, [field]: value } : r)));
      }
    } catch (err) {
      console.error('Erro ao atualizar campo booleano:', err);
    }
  };

  // excluir
  const handleDeleteRow = async (row) => {
    if (!window.confirm('Deseja excluir este registro?')) return;
    try {
      if (row.ids && Array.isArray(row.ids)) {
        for (const rid of row.ids) {
          await axios.post('/delete', { id: rid });
        }
      } else if (row.id) {
        await axios.post('/delete', { id: row.id });
      }
      await fetchData(selectedMonth);
    } catch (err) {
      console.error('Erro ao excluir registro:', err);
    }
  };

  // exportar FOPAM
  const handleExport = async () => {
    if (!selectedMonth) return;
    try {
      const res = await axios.get('/export', {
        params: { mes: selectedMonth },
        responseType: 'blob',
      });
      const blob = new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `fopam_export_${selectedMonth}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Erro ao exportar:', err);
    }
  };

  // --- Perfil: handlers ---
  const handleOpenProfile = () => setProfileOpen(true);
  const handleCloseProfile = () => {
    setProfileOpen(false);
    // limpa seleção de arquivo ao fechar
    setAvatarFile(null);
    setAvatarPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const onPickAvatar = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const clearAvatarSelection = () => {
    setAvatarFile(null);
    setAvatarPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSaveProfile = async () => {
    try {
      setSavingProfile(true);

      // 1) Atualiza nome (se mudou)
      const trimmed = (profileName || '').trim();
      if (trimmed && trimmed !== userName) {
        await axios.post('/profile/update-name', { name: trimmed });
      }

      // 2) Sobe avatar (se selecionado)
      if (avatarFile) {
        const fd = new FormData();
        fd.append('file', avatarFile);
        const resp = await axios.post('/profile/upload-avatar', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        if (resp?.data?.avatar_url) {
          setAvatarUrl(resp.data.avatar_url);
        }
      }

      setSavingProfile(false);
      handleCloseProfile();

      // opcional: recarrega /user_info pra sincronizar (se App.js depender disso)
      try { await axios.get('/user_info'); } catch {}

    } catch (err) {
      console.error('Erro ao salvar perfil:', err);
      setSavingProfile(false);
    }
  };

  // letra de fallback no avatar
  const fallbackInitial = (displayName || ' ').trim().charAt(0).toUpperCase();

  return (
    <Box sx={{ display: 'flex' }}>
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': { width: drawerWidth, boxSizing: 'border-box' },
        }}
      >
        <Box sx={{ p: 2 }}>
          <img src="/serges_logo.png" alt="Serges" style={{ maxWidth: '100%', height: 40, marginBottom: 8 }} />

          {(userEmail || profileName) && (
            <Box sx={{ display: 'flex', alignItems: 'center', flexDirection: 'column', mt: 1, textAlign: 'center' }}>
              <Tooltip title="Editar perfil">
                <IconButton onClick={handleOpenProfile} sx={{ p: 0, mb: 1 }}>
                  <Avatar
                    src={avatarPreview || avatarUrl || undefined}
                    alt={displayName}
                    sx={{ bgcolor: 'primary.main', width: 48, height: 48 }}
                  >
                    {!avatarPreview && !avatarUrl ? fallbackInitial : null}
                  </Avatar>
                </IconButton>
              </Tooltip>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>Bem-vindo</Typography>
              <Typography
                variant="subtitle2"
                sx={{ fontWeight: 'bold', color: 'text.primary', wordBreak: 'break-word' }}
              >
                {displayName}
              </Typography>
              <Button size="small" onClick={handleOpenProfile} sx={{ mt: 0.5 }}>
                Editar perfil
              </Button>
            </Box>
          )}
        </Box>

        <List>
          <ListItemButton selected={painelAtivo === 'fopam'} onClick={() => setPainelAtivo('fopam')}>
            <ListItemText primary="FOPAM" />
          </ListItemButton>

          <Collapse in={painelAtivo === 'fopam'} timeout="auto" unmountOnExit>
            <List component="div" disablePadding>
              <ListItemButton sx={{ pl: 2 }} onClick={() => setOpenYearMenu((o) => !o)}>
                <ListItemText primary="2025" />
                {openYearMenu ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </ListItemButton>

              <Collapse in={openYearMenu} timeout="auto" unmountOnExit>
                <List component="div" disablePadding>
                  <ListItemButton sx={{ pl: 4 }} onClick={() => setOpenMesesMenu((o) => !o)}>
                    <ListItemText primary="Meses" />
                    {openMesesMenu ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  </ListItemButton>

                  <Collapse in={openMesesMenu} timeout="auto" unmountOnExit>
                    <List component="div" disablePadding>
                      {monthsList.map((month) => (
                        <ListItemButton
                          key={month.value}
                          sx={{
                            pl: 6,
                            mx: 1,
                            my: 0.5,
                            borderRadius: 1,
                            backgroundColor: selectedMonth === month.value ? 'primary.main' : 'transparent',
                            color: selectedMonth === month.value ? 'primary.contrastText' : 'text.primary',
                            '&:hover': {
                              backgroundColor: selectedMonth === month.value ? 'primary.main' : 'primary.light',
                              color: 'primary.contrastText',
                            },
                          }}
                          selected={selectedMonth === month.value}
                          onClick={() => setSelectedMonth(month.value)}
                        >
                          <ListItemText primary={month.label} />
                        </ListItemButton>
                      ))}
                    </List>
                  </Collapse>
                </List>
              </Collapse>
            </List>
          </Collapse>

          <ListItemButton selected={painelAtivo === 'relatorios'} onClick={() => setPainelAtivo('relatorios')}>
            <ListItemText primary="Relatórios" />
          </ListItemButton>
        </List>
      </Drawer>

      <Box sx={{ flexGrow: 1, p: 2 }}>
        {painelAtivo === 'fopam' ? (
          <>
            <Typography variant="h5" gutterBottom>
              FOPAM – Folha de Pagamento Médica
            </Typography>

            {selectedMonth ? (
              <>
                <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                  <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenNew}>
                    Nova Produção
                  </Button>
                  <Button variant="outlined" onClick={handleExport} disabled={!selectedMonth}>
                    Exportar FOPAM
                  </Button>
                </Box>

                <Typography variant="body1" sx={{ mb: 2 }}>
                  Mês selecionado: {selectedMonth}
                </Typography>

                <Paper sx={{ borderRadius: 2, overflow: 'hidden', backgroundColor: 'background.paper' }}>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 'bold' }}>Profissional</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>Vínculo</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>Horas</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>Pagamento</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>Faturamento</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>Prod.Val.</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>Pag.Lan.</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>Fat.Val.</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 'bold' }}>Ações</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {hierarchy.map((dateItem) => {
                        const dateStr = dateItem.date;
                        const d = dateStr.split('-');
                        const dia = d[2];
                        const projCount = dateItem.projectCount;
                        const totHoras = dateItem.totals.horas;
                        const totPag = dateItem.totals.pagamento;
                        const totFat = dateItem.totals.faturamento;
                        const dateOpen = openDates[dateStr];
                        const allValidatedDate = dateItem.projects.every((proj) =>
                          proj.professionals.every((p) => p.producao_validada)
                        );
                        return (
                          <React.Fragment key={`date-${dateStr}`}>
                            <TableRow>
                              <TableCell
                                colSpan={9}
                                sx={{ cursor: 'pointer', pl: 1, backgroundColor: 'background.paper' }}
                                onClick={() => setOpenDates((prev) => ({ ...prev, [dateStr]: !prev[dateStr] }))}
                              >
                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                  <IconButton size="small">
                                    {dateOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                                  </IconButton>
                                  <Typography variant="subtitle2" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center' }}>
                                    Dia {dia} — ({projCount} projetos) — Horas: {totHoras.toLocaleString('pt-BR')} — Pag:{' '}
                                    {totPag.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} — Fat:{' '}
                                    {totFat.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    {allValidatedDate && <CheckCircleIcon sx={{ color: 'success.main', ml: 1 }} />}
                                  </Typography>
                                </Box>
                              </TableCell>
                            </TableRow>

                            {dateOpen &&
                              dateItem.projects.map((projItem) => {
                                const projKey = projItem.project;
                                const projOpen = openProjects[dateStr]?.[projKey];
                                const totH = projItem.totals.horas;
                                const totP = projItem.totals.pagamento;
                                const totF = projItem.totals.faturamento;
                                const allValidatedProj = projItem.professionals.every((p) => p.producao_validada);
                                return (
                                  <React.Fragment key={`project-${dateStr}-${projKey}`}>
                                    <TableRow>
                                      <TableCell
                                        colSpan={9}
                                        sx={{ cursor: 'pointer', pl: 4, backgroundColor: 'background.paper' }}
                                        onClick={() =>
                                          setOpenProjects((prev) => ({
                                            ...prev,
                                            [dateStr]: { ...prev[dateStr], [projKey]: !prev[dateStr]?.[projKey] },
                                          }))
                                        }
                                      >
                                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                          <IconButton size="small">
                                            {projOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                                          </IconButton>
                                          <Typography variant="subtitle2" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center' }}>
                                            {projKey || '(Sem projeto)'} — ({projItem.count} profissionais) — Horas: {totH.toLocaleString('pt-BR')}
                                            {' '}— Pag: {totP.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                            {' '}— Fat: {totF.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                            {allValidatedProj && <CheckCircleIcon sx={{ color: 'success.main', ml: 1 }} />}
                                          </Typography>
                                        </Box>
                                      </TableCell>
                                    </TableRow>

                                    {projOpen &&
                                      projItem.professionals.map((prof) => {
                                        const hours = prof.totals.horas;
                                        const pag = prof.totals.pagamento;
                                        const fat = prof.totals.faturamento;
                                        return (
                                          <TableRow
                                            key={`prof-${dateStr}-${projKey}-${prof.profissional}`}
                                            hover
                                            sx={{ '&:hover': { backgroundColor: (theme) => theme.palette.action.hover } }}
                                          >
                                            <TableCell sx={{ pl: 6 }}>
                                              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                                {prof.profissional}
                                                {prof.producao_validada && (
                                                  <CheckCircleIcon sx={{ color: 'success.main', ml: 0.5, fontSize: '1rem' }} />
                                                )}
                                              </Box>
                                            </TableCell>
                                            <TableCell>
                                              {(() => {
                                                const uniqueV = Array.from(new Set(prof.rows.map((r) => r.vinculo || '')));
                                                return uniqueV.length === 1 ? uniqueV[0] : 'Vários';
                                              })()}
                                            </TableCell>
                                            <TableCell align="right">{hours.toLocaleString('pt-BR')}</TableCell>
                                            <TableCell align="right">
                                              {pag.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                            </TableCell>
                                            <TableCell align="right">
                                              {fat.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                            </TableCell>
                                            <TableCell>
                                              <Switch
                                                checked={!!prof.producao_validada}
                                                onChange={(e) => handleBoolChange(prof, 'producao_validada', e.target.checked)}
                                              />
                                            </TableCell>
                                            <TableCell>
                                              <Switch
                                                checked={!!prof.pagamento_lancado}
                                                onChange={(e) => handleBoolChange(prof, 'pagamento_lancado', e.target.checked)}
                                              />
                                            </TableCell>
                                            <TableCell>
                                              <Switch
                                                checked={!!prof.faturamento_validado}
                                                onChange={(e) => handleBoolChange(prof, 'faturamento_validado', e.target.checked)}
                                              />
                                            </TableCell>
                                            <TableCell align="center">
                                              <IconButton size="small" onClick={() => handleOpenEdit(prof)}>
                                                <EditIcon fontSize="small" />
                                              </IconButton>
                                              <IconButton size="small" onClick={() => handleDeleteRow(prof)}>
                                                <DeleteIcon fontSize="small" />
                                              </IconButton>
                                            </TableCell>
                                          </TableRow>
                                        );
                                      })}
                                  </React.Fragment>
                                );
                              })}
                          </React.Fragment>
                        );
                      })}
                    </TableBody>
                  </Table>
                </Paper>

                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                    TOTAL — Horas: {totals.horas} | Pagamento:{' '}
                    {totals.pagamento.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} | Faturamento:{' '}
                    {totals.faturamento.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </Typography>
                </Box>
              </>
            ) : (
              <Typography variant="body1">Selecione um mês no menu ao lado para começar.</Typography>
            )}

            {/* Dialog de novo/editar produção */}
            <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
              <DialogTitle>{dialogMode === 'new' ? 'Nova Produção' : 'Editar Produção'}</DialogTitle>
              <DialogContent dividers sx={{ backgroundColor: 'background.paper' }}>
                <Box component="form" sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <TextField
                    label="Projeto"
                    value={dialogGlobal.projeto || ''}
                    onChange={(e) => setDialogGlobal((prev) => ({ ...prev, projeto: e.target.value }))}
                    fullWidth
                  />
                  <TextField
                    label="Profissional"
                    value={dialogGlobal.profissional || ''}
                    onChange={(e) => setDialogGlobal((prev) => ({ ...prev, profissional: e.target.value }))}
                    fullWidth
                  />
                  <TextField
                    label="Vínculo"
                    value={dialogGlobal.vinculo || ''}
                    onChange={(e) => setDialogGlobal((prev) => ({ ...prev, vinculo: e.target.value }))}
                    fullWidth
                  />
                  <TextField
                    label="Data Pagamento"
                    type="date"
                    value={dialogGlobal.data_pagamento || ''}
                    onChange={(e) => setDialogGlobal((prev) => ({ ...prev, data_pagamento: e.target.value }))}
                    InputLabelProps={{ shrink: true }}
                  />
                  <TextField label="Mês" type="date" value={dialogGlobal.mes || ''} disabled InputLabelProps={{ shrink: true }} />

                  <Typography variant="subtitle1">Serviços</Typography>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Data Serviço</TableCell>
                        <TableCell align="right">Horas</TableCell>
                        <TableCell align="right">Pagamento</TableCell>
                        <TableCell align="right">Faturamento</TableCell>
                        <TableCell align="center">&nbsp;</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {dialogRows.map((r, idx) => (
                        <TableRow key={idx}>
                          <TableCell>
                            <TextField
                              type="date"
                              value={r.data_servico}
                              onChange={(e) => {
                                const v = e.target.value;
                                setDialogRows((rows) => {
                                  const nr = [...rows];
                                  nr[idx].data_servico = v;
                                  return nr;
                                });
                              }}
                              InputLabelProps={{ shrink: true }}
                              fullWidth
                            />
                          </TableCell>
                          <TableCell align="right">
                            <TextField
                              type="number"
                              inputProps={{ step: 0.01 }}
                              value={r.horas}
                              onChange={(e) => {
                                const v = parseFloat(e.target.value) || 0;
                                setDialogRows((rows) => {
                                  let nr = [...rows];
                                  nr[idx].horas = v;
                                  if (autoCalcPay) nr = recalcPagamentos(nr, dialogRatePay);
                                  if (autoCalcBill) nr = recalcFaturamentos(nr, dialogRateBill);
                                  return nr;
                                });
                              }}
                              fullWidth
                            />
                          </TableCell>
                          <TableCell align="right">
                            <TextField
                              type="number"
                              inputProps={{ step: 0.01 }}
                              value={r.pagamento}
                              onChange={(e) => {
                                const v = parseFloat(e.target.value);
                                setDialogRows((rows) => {
                                  const nr = [...rows];
                                  nr[idx].pagamento = Number.isNaN(v) ? 0 : v;
                                  return nr;
                                });
                              }}
                              fullWidth
                              disabled={autoCalcPay}
                            />
                          </TableCell>
                          <TableCell align="right">
                            <TextField
                              type="number"
                              inputProps={{ step: 0.01 }}
                              value={r.faturamento}
                              onChange={(e) => {
                                const v = parseFloat(e.target.value);
                                setDialogRows((rows) => {
                                  const nr = [...rows];
                                  nr[idx].faturamento = Number.isNaN(v) ? 0 : v;
                                  return nr;
                                });
                              }}
                              fullWidth
                              disabled={autoCalcBill}
                            />
                          </TableCell>
                          <TableCell align="center">
                            <IconButton onClick={() => setDialogRows((rows) => rows.filter((_, i) => i !== idx))}>
                              <DeleteIcon />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  <Button
                    startIcon={<AddIcon />}
                    onClick={() =>
                      setDialogRows((rows) => [
                        ...rows,
                        {
                          id: null,
                          data_servico: dialogGlobal.data_pagamento || `${selectedMonth}-01`,
                          horas: 0,
                          pagamento: 0,
                          faturamento: 0,
                        },
                      ])
                    }
                  >
                    Adicionar data
                  </Button>

                  <TextField
                    label="Valor Hora Pago (R$)"
                    type="number"
                    inputProps={{ step: 0.01 }}
                    value={dialogRatePay}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value) || 0;
                      setDialogRatePay(v);
                      if (autoCalcPay) {
                        setDialogRows((rows) => recalcPagamentos(rows, v));
                      }
                    }}
                  />
                  <TextField
                    label="Valor Hora Faturado (R$)"
                    type="number"
                    inputProps={{ step: 0.01 }}
                    value={dialogRateBill}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value) || 0;
                      setDialogRateBill(v);
                      if (autoCalcBill) {
                        setDialogRows((rows) => recalcFaturamentos(rows, v));
                      }
                    }}
                  />

                  <FormControlLabel
                    control={
                      <Switch
                        checked={autoCalcPay}
                        onChange={(e) => {
                          const on = e.target.checked;
                          setAutoCalcPay(on);
                          if (on) setDialogRows((rows) => recalcPagamentos(rows, dialogRatePay));
                        }}
                      />
                    }
                    label="Recalcular Pagamento automaticamente"
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={autoCalcBill}
                        onChange={(e) => {
                          const on = e.target.checked;
                          setAutoCalcBill(on);
                          if (on) setDialogRows((rows) => recalcFaturamentos(rows, dialogRateBill));
                        }}
                      />
                    }
                    label="Recalcular Faturamento automaticamente"
                  />

                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={dialogFlags.producao_validada}
                        onChange={(e) => setDialogFlags((f) => ({ ...f, producao_validada: e.target.checked }))}
                      />
                    }
                    label="Produção Validada"
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={dialogFlags.pagamento_lancado}
                        onChange={(e) => setDialogFlags((f) => ({ ...f, pagamento_lancado: e.target.checked }))}
                      />
                    }
                    label="Pagamento Lançado"
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={dialogFlags.faturamento_validado}
                        onChange={(e) => setDialogFlags((f) => ({ ...f, faturamento_validado: e.target.checked }))}
                      />
                    }
                    label="Faturamento Validado"
                  />
                </Box>
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setDialogOpen(false)}>Cancelar</Button>
                <Button onClick={handleSaveDialog} variant="contained">
                  Salvar
                </Button>
              </DialogActions>
            </Dialog>

            {/* Dialog de Perfil */}
            <Dialog open={profileOpen} onClose={handleCloseProfile} maxWidth="sm" fullWidth>
              <DialogTitle>Editar perfil</DialogTitle>
              <DialogContent dividers sx={{ backgroundColor: 'background.paper' }}>
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2 }}>
                  <Avatar
                    src={avatarPreview || avatarUrl || undefined}
                    alt={displayName}
                    sx={{ width: 72, height: 72, bgcolor: 'primary.main' }}
                  >
                    {!avatarPreview && !avatarUrl ? fallbackInitial : null}
                  </Avatar>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={onPickAvatar}
                    />
                    <Button
                      variant="outlined"
                      startIcon={<PhotoCameraIcon />}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Escolher foto
                    </Button>
                    {avatarPreview && (
                      <Tooltip title="Limpar seleção">
                        <IconButton onClick={clearAvatarSelection}>
                          <ClearIcon />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>
                </Box>

                <TextField
                  label="Nome de exibição"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  fullWidth
                />

                {savingProfile && <Box sx={{ mt: 2 }}><LinearProgress /></Box>}
              </DialogContent>
              <DialogActions>
                <Button onClick={handleCloseProfile} disabled={savingProfile}>Cancelar</Button>
                <Button onClick={handleSaveProfile} variant="contained" disabled={savingProfile}>
                  Salvar
                </Button>
              </DialogActions>
            </Dialog>
          </>
        ) : (
          <Relatorios />
        )}
      </Box>
    </Box>
  );
}
