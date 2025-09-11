// src/Dashboard.js
import React, { useState, useEffect, useRef } from 'react';
import Relatorios from './Relatorios';
import Indicadores from './Indicadores';
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
  Snackbar,
  Alert,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import ExpandMoreIcon from '@mui/icons-material/KeyboardArrowRight';
import ExpandLessIcon from '@mui/icons-material/KeyboardArrowDown';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import ClearIcon from '@mui/icons-material/Clear';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import axios from 'axios';
import AcompanhamentoCassi from './AcompanhamentoCassi';

// Largura configurada (só influencia o Drawer temporário)
const drawerWidth = 260;

// Meses do menu lateral
const monthsList = [
  { value: '2025-09', label: 'Setembro'},
  { value: '2025-08', label: 'Agosto' },
  { value: '2025-07', label: 'Julho' },
  { value: '2025-06', label: 'Junho' },
  { value: '2025-05', label: 'Maio' },
];

export default function Dashboard({ userEmail, userName, navOpen, setNavOpen, onNavigate }) {
  // controla qual painel interno mostrar: "fopam" | "relatorios" | "indicadores" | "cassi"
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
  const [savingDialog, setSavingDialog] = useState(false);

  // autocálculo DESLIGADO por padrão
  const [autoCalcPay, setAutoCalcPay] = useState(false);
  const [autoCalcBill, setAutoCalcBill] = useState(false);

  // abas de menu FOPAM
  const [openYearMenu, setOpenYearMenu] = useState(false);
  const [openMesesMenu, setOpenMesesMenu] = useState(false);

  // --- Perfil (nome + avatar) ---
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileName, setProfileName] = useState(userName || '');
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const fileInputRef = useRef(null);

  // --- NF (novo diálogo) ---
  const [nfDialogOpen, setNfDialogOpen] = useState(false);
  const [nfRows, setNfRows] = useState([]); // {id, data_servico, nf_servico, nf_faturamento}
  const [savingNf, setSavingNf] = useState(false);

  // feedback global
  const [snackbar, setSnackbar] = useState({ open: false, severity: 'success', message: '' });

  useEffect(() => {
    setProfileName(userName || '');
  }, [userName]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const r = await axios.get('/user_info');
        if (mounted && r?.data?.avatar_url) setAvatarUrl(r.data.avatar_url);
        if (mounted && r?.data?.name && !userName) setProfileName(r.data.name);
      } catch {}
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

      datesMap[dateKey].totals.horas += h;
      datesMap[dateKey].totals.pagamento += p;
      datesMap[dateKey].totals.faturamento += f;

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

  // aplica preservação de estado de expansão
  const buildOpenState = (datesList, prevDates, prevProjects, preserve) => {
    const initDates = {};
    const initProjects = {};
    datesList.forEach((d) => {
      initDates[d.date] = preserve ? !!prevDates[d.date] : false;
      initProjects[d.date] = {};
      d.projects.forEach((p) => {
        const wasOpen = preserve && prevProjects[d.date] && prevProjects[d.date][p.project];
        initProjects[d.date][p.project] = !!wasOpen;
      });
    });
    return { initDates, initProjects };
  };

  // busca dados do backend
  const fetchData = async (mes, preserveOpen = false) => {
    const prevDates = preserveOpen ? { ...openDates } : {};
    const prevProjects = preserveOpen ? JSON.parse(JSON.stringify(openProjects || {})) : {};
    try {
      const res = await axios.get('/data', { params: { mes } });
      const raw = res.data || [];
      setData(raw);
      const { datesList, globalTotals } = buildHierarchy(raw);
      setHierarchy(datesList);
      setTotals(globalTotals);

      const { initDates, initProjects } = buildOpenState(datesList, prevDates, prevProjects, preserveOpen);
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
    if (selectedMonth) fetchData(selectedMonth, false);
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
    // Ordena as linhas por data (mais antiga -> mais nova)
    const rowsOrdered = (row.rows || [row]).slice().sort((a, b) => new Date(a.data_servico) - new Date(b.data_servico));
    setDialogGlobal({
      projeto: first.projeto || '',
      profissional: first.profissional || '',
      vinculo: first.vinculo || '',
      data_pagamento: first.data_pagamento || '',
      mes: first.mes || '',
    });
    const rowsArr = rowsOrdered.map((r) => ({
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

  // abrir diálogo NF para grupo (profissional) ou linha única
  const handleOpenNfDialog = (row) => {
    const rowsArr = (row.rows || [row]).map((r) => ({
      id: r.id,
      data_servico: r.data_servico,
      nf_servico: r.nf_servico || '',
      nf_faturamento: r.nf_faturamento || '',
    }));
    setNfRows(rowsArr);
    setNfDialogOpen(true);
  };

  // salvar (new/edit)
  const handleSaveDialog = async () => {
    try {
      setSavingDialog(true);
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
        // atualiza os campos "globais" em todas as linhas visíveis
        const ids = dialogRows.map((r) => r.id).filter(Boolean);
        if (ids.length) {
          await axios.post('/update_many', {
            ids,
            fields: {
              projeto: dialogGlobal.projeto,
              profissional: dialogGlobal.profissional,
              vinculo: dialogGlobal.vinculo,
              data_pagamento: dialogGlobal.data_pagamento,
              mes: dialogGlobal.mes,
              producao_validada: dialogFlags.producao_validada,
              pagamento_lancado: dialogFlags.pagamento_lancado,
              faturamento_validado: dialogFlags.faturamento_validado,
              valor_hora_pag: dialogRatePay,
              valor_hora_fat: dialogRateBill,
            },
          });
        }
        // atualiza horas/pag/fat linha a linha (pois variam)
        for (const r of dialogRows) {
          if (r.id) {
            await axios.post('/update', { id: r.id, field: 'data_servico', value: r.data_servico });
            await axios.post('/update', { id: r.id, field: 'horas', value: r.horas });
            await axios.post('/update', { id: r.id, field: 'pagamento', value: r.pagamento });
            await axios.post('/update', { id: r.id, field: 'faturamento', value: r.faturamento });
          } else {
            await axios.post('/add', {
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
            });
          }
        }
      }

      setDialogOpen(false);
      setSnackbar({ open: true, severity: 'success', message: 'Dados salvos com sucesso.' });
      await fetchData(selectedMonth, true); // preserva expansões
    } catch (err) {
      console.error('Erro ao salvar alterações:', err);
      setSnackbar({ open: true, severity: 'error', message: 'Falha ao salvar. Tente novamente.' });
    } finally {
      setSavingDialog(false);
    }
  };

  // salvar NF
  const handleSaveNf = async () => {
    try {
      setSavingNf(true);
      for (const r of nfRows) {
        await axios.post('/update', { id: r.id, field: 'nf_servico', value: r.nf_servico || null });
        await axios.post('/update', { id: r.id, field: 'nf_faturamento', value: r.nf_faturamento || null });
      }
      setNfDialogOpen(false);
      setSnackbar({ open: true, severity: 'success', message: 'Dados incluídos com sucesso.' });
      await fetchData(selectedMonth, true);
    } catch (err) {
      console.error('Erro ao incluir NFs:', err);
      setSnackbar({ open: true, severity: 'error', message: 'Falha ao incluir NFs. Tente novamente.' });
    } finally {
      setSavingNf(false);
    }
  };

  // atualizar flags booleanos
  const handleBoolChange = async (idOrObj, field, value) => {
    try {
      if (typeof idOrObj === 'object' && Array.isArray(idOrObj.ids)) {
        await Promise.all(idOrObj.ids.map((rid) => axios.post('/update', { id: rid, field, value })));
        await fetchData(selectedMonth, true); // preserva expansões
      } else {
        await axios.post('/update', { id: idOrObj, field, value });
        // update otimista e depois refetch preservando expansão
        setData((prev) => prev.map((r) => (r.id === idOrObj ? { ...r, [field]: value } : r)));
        await fetchData(selectedMonth, true);
      }
      setSnackbar({ open: true, severity: 'success', message: 'Atualizado.' });
    } catch (err) {
      console.error('Erro ao atualizar campo booleano:', err);
      setSnackbar({ open: true, severity: 'error', message: 'Falha ao atualizar.' });
    }
  };

  // excluir (com confirmação)
  const handleDeleteRow = async (row) => {
    const many = row.ids && Array.isArray(row.ids);
    const msg = many
      ? `Deseja excluir ${row.ids.length} registro(s) deste profissional?`
      : 'Deseja excluir este registro?';
    if (!window.confirm(msg)) return;

    try {
      if (many) {
        await axios.post('/delete_many', { ids: row.ids });
      } else if (row.id) {
        await axios.post('/delete', { id: row.id });
      }
      setSnackbar({ open: true, severity: 'success', message: 'Registro(s) excluído(s).' });
      await fetchData(selectedMonth, true);
    } catch (err) {
      console.error('Erro ao excluir registro:', err);
      setSnackbar({ open: true, severity: 'error', message: 'Falha ao excluir.' });
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
      const trimmed = (profileName || '').trim();
      if (trimmed && trimmed !== userName) {
        await axios.post('/profile', { name: trimmed });
      }
      if (avatarFile) {
        const fd = new FormData();
        fd.append('file', avatarFile);
        const resp = await axios.post('/profile/avatar', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        if (resp?.data?.avatar_url) setAvatarUrl(resp.data.avatar_url);
      }
      setSavingProfile(false);
      handleCloseProfile();
      try { await axios.get('/user_info'); } catch {}
      setSnackbar({ open: true, severity: 'success', message: 'Perfil atualizado.' });
    } catch (err) {
      console.error('Erro ao salvar perfil:', err);
      setSavingProfile(false);
      setSnackbar({ open: true, severity: 'error', message: 'Falha ao atualizar perfil.' });
    }
  };

  const fallbackInitial = (displayName || ' ').trim().charAt(0).toUpperCase();

  // ===== Drawer retrátil (temporário) =====
  const handleNavigate = (nextPane) => {
    setPainelAtivo(nextPane);
    onNavigate?.(); // fecha o drawer
  };
  const handlePickMonth = (m) => {
    setSelectedMonth(m);
    onNavigate?.(); // fecha o drawer
  };

  return (
    <Box sx={{ display: 'flex' }}>
      <Drawer
        variant="temporary"
        open={navOpen}
        onClose={() => setNavOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          '& .MuiDrawer-paper': { width: drawerWidth, boxSizing: 'border-box' }
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
          <ListItemButton selected={painelAtivo === 'fopam'} onClick={() => handleNavigate('fopam')}>
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
                          onClick={() => handlePickMonth(month.value)}
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

          <ListItemButton selected={painelAtivo === 'relatorios'} onClick={() => handleNavigate('relatorios')}>
            <ListItemText primary="Relatórios" />
          </ListItemButton>

          <ListItemButton selected={painelAtivo === 'indicadores'} onClick={() => handleNavigate('indicadores')}>
            <ListItemText primary="Indicadores" />
          </ListItemButton>

          <ListItemButton selected={painelAtivo === 'cassi'} onClick={() => handleNavigate('cassi')}>
            <ListItemText primary="Acompanhamento CASSI" />
          </ListItemButton>
        </List>
      </Drawer>

      {/* Conteúdo principal não precisa de margem quando o Drawer é temporário */}
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
                                              <IconButton size="small" onClick={() => handleOpenEdit(prof)} title="Editar">
                                                <EditIcon fontSize="small" />
                                              </IconButton>
                                              <IconButton size="small" onClick={() => handleOpenNfDialog(prof)} title="Incluir NF">
                                                <ReceiptLongIcon fontSize="small" />
                                              </IconButton>
                                              <IconButton size="small" onClick={() => handleDeleteRow(prof)} title="Excluir">
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
                    TOTAL — Horas: {totals.horas} | Pagamento{' '}
                    {totals.pagamento.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} | Faturamento{' '}
                    {totals.faturamento.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </Typography>
                </Box>
              </>
            ) : (
              <Typography variant="body1">Selecione um mês no menu para começar.</Typography>
            )}

            {/* Dialog de novo/editar produção */}
            <Dialog open={dialogOpen} onClose={() => (savingDialog ? null : setDialogOpen(false))} maxWidth="md" fullWidth>
              <DialogTitle>{dialogMode === 'new' ? 'Nova Produção' : 'Editar Produção'}</DialogTitle>
              <DialogContent dividers sx={{ backgroundColor: 'background.paper' }}>
                {savingDialog && (
                  <Box sx={{ mb: 2 }}>
                    <LinearProgress />
                    <Typography variant="body2" sx={{ mt: 1 }}>Carregando dados...</Typography>
                  </Box>
                )}
                <Box component="form" sx={{ display: 'flex', flexDirection: 'column', gap: 2, opacity: savingDialog ? 0.6 : 1 }}>
                  <TextField
                    label="Projeto"
                    value={dialogGlobal.projeto || ''}
                    onChange={(e) => setDialogGlobal((prev) => ({ ...prev, projeto: e.target.value }))}
                    fullWidth
                    disabled={savingDialog}
                  />
                  <TextField
                    label="Profissional"
                    value={dialogGlobal.profissional || ''}
                    onChange={(e) => setDialogGlobal((prev) => ({ ...prev, profissional: e.target.value }))}
                    fullWidth
                    disabled={savingDialog}
                  />
                  <TextField
                    label="Vínculo"
                    value={dialogGlobal.vinculo || ''}
                    onChange={(e) => setDialogGlobal((prev) => ({ ...prev, vinculo: e.target.value }))}
                    fullWidth
                    disabled={savingDialog}
                  />
                  <TextField
                    label="Data Pagamento"
                    type="date"
                    value={dialogGlobal.data_pagamento || ''}
                    onChange={(e) => setDialogGlobal((prev) => ({ ...prev, data_pagamento: e.target.value }))}
                    InputLabelProps={{ shrink: true }}
                    disabled={savingDialog}
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
                              disabled={savingDialog}
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
                              disabled={savingDialog}
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
                              disabled={autoCalcPay || savingDialog}
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
                              disabled={autoCalcBill || savingDialog}
                            />
                          </TableCell>
                          <TableCell align="center">
                            <IconButton
                              disabled={savingDialog}
                              onClick={() =>
                                setDialogRows((rows) => rows.filter((_, i) => i !== idx))
                              }
                            >
                              <DeleteIcon />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  <Button
                    startIcon={<AddIcon />}
                    disabled={savingDialog}
                    onClick={() =>
                      setDialogRows((rows) => [
                        ...rows,
                        {
                          id: null,
                          data_servico: dialogGlobal.data_pagamento || `${selectedMonth || ''}-01`,
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
                      if (autoCalcPay) setDialogRows((rows) => recalcPagamentos(rows, v));
                    }}
                    disabled={savingDialog}
                  />
                  <TextField
                    label="Valor Hora Faturado (R$)"
                    type="number"
                    inputProps={{ step: 0.01 }}
                    value={dialogRateBill}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value) || 0;
                      setDialogRateBill(v);
                      if (autoCalcBill) setDialogRows((rows) => recalcFaturamentos(rows, v));
                    }}
                    disabled={savingDialog}
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
                        disabled={savingDialog}
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
                        disabled={savingDialog}
                      />
                    }
                    label="Recalcular Faturamento automaticamente"
                  />

                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={dialogFlags.producao_validada}
                        onChange={(e) => setDialogFlags((f) => ({ ...f, producao_validada: e.target.checked }))}
                        disabled={savingDialog}
                      />
                    }
                    label="Produção Validada"
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={dialogFlags.pagamento_lancado}
                        onChange={(e) => setDialogFlags((f) => ({ ...f, pagamento_lancado: e.target.checked }))}
                        disabled={savingDialog}
                      />
                    }
                    label="Pagamento Lançado"
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={dialogFlags.faturamento_validado}
                        onChange={(e) => setDialogFlags((f) => ({ ...f, faturamento_validado: e.target.checked }))}
                        disabled={savingDialog}
                      />
                    }
                    label="Faturamento Validado"
                  />
                </Box>
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setDialogOpen(false)} disabled={savingDialog}>Cancelar</Button>
                <Button onClick={handleSaveDialog} variant="contained" disabled={savingDialog}>
                  {savingDialog ? 'Salvando...' : 'Salvar'}
                </Button>
              </DialogActions>
            </Dialog>

            {/* Dialog de NF */}
            <Dialog open={nfDialogOpen} onClose={() => (savingNf ? null : setNfDialogOpen(false))} maxWidth="sm" fullWidth>
              <DialogTitle>Incluir NF de Serviço / Faturamento</DialogTitle>
              <DialogContent dividers sx={{ backgroundColor: 'background.paper' }}>
                {savingNf && (
                  <Box sx={{ mb: 2 }}>
                    <LinearProgress />
                    <Typography variant="body2" sx={{ mt: 1 }}>Carregando dados...</Typography>
                  </Box>
                )}
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Data do Serviço</TableCell>
                      <TableCell>NF Serviço</TableCell>
                      <TableCell>NF Faturamento</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {nfRows.map((r, idx) => (
                      <TableRow key={r.id || idx}>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          <TextField type="date" value={r.data_servico} InputLabelProps={{ shrink: true }} disabled fullWidth />
                        </TableCell>
                        <TableCell>
                          <TextField
                            value={r.nf_servico}
                            onChange={(e) => {
                              const v = e.target.value;
                              setNfRows((rows) => {
                                const nr = [...rows];
                                nr[idx].nf_servico = v;
                                return nr;
                              });
                            }}
                            placeholder="Número / link / referência"
                            disabled={savingNf}
                            fullWidth
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            value={r.nf_faturamento}
                            onChange={(e) => {
                              const v = e.target.value;
                              setNfRows((rows) => {
                                const nr = [...rows];
                                nr[idx].nf_faturamento = v;
                                return nr;
                              });
                            }}
                            placeholder="Número / link / referência"
                            disabled={savingNf}
                            fullWidth
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setNfDialogOpen(false)} disabled={savingNf}>Cancelar</Button>
                <Button onClick={handleSaveNf} variant="contained" disabled={savingNf}>
                  {savingNf ? 'Salvando...' : 'Salvar'}
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
        ) : painelAtivo === 'relatorios' ? (
          <Relatorios />
        ) : painelAtivo === 'indicadores' ? (
          <Indicadores />
        ) : (
          <AcompanhamentoCassi />
        )}
      </Box>

      {/* Snackbar global */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Alert onClose={() => setSnackbar((s) => ({ ...s, open: false }))} severity={snackbar.severity} variant="filled">
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
