// src/Dashboard.js
import React, { useState, useEffect, useRef } from 'react';
import Relatorios from './Relatorios';
import Indicadores from './Indicadores';
import Underwriting from './Underwriting';
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
  TablePagination,
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
  MenuItem,
  Select,
  Autocomplete,
  Chip,
  CircularProgress,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import ExpandMoreIcon from '@mui/icons-material/KeyboardArrowRight';
import ExpandLessIcon from '@mui/icons-material/KeyboardArrowDown';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import ClearIcon from '@mui/icons-material/Clear';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import axios from 'axios';
import AcompanhamentoCassi from './AcompanhamentoCassi';
import CampaignIcon from '@mui/icons-material/Campaign';
import PeopleIcon from '@mui/icons-material/People';
import SaveIcon from '@mui/icons-material/Save';
import RefreshIcon from '@mui/icons-material/Refresh';

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

  // NOVOS: exclusões no modal + confirmação
  const [deletedIds, setDeletedIds] = useState([]);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

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

  // --- WhatsApp (enviar confirmação de produção) ---
  const [waDialogOpen, setWaDialogOpen] = useState(false);
  const [waDialogRow, setWaDialogRow] = useState(null);
  const [waSending, setWaSending] = useState(false);

  // --- Envio em massa (validar produções) ---
  const [massDialogOpen, setMassDialogOpen] = useState(false);
  const [massTipoData, setMassTipoData] = useState('pagamento');
  const [projetosOptions, setProjetosOptions] = useState([]);
  const [projetosSelecionados, setProjetosSelecionados] = useState([]);
  const [massSending, setMassSending] = useState(false);
  const todayIso = new Date().toISOString().slice(0,10);
  const [massStart, setMassStart] = useState(todayIso);
  const [massEnd, setMassEnd] = useState(todayIso);

  // --- Médicos (aba de contatos) ---
  const [medicos, setMedicos] = useState([]);
  const [medicosLoading, setMedicosLoading] = useState(false);
  const [medicosPage, setMedicosPage] = useState(0);
  const [medicosRowsPerPage, setMedicosRowsPerPage] = useState(50);
  const [medicosTotal, setMedicosTotal] = useState(0);
  const [medicoQuery, setMedicoQuery] = useState('');
  const [medicoQueryDebounced, setMedicoQueryDebounced] = useState('');

  // NOVOS CAMPOS WhatsApp dialog
  const [waStart, setWaStart] = useState('');
  const [waEnd, setWaEnd] = useState('');
  const [waTipoData, setWaTipoData] = useState('servico');
  const [waPhone, setWaPhone] = useState('');

  // --- Opções de médicos para Autocomplete (vínculo medico_id) ---
  const [medicosOptions, setMedicosOptions] = useState([]);
  const [medicosLoadingList, setMedicosLoadingList] = useState(false);

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
  }, []);

  // Carrega opções de médicos (para o Autocomplete do modal)
  const loadMedicosOptions = async () => {
    setMedicosLoadingList(true);
    try {
      const r = await axios.get('/medicos/all', { params: { page_size: 1000 } });
      const arr = Array.isArray(r?.data?.items) ? r.data.items : (Array.isArray(r?.data) ? r.data : []);
      setMedicosOptions(
        arr
          .filter(x => x?.id && x?.profissional)
          .map(x => ({ id: x.id, label: x.profissional }))
          .sort((a,b) => a.label.localeCompare(b.label))
      );
    } catch (e) {
      console.error('Erro ao carregar opções de médicos', e);
      setMedicosOptions([]);
    } finally {
      setMedicosLoadingList(false);
    }
  };

  useEffect(() => {
    loadMedicosOptions();
  }, []);

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

  // busca dados do backend (FOPAM)
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
    setDeletedIds([]);
    setDialogGlobal({
      projeto: '',
      profissional: '',
      vinculo: '',
      data_pagamento: `${selectedMonth}-01`,
      mes: `${selectedMonth}-01`,
      medico_id: null,
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
    setDeletedIds([]);
    const first = row.rows?.[0] || row;
    const rowsOrdered = (row.rows || [row]).slice().sort((a, b) => new Date(a.data_servico) - new Date(b.data_servico));
    setDialogGlobal({
      projeto: first.projeto || '',
      profissional: first.profissional || '',
      vinculo: first.vinculo || '',
      data_pagamento: first.data_pagamento || '',
      mes: first.mes || '',
      medico_id: first.medico_id || null,
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

  // ======== SALVAR COM CONFIRMAÇÃO DE EXCLUSÕES ========
  const handleRequestSaveDialog = () => {
    if (dialogMode === 'edit' && deletedIds.length > 0) {
      setConfirmDeleteOpen(true);
      return;
    }
    handleSaveDialogInternal();
  };
  const handleConfirmDeleteAndSave = async () => {
    setConfirmDeleteOpen(false);
    await handleSaveDialogInternal(true);
  };
  const handleSaveDialogInternal = async (confirmed = false) => {
    try {
      setSavingDialog(true);
      if (dialogMode === 'edit' && deletedIds.length > 0 && !confirmed) {
        setConfirmDeleteOpen(true);
        setSavingDialog(false);
        return;
      }
      if (dialogMode === 'edit' && deletedIds.length > 0) {
        await axios.post('/delete_many', { ids: deletedIds });
      }
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
            medico_id: dialogGlobal.medico_id || null,
          };
          await axios.post('/add', payload);
        }
      } else {
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
              medico_id: dialogGlobal.medico_id || null,
            },
          });
        }
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
              medico_id: dialogGlobal.medico_id || null,
            });
          }
        }
      }
      setDialogOpen(false);
      setDeletedIds([]);
      setSnackbar({ open: true, severity: 'success', message: 'Dados salvos com sucesso.' });
      await fetchData(selectedMonth, true);
    } catch (err) {
      console.error('Erro ao salvar alterações:', err);
      setSnackbar({ open: true, severity: 'error', message: 'Falha ao salvar. Tente novamente.' });
    } finally {
      setSavingDialog(false);
    }
  };

  const handleBoolChange = async (idOrObj, field, value) => {
    try {
      if (typeof idOrObj === 'object' && Array.isArray(idOrObj.ids)) {
        await Promise.all(idOrObj.ids.map((rid) => axios.post('/update', { id: rid, field, value })));
        await fetchData(selectedMonth, true);
      } else {
        await axios.post('/update', { id: idOrObj, field, value });
        setData((prev) => prev.map((r) => (r.id === idOrObj ? { ...r, [field]: value } : r)));
        await fetchData(selectedMonth, true);
      }
      setSnackbar({ open: true, severity: 'success', message: 'Atualizado.' });
    } catch (err) {
      console.error('Erro ao atualizar campo booleano:', err);
      setSnackbar({ open: true, severity: 'error', message: 'Falha ao atualizar.' });
    }
  };

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

  // --- Perfil
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

  // --- WhatsApp
  const handleOpenWaDialog = (row) => {
    setWaDialogRow(row);
    setWaStart('');
    setWaEnd('');
    setWaTipoData('servico');
    setWaPhone('');
    setWaDialogOpen(true);
  };
  const handleSendWhatsApp = async () => {
    if (!waDialogRow) return;
    setWaSending(true);
    try {
      const payload = {
        profissional: waDialogRow.profissional,
        ...(waPhone ? { phone: waPhone.replace(/\D/g, '') } : {}),
        ...(waStart ? { start: waStart } : {}),
        ...(waEnd ? { end: waEnd } : {}),
        ...(waTipoData ? { tipo_data: waTipoData } : {}),
      };
      const r = await axios.post('/whatsapp/send-confirmation', payload);
      setSnackbar({ open: true, severity: 'success', message: r?.data?.message || 'Mensagem enviada no WhatsApp!' });
      setWaDialogOpen(false);
    } catch (err) {
      const msg = err?.response?.data?.error || 'Falha ao enviar WhatsApp.';
      setSnackbar({ open: true, severity: 'error', message: msg });
    } finally {
      setWaSending(false);
    }
  };

  const fetchProjetos = async () => {
    try {
      const r = await axios.get('/projetos');
      setProjetosOptions(r?.data || []);
    } catch (e) {
      console.error('Erro ao listar projetos:', e);
    }
  };

  const handleOpenMassDialog = async () => {
    await fetchProjetos();
    setProjetosSelecionados([]);
    const t = new Date().toISOString().slice(0,10);
    setMassStart(t);
    setMassEnd(t);
    setMassDialogOpen(true);
  };

  const handleMassSend = async () => {
    if (!selectedMonth) {
      setSnackbar({ open: true, severity: 'warning', message: 'Selecione um mês antes.' });
      return;
    }
    if (!massStart || !massEnd) {
      setSnackbar({ open: true, severity: 'warning', message: 'Informe início e fim do período.' });
      return;
    }
    const targetProjects = (projetosSelecionados.length ? projetosSelecionados : projetosOptions) || [];

    setMassSending(true);
    try {
      const uniqueSet = new Set();
      for (const proj of targetProjects) {
        const campoIni = massTipoData === 'pagamento' ? 'data_pagamento_from' : 'data_servico_from';
        const campoFim = massTipoData === 'pagamento' ? 'data_pagamento_to'   : 'data_servico_to';
        const params = {
          mes: selectedMonth,
          projeto: proj,
          [campoIni]: massStart,
          [campoFim]: massEnd,
        };
        const r = await axios.get('/data', { params });
        const rows = r?.data || [];
        rows.forEach((it) => {
          const nome = (it.profissional || '').trim();
          if (nome) uniqueSet.add(nome);
        });
      }

      const profissionais = Array.from(uniqueSet);
      if (!profissionais.length) {
        setSnackbar({ open: true, severity: 'info', message: 'Nenhum profissional encontrado para os filtros.' });
        return;
      }

      let ok = 0, fail = 0;
      for (const nome of profissionais) {
        try {
          await axios.post('/whatsapp/send-confirmation', {
            profissional: nome,
            tipo_data: massTipoData,
            start: massStart,
            end: massEnd,
          });
          ok++;
        } catch {
          fail++;
        }
      }

      setSnackbar({
        open: true,
        severity: fail ? 'warning' : 'success',
        message:
          `WhatsApp enviado: ${ok} sucesso${ok !== 1 ? 's' : ''}` +
          (fail ? `, ${fail} falha${fail !== 1 ? 's' : ''}` : '') +
          '.'
      });

      setMassDialogOpen(false);
    } catch (err) {
      console.error(err);
      setSnackbar({ open: true, severity: 'error', message: 'Erro no envio em massa.' });
    } finally {
      setMassSending(false);
    }
  };

  // ---------- ABA MÉDICOS ----------

  // Debounce da busca
  useEffect(() => {
    const t = setTimeout(() => setMedicoQueryDebounced(medicoQuery), 400);
    return () => clearTimeout(t);
  }, [medicoQuery]);

  // Buscar dados de médicos
  const fetchMedicos = async () => {
    setMedicosLoading(true);
    try {
      const params = {
        page: medicosPage,
        page_size: medicosRowsPerPage,
      };
      if (medicoQueryDebounced && medicoQueryDebounced.trim()) {
        params.q = medicoQueryDebounced.trim();
      }
      const r = await axios.get('/medicos/all', { params });

      let items = [];
      let total = 0;

      if (r?.data && Array.isArray(r.data.items)) {
        items = r.data.items;
        total = Number.isFinite(r.data.total) ? r.data.total : r.data.items.length;
      } else if (Array.isArray(r?.data)) {
        items = r.data;
        total = r.data.length;
      }

      setMedicos(items || []);
      setMedicosTotal(total || 0);
    } catch (e) {
      console.error('Erro ao listar medicos:', e);
      setMedicos([]);
      setMedicosTotal(0);
    } finally {
      setMedicosLoading(false);
    }
  };

  useEffect(() => {
    if (painelAtivo === 'medicos') fetchMedicos();

  }, [painelAtivo, medicosPage, medicosRowsPerPage, medicoQueryDebounced]);

  const handleChangeMedicosPage = (_e, newPage) => {
    setMedicosPage(newPage);
  };
  const handleChangeMedicosRowsPerPage = (e) => {
    setMedicosRowsPerPage(parseInt(e.target.value, 10));
    setMedicosPage(0);
  };

  const syncMedicos = async () => {
    try {
      await axios.post('/medicos/sync-from-fopam');
      setSnackbar({ open: true, severity: 'success', message: 'Sincronizado com FOPAM.' });
      await fetchMedicos();
    } catch (e) {
      console.error(e);
      setSnackbar({ open: true, severity: 'error', message: 'Falha ao sincronizar.' });
    }
  };

// handler novo
const handleExportMedicos = async () => {
  try {
    const res = await axios.get('/medicos/export', { responseType: 'blob' });
    const blob = new Blob([res.data], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'medicos.xlsx';
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  } catch (err) {
    console.error('Erro ao exportar médicos:', err);
    setSnackbar({ open: true, severity: 'error', message: 'Falha ao exportar médicos.' });
  }
};


  const saveMedicoContato = async (idx) => {
    const row = medicos[idx];
    try {
      await axios.post('/medicos/upsert', {
        profissional: row.profissional,
        telefone: row.telefone,
        email: row.email,
        cpf: row.cpf,
        vinculo: row.vinculo,
        cnpj: row.cnpj,
        cidade: row.cidade,
        estado: row.estado,
        status: row.status,
      });
      setSnackbar({ open: true, severity: 'success', message: 'Contato salvo.' });
      // opcional recarregar a página atual
      // await fetchMedicos();
    } catch (e) {
      console.error(e);
      setSnackbar({ open: true, severity: 'error', message: 'Falha ao salvar contato.' });
    }
  };

  const fallbackInitial = (displayName || ' ').trim().charAt(0).toUpperCase();

  // ===== Drawer retrátil (temporário) =====
  const handleNavigate = (nextPane) => {
    setPainelAtivo(nextPane);
    onNavigate?.();
  };
  const handlePickMonth = (m) => {
    setSelectedMonth(m);
    onNavigate?.();
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

          <ListItemButton selected={painelAtivo === 'medicos'} onClick={() => { setPainelAtivo('medicos'); onNavigate?.(); }}>
            <PeopleIcon fontSize="small" style={{ marginRight: 8 }} />
            <ListItemText primary="Médicos" />
          </ListItemButton>

          {/* Nova aba de Underwriting / Exames */}
          <ListItemButton selected={painelAtivo === 'uw'} onClick={() => handleNavigate('uw')}>
            <ListItemText primary="Exames" />
          </ListItemButton>

        </List>
      </Drawer>

      {/* Conteúdo principal */}
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
                  <Button variant="outlined" startIcon={<CampaignIcon />} onClick={handleOpenMassDialog} disabled={!selectedMonth}>
                    Validar produções
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
                                    Dia {dia} — ({projCount} projetos) — Horas: {totHoras.toLocaleString('pt-BR')} — Pag{' '}
                                    {totPag.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} — Fat{' '}
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
                                              <IconButton size="small" onClick={() => handleOpenWaDialog(prof)} title="Enviar WhatsApp">
                                                <WhatsAppIcon fontSize="small" />
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

                  {/* NEW: Vincular ao cadastro de médicos (opcional) */}
                  <Autocomplete
                    options={medicosOptions}
                    loading={medicosLoadingList}
                    value={
                      dialogGlobal.medico_id
                        ? medicosOptions.find(o => o.id === dialogGlobal.medico_id) || null
                        : null
                    }
                    onChange={(_, val) => {
                      setDialogGlobal(prev => ({
                        ...prev,
                        medico_id: val?.id || null,
                        profissional: prev.profissional || val?.label || prev.profissional,
                      }));
                    }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Médico (cadastro) — opcional"
                        placeholder="Vincular ao cadastro"
                        InputProps={{
                          ...params.InputProps,
                          endAdornment: (
                            <>
                              {medicosLoadingList ? <CircularProgress size={18} /> : null}
                              {params.InputProps.endAdornment}
                            </>
                          ),
                        }}
                      />
                    )}
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
                                setDialogRows((rows) => {
                                  const target = rows[idx];
                                  if (target?.id) {
                                    setDeletedIds((prev) => Array.from(new Set([...prev, target.id])));
                                  }
                                  return rows.filter((_, i) => i !== idx);
                                })
                              }
                              title="Remover linha"
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
                <Button onClick={handleRequestSaveDialog} variant="contained" disabled={savingDialog}>
                  {savingDialog ? 'Salvando...' : 'Salvar'}
                </Button>
              </DialogActions>
            </Dialog>

            {/* Diálogo de confirmação de exclusões no modal */}
            <Dialog open={confirmDeleteOpen} onClose={() => setConfirmDeleteOpen(false)} maxWidth="xs" fullWidth>
              <DialogTitle>Confirmar exclusões</DialogTitle>
              <DialogContent dividers>
                <Typography>
                  Você removeu <b>{deletedIds.length}</b> {deletedIds.length === 1 ? 'linha' : 'linhas'} desta edição.
                  Ao salvar, esses registros serão <b>excluídos definitivamente</b> do banco.
                </Typography>
                <Typography sx={{ mt: 1 }}>
                  Deseja prosseguir?
                </Typography>
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setConfirmDeleteOpen(false)}>Voltar</Button>
                <Button color="error" variant="contained" onClick={handleConfirmDeleteAndSave}>
                  Excluir e salvar
                </Button>
              </DialogActions>
            </Dialog>

            {/* Dialog de WhatsApp */}
            <Dialog open={waDialogOpen} onClose={() => (waSending ? null : setWaDialogOpen(false))} maxWidth="sm" fullWidth>
              <DialogTitle>Enviar confirmação via WhatsApp</DialogTitle>
              <DialogContent dividers sx={{ backgroundColor: 'background.paper' }}>
                {waSending && (
                  <Box sx={{ mb: 2 }}>
                    <LinearProgress />
                    <Typography variant="body2" sx={{ mt: 1 }}>Enviando…</Typography>
                  </Box>
                )}
                <Typography>
                  Confirma o envio da mensagem de confirmação de produção para
                  <b> {waDialogRow?.profissional}</b>?
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Se você não informar datas, será usado automaticamente o período da semana passada.
                  O médico receberá as datas/horas/valores do período e dois botões:
                  <i> “Sim”</i> e <i>“Solicitar ajustes”</i>.
                </Typography>

                <Box sx={{ mt: 2, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                  <TextField
                    label="Início (YYYY-MM-DD)"
                    type="date"
                    value={waStart}
                    onChange={(e) => setWaStart(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    disabled={waSending}
                  />
                  <TextField
                    label="Fim (YYYY-MM-DD)"
                    type="date"
                    value={waEnd}
                    onChange={(e) => setWaEnd(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    disabled={waSending}
                  />
                </Box>

                <Box sx={{ mt: 2, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                  <TextField
                    select
                    label="Tipo de data"
                    value={waTipoData}
                    onChange={(e) => setWaTipoData(e.target.value)}
                    disabled={waSending}
                  >
                    <MenuItem value="servico">Data de serviço</MenuItem>
                    <MenuItem value="pagamento">Data de pagamento</MenuItem>
                  </TextField>

                  <TextField
                    label="Telefone (opcional)"
                    placeholder="Ex.: 11999999999 ou +55 11 99999-9999"
                    value={waPhone}
                    onChange={(e) => setWaPhone(e.target.value)}
                    helperText="Se vazio, usa o telefone do cadastro"
                    disabled={waSending}
                  />
                </Box>
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setWaDialogOpen(false)} disabled={waSending}>Cancelar</Button>
                <Button variant="contained" onClick={handleSendWhatsApp} disabled={waSending}>
                  {waSending ? 'Enviando…' : 'Enviar'}
                </Button>
              </DialogActions>
            </Dialog>
            
            {/* Dialog de validação em massa */}
            <Dialog open={massDialogOpen} onClose={() => (massSending ? null : setMassDialogOpen(false))} maxWidth="sm" fullWidth>
              <DialogTitle>Validar produções (envio em massa)</DialogTitle>
              <DialogContent dividers sx={{ backgroundColor: 'background.paper' }}>
                {massSending && (
                  <Box sx={{ mb: 2 }}>
                    <LinearProgress />
                    <Typography variant="body2" sx={{ mt: 1 }}>Enviando…</Typography>
                  </Box>
                )}

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {/* período */}
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                    <TextField
                      label="Início"
                      type="date"
                      value={massStart}
                      onChange={(e) => setMassStart(e.target.value)}
                      InputLabelProps={{ shrink: true }}
                    />
                    <TextField
                      label="Fim"
                      type="date"
                      value={massEnd}
                      onChange={(e) => setMassEnd(e.target.value)}
                      InputLabelProps={{ shrink: true }}
                    />
                  </Box>

                  <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                    <Typography variant="body2">Tipo de data:</Typography>
                    <Select
                      size="small"
                      value={massTipoData}
                      onChange={(e) => setMassTipoData(e.target.value)}
                    >
                      <MenuItem value="pagamento">Data de pagamento</MenuItem>
                      <MenuItem value="servico">Data de serviço</MenuItem>
                    </Select>
                  </Box>

                  <Autocomplete
                    multiple
                    options={projetosOptions}
                    value={projetosSelecionados}
                    onChange={(_, v) => setProjetosSelecionados(v)}
                    renderTags={(value, getTagProps) =>
                      value.map((option, index) => (
                        <Chip variant="outlined" label={option} {...getTagProps({ index })} />
                      ))
                    }
                    renderInput={(params) => <TextField {...params} label="Projetos (vazio = todos)" />}
                  />

                  <Alert severity="info">
                    Serão considerados os profissionais que têm produção <b>no período selecionado</b> (de acordo com o tipo de data).<br />
                    Se nenhum projeto for escolhido, enviaremos para <b>todos</b> os projetos do mês selecionado.
                  </Alert>
                </Box>
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setMassDialogOpen(false)} disabled={massSending}>Cancelar</Button>
                <Button onClick={handleMassSend} variant="contained" disabled={massSending || !selectedMonth}>
                  {massSending ? 'Enviando…' : 'Enviar'}
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
      ) : painelAtivo === 'uw' ? (
        <Underwriting />
      ) : painelAtivo === 'relatorios' ? (
        <Relatorios />
      ) : painelAtivo === 'indicadores' ? (
        <Indicadores />
      ) : painelAtivo === 'medicos' ? (
        <>
          <Typography variant="h5" gutterBottom>
            Médicos — Contatos
          </Typography>

          <Box sx={{ display: 'flex', gap: 1, mb: 2, alignItems: 'center' }}>
            <Button variant="outlined" startIcon={<RefreshIcon />} onClick={syncMedicos}>
              Sincronizar com FOPAM
            </Button>

            {/* NOVO: botão de exportação */}
            <Button variant="outlined" onClick={handleExportMedicos}>
              Exportar cadastro
            </Button>

            <TextField
              size="small"
              label="Pesquisar médico (servidor)"
              value={medicoQuery}
              onChange={(e) => {
                setMedicoQuery(e.target.value);
                setMedicosPage(0);
              }}
              placeholder="Nome, e-mail ou telefone"
            />
          </Box>


          {medicosLoading ? (
            <Box sx={{ py: 4, display: 'flex', justifyContent: 'center' }}><CircularProgress /></Box>
          ) : (
            <Paper sx={{ borderRadius: 2, overflow: 'hidden' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>Profissional</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Telefone</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>E-mail</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>WhatsApp (normalizado)</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>CPF</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Vínculo</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>CNPJ</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Cidade</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Estado</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Status</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 'bold' }}>Ações</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(medicos || []).map((m, idx) => (
                    <TableRow key={m.id || m.profissional || idx}>
                      <TableCell sx={{ minWidth: 240 }}>{m.profissional}</TableCell>

                      <TableCell sx={{ minWidth: 160 }}>
                        <TextField
                          size="small"
                          value={m.telefone || ''}
                          onChange={(e) => {
                            const v = e.target.value;
                            setMedicos((prev) => {
                              const cp = [...prev];
                              cp[idx] = { ...cp[idx], telefone: v };
                              return cp;
                            });
                          }}
                        />
                      </TableCell>

                      <TableCell sx={{ minWidth: 220 }}>
                        <TextField
                          size="small"
                          type="email"
                          value={m.email || ''}
                          onChange={(e) => {
                            const v = e.target.value;
                            setMedicos((prev) => {
                              const cp = [...prev];
                              cp[idx] = { ...cp[idx], email: v };
                              return cp;
                            });
                          }}
                        />
                      </TableCell>

                      <TableCell sx={{ color: 'text.secondary' }}>{m.whatsapp || '-'}</TableCell>

                      <TableCell sx={{ minWidth: 140 }}>
                        <TextField
                          size="small"
                          value={m.cpf || ''}
                          onChange={(e) => {
                            const v = e.target.value;
                            setMedicos((prev) => {
                              const cp = [...prev];
                              cp[idx] = { ...cp[idx], cpf: v };
                              return cp;
                            });
                          }}
                        />
                      </TableCell>

                      <TableCell sx={{ minWidth: 140 }}>
                        <TextField
                          size="small"
                          value={m.vinculo || ''}
                          onChange={(e) => {
                            const v = e.target.value;
                            setMedicos((prev) => {
                              const cp = [...prev];
                              cp[idx] = { ...cp[idx], vinculo: v };
                              return cp;
                            });
                          }}
                        />
                      </TableCell>

                      <TableCell sx={{ minWidth: 140 }}>
                        <TextField
                          size="small"
                          value={m.cnpj || ''}
                          onChange={(e) => {
                            const v = e.target.value;
                            setMedicos((prev) => {
                              const cp = [...prev];
                              cp[idx] = { ...cp[idx], cnpj: v };
                              return cp;
                            });
                          }}
                        />
                      </TableCell>

                      <TableCell sx={{ minWidth: 140 }}>
                        <TextField
                          size="small"
                          value={m.cidade || ''}
                          onChange={(e) => {
                            const v = e.target.value;
                            setMedicos((prev) => {
                              const cp = [...prev];
                              cp[idx] = { ...cp[idx], cidade: v };
                              return cp;
                            });
                          }}
                        />
                      </TableCell>

                      <TableCell sx={{ minWidth: 100 }}>
                        <TextField
                          size="small"
                          value={m.estado || ''}
                          onChange={(e) => {
                            const v = e.target.value.toUpperCase();
                            setMedicos((prev) => {
                              const cp = [...prev];
                              cp[idx] = { ...cp[idx], estado: v };
                              return cp;
                            });
                          }}
                          inputProps={{ maxLength: 2 }}
                          placeholder="UF"
                        />
                      </TableCell>

                      <TableCell sx={{ minWidth: 120 }}>
                        <TextField
                          size="small"
                          value={m.status || ''}
                          onChange={(e) => {
                            const v = e.target.value;
                            setMedicos((prev) => {
                              const cp = [...prev];
                              cp[idx] = { ...cp[idx], status: v };
                              return cp;
                            });
                          }}
                          placeholder="ativo/inativo"
                        />
                      </TableCell>

                      <TableCell align="center">
                        <Button size="small" startIcon={<SaveIcon />} onClick={() => saveMedicoContato(idx)}>
                          Salvar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Paginação */}
              <TablePagination
                component="div"
                count={medicosTotal}
                page={medicosPage}
                onPageChange={handleChangeMedicosPage}
                rowsPerPage={medicosRowsPerPage}
                onRowsPerPageChange={handleChangeMedicosRowsPerPage}
                rowsPerPageOptions={[25, 50, 100]}
                labelRowsPerPage="Linhas por página:"
                labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count !== -1 ? count : `mais de ${to}`}`}
              />
            </Paper>
          )}
        </>
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
