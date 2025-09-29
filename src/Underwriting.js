import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  Select,
  MenuItem,
  FormControlLabel,
  Checkbox,
  Button,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Paper,
  Alert,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Tooltip,
  Grid,
  List,
  ListItem,
} from '@mui/material';
import Autocomplete from '@mui/material/Autocomplete';
import axios from 'axios';
import DeleteIcon from '@mui/icons-material/Delete';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import EventIcon from '@mui/icons-material/Event';
import EventBusyIcon from '@mui/icons-material/EventBusy';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SendIcon from '@mui/icons-material/Send';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import InfoIcon from '@mui/icons-material/Info';
import FileDownloadIcon from '@mui/icons-material/Download';
import CancelIcon from '@mui/icons-material/Cancel';

/**
 * Underwriting management component.
 *
 * Allows the user to add new insurance applicants, automatically
 * calculates required medical/financial exams based on the selected
 * insurer, age, insured capital, and Asian flag, and lists all
 * applicants currently in the system.
 */
export default function Underwriting() {
  // Mode for toggling between creating a new applicant and managing existing ones
  const [mode, setMode] = useState('manage');

  // Currency helpers (BRL) — stable caret: display string separate from numeric value
  const toNumberFromMasked = (s) => {
    if (!s) return 0;
    const onlyDigits = String(s).replace(/[^\d]/g, '');
    // Interpret last 2 digits as cents
    return Number(onlyDigits || '0') / 100;
  };
  const toBRL = (n) =>
    (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  // Insurers / applicants / providers / exams registry
  const [insurers, setInsurers] = useState([]);
  const [applicants, setApplicants] = useState([]);
  const [rows, setRows] = useState([]); // flattened appointments
  const [providers, setProviders] = useState([]);
  const [examsList, setExamsList] = useState([]);

  // Status map (include "Not Requested")
  const statusOptions = [
    { value: 'To Schedule', label: 'Em Aberto' },
    { value: 'Scheduled', label: 'Agendado' },
    { value: 'Completed', label: 'Realizado' },
    { value: 'Results Received', label: 'Finalizado' },
    { value: 'Not Requested', label: 'Não Solicitado' },
  ];

  // Create form (includes address/contact/home/notes)
  const [form, setForm] = useState({
    insurer_name: '',
    name: '',
    birth_date: '',
    sex: 'M',
    is_asian: false,
    insured_capital: 0, // numeric value sent to backend
    broker: '',
    request_date: '',
    case_number: '',
    estado: '',
    cidade: '',
    cep: '',
    numero: '',
    complemento: '',
    telefone: '',
    email: '',
    domiciliar: false,
    comments: '',
  });
  const [capDisplay, setCapDisplay] = useState(''); // UI-only string for currency input

  const [requiredExams, setRequiredExams] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Filters for managing cases
  const [filterStatus, setFilterStatus] = useState('');
  const [filterInsurer, setFilterInsurer] = useState('');
  const [searchName, setSearchName] = useState('');

  // Appointment edit modal
  const [modalOpen, setModalOpen] = useState(false);
  const [modalRowIndex, setModalRowIndex] = useState(null);

  // Provider create modal
  const [providerModalOpen, setProviderModalOpen] = useState(false);
  const [newProvider, setNewProvider] = useState({
    name: '',
    cnpj: '',
    phone: '',
    email: '',
    address: '',
    exam_ids: [],
  });

  // Provider details modal
  const [providerDetailsOpen, setProviderDetailsOpen] = useState(false);
  const [detailsProvider, setDetailsProvider] = useState(null);

  // Applicant details modal
  const [applicantDetailsOpen, setApplicantDetailsOpen] = useState(false);
  const [detailsApplicant, setDetailsApplicant] = useState(null);

  // Init BRL display whenever insured_capital changes externally
  useEffect(() => {
    setCapDisplay(toBRL(form.insured_capital));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleShowApplicantDetails = (applicantId) => {
    const applicant = applicants.find((a) => a.id === applicantId);
    const anyRow = rows.find((r) => r.applicant_id === applicantId);
    const insurerName = anyRow ? anyRow.insurer_name : '';
    const exams = rows
      .filter((r) => r.applicant_id === applicantId)
      .map((r) => ({
        code: r.exam_code,
        name: r.exam_name,
        date: r.appointment_date ? r.appointment_date.split('T')[0] : '',
        provider: r.provider_name || '',
        status: r.status,
        results_received: r.results_received,
        results_sent: r.results_sent,
      }));
    setDetailsApplicant({ applicant, exams, insurerName });
    setApplicantDetailsOpen(true);
  };

  const handleShowProviderDetails = (providerId) => {
    const prov = providers.find((p) => p.id === providerId);
    if (prov) {
      let examIds = prov.exams || prov.exam_ids;
      if (!Array.isArray(examIds)) examIds = [];
      const examNames = examIds
        .map((id) => examsList.find((ex) => ex.id === id)?.name)
        .filter(Boolean);
      setDetailsProvider({ ...prov, examNames });
      setProviderDetailsOpen(true);
    }
  };

  // Helper: convert status value to Portuguese label
  const getStatusLabel = (value) => {
    const opt = statusOptions.find((o) => o.value === value);
    if (opt) return opt.label;
    switch (value) {
      case 'In Progress':
        return 'Agendado';
      case 'Billed':
        return 'Finalizado';
      default:
        return value;
    }
  };

  const handleNewProviderChange = (field, value) => {
    setNewProvider((prev) => ({ ...prev, [field]: value }));
  };

  // Export XLSX (backend already returns .xlsx)
  const handleExport = async () => {
    try {
      const res = await axios.get('/uw/applicants/export', { responseType: 'blob' });
      const blob = new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'exames.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Erro ao exportar casos', err);
    }
  };

  const handleSaveProvider = async () => {
    try {
      if (!newProvider.name) {
        alert('Informe o nome do prestador');
        return;
      }
      const payload = {
        name: newProvider.name,
        cnpj: newProvider.cnpj || null,
        phone: newProvider.phone || null,
        email: newProvider.email || null,
        address: newProvider.address || null,
        exam_ids: newProvider.exam_ids || [],
      };
      const res = await axios.post('/uw/providers', payload);
      setProviderModalOpen(false);
      setNewProvider({ name: '', cnpj: '', phone: '', email: '', address: '', exam_ids: [] });
      await loadProviders();
      if (modalRowIndex != null && res.data && res.data.id) {
        handleRowUpdate(modalRowIndex, 'provider_id', res.data.id);
      }
    } catch (err) {
      console.error('Erro ao salvar prestador', err);
    }
  };

  // Fetch baseline lists
  useEffect(() => {
    loadInsurers();
    loadApplicants();
    loadProviders();
    loadExamsList();
  }, []);

  const loadInsurers = async () => {
    try {
      const res = await axios.get('/uw/insurers');
      setInsurers(res.data || []);
    } catch (err) {
      console.error('Erro ao carregar seguradoras', err);
    }
  };

  const loadApplicants = async () => {
    try {
      const res = await axios.get('/uw/applicants');
      const apps = res.data || [];
      setApplicants(apps);
      const flattened = [];
      apps.forEach((app) => {
        (app.appointments || []).forEach((appt) => {
          flattened.push({
            appointment_id: appt.id,
            applicant_id: app.id,
            applicant_name: app.name,
            insurer_name: app.insurer_name,
            exam_code: appt.exam_code,
            exam_name: appt.exam_name,
            appointment_date: appt.appointment_date ? appt.appointment_date.slice(0, 10) : '',
            status: appt.status,
            results_received: appt.results_received,
            results_sent: appt.results_sent,
            provider_id: appt.provider_id,
            provider_name: appt.provider_name,
          });
        });
      });
      setRows(flattened);
    } catch (err) {
      console.error('Erro ao carregar solicitantes', err);
    }
  };

  const loadProviders = async () => {
    try {
      const res = await axios.get('/uw/providers');
      setProviders(res.data || []);
    } catch (err) {
      console.error('Erro ao carregar provedores', err);
    }
  };

  const loadExamsList = async () => {
    try {
      const res = await axios.get('/uw/exams');
      setExamsList(res.data || []);
    } catch (err) {
      console.error('Erro ao carregar lista de exames', err);
    }
  };

  // Update appointment row
  const handleRowUpdate = async (rowIndex, field, value) => {
    setRows((prev) => {
      const copy = [...prev];
      copy[rowIndex] = { ...copy[rowIndex], [field]: value };
      return copy;
    });
    const apptId = rows[rowIndex]?.appointment_id;
    if (!apptId) return;
    try {
      const payload = {};
      if (field === 'appointment_date') payload.appointment_date = value || null;
      if (field === 'status') payload.status = value;
      if (field === 'provider_id') payload.provider_id = value || null;
      if (field === 'results_received') payload.results_received = value;
      if (field === 'results_sent') payload.results_sent = value;
      await axios.put(`/uw/appointments/${apptId}`, payload);
    } catch (err) {
      console.error('Erro ao atualizar agendamento', err);
    }
  };

  // Delete an applicant and reload
  const handleDeleteApplicant = async (applicantId) => {
    if (!applicantId) return;
    const confirmDel = window.confirm('Tem certeza que deseja excluir este solicitante e todos os exames associados?');
    if (!confirmDel) return;
    try {
      await axios.delete(`/uw/applicants/${applicantId}`);
      await loadApplicants();
    } catch (err) {
      console.error('Erro ao excluir solicitante', err);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async () => {
    setError('');
    setRequiredExams([]);
    if (!form.insurer_name || !form.name || !form.birth_date) {
      setError('Preencha todos os campos obrigatórios.');
      return;
    }
    setLoading(true);
    try {
      const payload = {
        insurer_name: form.insurer_name,
        name: form.name,
        birth_date: form.birth_date,
        sex: form.sex,
        is_asian: form.is_asian,
        insured_capital: Number(form.insured_capital || 0),
        broker: form.broker || null,
        request_date: form.request_date || null,
        case_number: form.case_number || null,
        // endereço/contato/domicílio/comentários
        estado: form.estado || null,
        cidade: form.cidade || null,
        cep: form.cep || null,
        numero: form.numero || null,
        complemento: form.complemento || null,
        telefone: form.telefone || null,
        email: form.email || null,
        domiciliar: !!form.domiciliar,
        comments: form.comments || null,
      };
      const res = await axios.post('/uw/applicants', payload);
      const { applicant, required_exams } = res.data || {};
      if (applicant) {
        await loadApplicants();
        setRequiredExams(required_exams || []);
        setForm({
          insurer_name: '',
          name: '',
          birth_date: '',
          sex: 'M',
          is_asian: false,
          insured_capital: 0,
          broker: '',
          request_date: '',
          case_number: '',
          estado: '',
          cidade: '',
          cep: '',
          numero: '',
          complemento: '',
          telefone: '',
          email: '',
          domiciliar: false,
          comments: '',
        });
        setCapDisplay('');
      }
    } catch (err) {
      const msg = err.response?.data?.error || err.message;
      setError(msg);
    }
    setLoading(false);
  };

  // Filters
  const filteredRows = rows.filter((row) => {
    if (filterStatus && row.status !== filterStatus) return false;
    if (filterInsurer && row.insurer_name !== filterInsurer) return false;
    if (searchName && !row.applicant_name?.toLowerCase().includes(searchName.toLowerCase())) return false;
    return true;
  });

  // Group by applicant for display
  const grouped = {};
  filteredRows.forEach((row) => {
    const aid = row.applicant_id;
    if (!grouped[aid]) {
      grouped[aid] = { applicant_name: row.applicant_name, insurer_name: row.insurer_name, applicant_id: aid, items: [] };
    }
    grouped[aid].items.push(row);
  });
  const groupedList = Object.values(grouped);

  return (
    <Box p={3}>
      <Typography variant="h5" gutterBottom>
        Gerenciamento de Exames
      </Typography>

      {/* Toggle between add/manage modes */}
      <Box sx={{ mb: 2, display: 'flex', gap: 1 }}>
        <Button
          variant={mode === 'add' ? 'contained' : 'outlined'}
          onClick={() => setMode('add')}
        >
          Incluir Caso
        </Button>
        <Button
          variant={mode === 'manage' ? 'contained' : 'outlined'}
          onClick={() => setMode('manage')}
        >
          Gerenciar Casos
        </Button>
      </Box>

      {/* Formulário para adicionar solicitante */}
      {mode === 'add' && (
        <Box
          component="form"
          sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 3 }}
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
        >
          <Grid container spacing={2}>
            <Grid item xs={12} md={3}>
              <Select
                name="insurer_name"
                value={form.insurer_name}
                onChange={handleChange}
                displayEmpty
                required
                fullWidth
              >
                <MenuItem value="" disabled>
                  Escolha a seguradora
                </MenuItem>
                {insurers.map((ins) => (
                  <MenuItem key={ins.id} value={ins.name}>
                    {ins.name}
                  </MenuItem>
                ))}
              </Select>
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                name="name"
                label="Nome"
                value={form.name}
                onChange={handleChange}
                required
                fullWidth
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <TextField
                name="birth_date"
                type="date"
                label="Data de Nascimento"
                value={form.birth_date}
                onChange={handleChange}
                InputLabelProps={{ shrink: true }}
                required
                fullWidth
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <Select name="sex" value={form.sex} onChange={handleChange} required fullWidth>
                <MenuItem value="M">Masculino</MenuItem>
                <MenuItem value="F">Feminino</MenuItem>
              </Select>
            </Grid>
            <Grid item xs={12} md={2} sx={{ display: 'flex', alignItems: 'center' }}>
              <FormControlLabel
                control={
                  <Checkbox
                    name="is_asian"
                    checked={form.is_asian}
                    onChange={handleChange}
                  />
                }
                label="Asiático"
              />
            </Grid>

            <Grid item xs={12} md={3}>
              <TextField
                label="Capital Segurado"
                value={capDisplay}
                onChange={(e) => {
                  // while typing, keep raw string but show masked currency typed (digits only)
                  const raw = e.target.value;
                  const numeric = toNumberFromMasked(raw);
                  setForm((prev) => ({ ...prev, insured_capital: numeric }));
                  // Simple mask: rebuild from numeric to keep consistency
                  setCapDisplay(toBRL(numeric));
                }}
                onFocus={() => {
                  // On focus, show digits for easier editing
                  const cents = Math.round((Number(form.insured_capital) || 0) * 100);
                  setCapDisplay(String(cents));
                }}
                onBlur={() => {
                  // On blur, show as BRL
                  const numeric = toNumberFromMasked(capDisplay);
                  setForm((prev) => ({ ...prev, insured_capital: numeric }));
                  setCapDisplay(toBRL(numeric));
                }}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                name="broker"
                label="Corretora"
                value={form.broker}
                onChange={handleChange}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                name="request_date"
                label="Data da Solicitação"
                type="date"
                InputLabelProps={{ shrink: true }}
                value={form.request_date}
                onChange={handleChange}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                name="case_number"
                label="Número do Caso"
                value={form.case_number}
                onChange={handleChange}
                fullWidth
              />
            </Grid>
          </Grid>

          {/* Endereço do segurado / contato / domicílio / comentários */}
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle1" gutterBottom>
              Endereço e Contato
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={2}>
                <TextField label="Estado" name="estado" value={form.estado} onChange={handleChange} fullWidth />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField label="Cidade" name="cidade" value={form.cidade} onChange={handleChange} fullWidth />
              </Grid>
              <Grid item xs={12} md={2}>
                <TextField label="CEP" name="cep" value={form.cep} onChange={handleChange} fullWidth />
              </Grid>
              <Grid item xs={12} md={2}>
                <TextField label="Número" name="numero" value={form.numero} onChange={handleChange} fullWidth />
              </Grid>
              <Grid item xs={12} md={2}>
                <TextField label="Complemento" name="complemento" value={form.complemento} onChange={handleChange} fullWidth />
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField label="Telefone" name="telefone" value={form.telefone} onChange={handleChange} fullWidth />
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField label="E-mail" name="email" value={form.email} onChange={handleChange} fullWidth />
              </Grid>
              <Grid item xs={12} md={3} sx={{ display: 'flex', alignItems: 'center' }}>
                <FormControlLabel
                  control={<Checkbox name="domiciliar" checked={form.domiciliar} onChange={handleChange} />}
                  label="Exames em domicílio"
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Comentários"
                  name="comments"
                  value={form.comments}
                  onChange={handleChange}
                  multiline
                  minRows={2}
                  fullWidth
                />
              </Grid>
            </Grid>
          </Box>

          <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
            <Button variant="contained" type="submit" disabled={loading}>
              {loading ? 'Enviando...' : 'Adicionar'}
            </Button>
          </Box>
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {mode === 'add' && requiredExams.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle1">Exames exigidos para o último solicitante:</Typography>
          <ul>
            {requiredExams.map((ex) => (
              <li key={ex.id}>{ex.code ? `${ex.code} – ` : ''}{ex.name}</li>
            ))}
          </ul>
        </Box>
      )}

      {mode === 'manage' && (
        <>
          {/* Filtros e exportação */}
          <Box sx={{ mb: 2, display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
            <Select
              value={filterInsurer}
              onChange={(e) => setFilterInsurer(e.target.value)}
              displayEmpty
              sx={{ minWidth: 200 }}
            >
              <MenuItem value="">
                <em>Todas as seguradoras</em>
              </MenuItem>
              {insurers.map((ins) => (
                <MenuItem key={ins.id} value={ins.name}>
                  {ins.name}
                </MenuItem>
              ))}
            </Select>
            <Select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              displayEmpty
              sx={{ minWidth: 150 }}
            >
              <MenuItem value="">
                <em>Todos os status</em>
              </MenuItem>
              {statusOptions.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </Select>
            <TextField
              label="Buscar por nome"
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
            />
            <Button
              variant="outlined"
              startIcon={<FileDownloadIcon />}
              onClick={handleExport}
            >
              Exportar XLSX
            </Button>
          </Box>

          {/* Tabela de exames por solicitante */}
          <Paper sx={{ width: '100%', overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Nome</TableCell>
                  <TableCell>Seguradora</TableCell>
                  <TableCell>Exames</TableCell>
                  <TableCell>Ações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {groupedList.map((group) => (
                  <TableRow key={group.applicant_id}>
                    <TableCell>
                      <Button
                        variant="text"
                        size="small"
                        onClick={() => handleShowApplicantDetails(group.applicant_id)}
                      >
                        {group.applicant_name}
                      </Button>
                    </TableCell>
                    <TableCell>{group.insurer_name}</TableCell>
                    <TableCell>
                      {/* Render exams as chips with status icons and tooltips */}
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        {group.items.map((it, idx) => {
                          let IconComp = ErrorOutlineIcon;
                          let chipColor = 'error';
                          let tooltip = 'A agendar';
                          const apptDate = it.appointment_date ? new Date(it.appointment_date) : null;
                          const today = new Date();
                          if (it.results_sent) {
                            IconComp = SendIcon;
                            chipColor = 'primary';
                            tooltip = 'Resultados enviados';
                          } else if (it.results_received) {
                            IconComp = TaskAltIcon;
                            chipColor = 'secondary';
                            tooltip = 'Resultados recebidos';
                          } else if (it.status === 'Not Requested') {
                            IconComp = CancelIcon;
                            chipColor = 'default';
                            tooltip = 'Não solicitado';
                          } else if (['Completed', 'Results Received', 'Billed'].includes(it.status)) {
                            IconComp = CheckCircleIcon;
                            chipColor = 'success';
                            tooltip = 'Exame concluído';
                          } else if (apptDate) {
                            if (apptDate < today) {
                              IconComp = EventBusyIcon;
                              chipColor = 'error';
                              tooltip = 'Agendamento vencido';
                            } else {
                              IconComp = EventIcon;
                              chipColor = 'warning';
                              tooltip = 'Agendado';
                            }
                          }
                          const label = it.exam_code ? `${it.exam_code} – ${it.exam_name}` : it.exam_name;
                          return (
                            <Tooltip key={`${it.appointment_id}-${idx}`} title={tooltip} arrow>
                              <Chip
                                icon={<IconComp />}
                                label={label}
                                color={chipColor}
                                size="small"
                                onClick={() => {
                                  const rowIndex = rows.findIndex((r) => r.appointment_id === it.appointment_id);
                                  setModalRowIndex(rowIndex);
                                  setModalOpen(true);
                                }}
                                sx={{ cursor: 'pointer' }}
                              />
                            </Tooltip>
                          );
                        })}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={() => handleDeleteApplicant(group.applicant_id)}
                        title="Excluir solicitante e seus exames"
                      >
                        <DeleteIcon fontSize="inherit" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>

          {/* Modal de edição de exame */}
          <Dialog open={modalOpen} onClose={() => setModalOpen(false)} maxWidth="sm" fullWidth>
            <DialogTitle>Detalhes do Exame</DialogTitle>
            {modalRowIndex != null && rows[modalRowIndex] && (
              <DialogContent dividers>
                <Typography variant="subtitle1" gutterBottom>
                  {rows[modalRowIndex].exam_code
                    ? `${rows[modalRowIndex].exam_code} – ${rows[modalRowIndex].exam_name}`
                    : rows[modalRowIndex].exam_name}
                </Typography>

                {/* Subexames / agrupamentos simples */}
                {(() => {
                  const descMap = {
                    'Perfil de Sangue (BCP)': {
                      Hemograma: ['Hemograma Completo'],
                      'Perfil Lipídico': ['Colesterol Total', 'Colesterol HDL', 'Colesterol LDL', 'Triglicérides'],
                      Bioquímica: [
                        'Anti-HIV',
                        'Glicemia em Jejum',
                        'Hemoglobina Glicada',
                        'Ureia',
                        'Creatinina',
                        'Fosfatase Alcalina',
                        'Bilirrubina Total e Frações',
                        'TGO',
                        'TGP',
                        'GGT',
                        'Proteínas Totais e Frações',
                        'Albumina',
                      ],
                    },
                    Hemograma: ['Hemoglobina', 'Hematócrito', 'Hemácias', 'Leucócitos', 'Plaquetas'],
                    'Perfil Lipídico': ['Colesterol Total', 'Colesterol HDL', 'Colesterol LDL', 'Triglicérides'],
                    'Exame Clínico': ['Avaliação clínica completa pelo médico'],
                    Urinálise: ['Urina Tipo I'],
                    ECG: ['Eletrocardiograma de 12 derivações em repouso'],
                    'Teste Ergométrico': ['Teste de esforço em esteira ou bicicleta'],
                    'Radiografia de Tórax': ['Raio-X de Tórax (PA e Perfil)'],
                    'Análise Financeira Auditada': ['Relatório financeiro auditado por contador'],
                    'Questionário Financeiro': ['Questionário com dados financeiros do proponente'],
                    'Relatório de Inspeção (com Entrevista)': ['Entrevista com investigador'],
                    'Prova de Patrimônio': ['Documentos de comprovação de bens e ativos'],
                    'Marcadores de Hepatite B e C': ['HBsAg, Anti-HBs, Anti-HCV'],
                    'APS Completa': ['Histórico clínico completo dos últimos 3 anos'],
                  };
                  const examName = rows[modalRowIndex].exam_name;
                  const desc = descMap[examName];
                  if (!desc) return null;
                  return (
                    <Box sx={{ mt: 1, mb: 2 }}>
                      <Typography variant="caption" color="textSecondary">
                        Subexames:
                      </Typography>
                      {Array.isArray(desc) ? (
                        <ul style={{ marginTop: 4, marginBottom: 8 }}>
                          {desc.map((d, i) => (
                            <li key={i} style={{ fontSize: '0.8rem' }}>{d}</li>
                          ))}
                        </ul>
                      ) : (
                        Object.keys(desc).map((cat) => (
                          <Box key={cat} sx={{ mb: 1 }}>
                            <Typography variant="body2" fontWeight="bold" sx={{ mt: 1 }}>
                              {cat}
                            </Typography>
                            <ul style={{ marginTop: 2, marginBottom: 4 }}>
                              {desc[cat].map((d, i) => (
                                <li key={i} style={{ fontSize: '0.8rem' }}>{d}</li>
                              ))}
                            </ul>
                          </Box>
                        ))
                      )}
                    </Box>
                  );
                })()}

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                  <TextField
                    label="Data do exame"
                    type="date"
                    InputLabelProps={{ shrink: true }}
                    value={rows[modalRowIndex].appointment_date || ''}
                    onChange={(e) => handleRowUpdate(modalRowIndex, 'appointment_date', e.target.value)}
                  />
                  {/* Seleção de prestador com opção de adicionar novo */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Select
                      value={rows[modalRowIndex].provider_id || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '__new__') {
                          setProviderModalOpen(true);
                          return;
                        }
                        handleRowUpdate(modalRowIndex, 'provider_id', val);
                      }}
                      displayEmpty
                      renderValue={(val) => {
                        if (!val) return <em>Selecione um prestador</em>;
                        const prov = providers.find((p) => p.id === val);
                        return prov ? `${prov.name}` : val;
                      }}
                      fullWidth
                    >
                      <MenuItem value="">
                        <em>Selecione um prestador</em>
                      </MenuItem>
                      <MenuItem value="__new__" sx={{ fontStyle: 'italic', color: 'primary.main' }}>
                        + Adicionar novo prestador
                      </MenuItem>
                      {providers.map((p) => (
                        <MenuItem key={p.id} value={p.id}>
                          <Box>
                            <Typography variant="body2" fontWeight="bold">
                              {p.name}
                            </Typography>
                            <Typography variant="caption" display="block">
                              {p.phone || ''}
                            </Typography>
                            <Typography variant="caption" display="block">
                              {p.email || ''}
                            </Typography>
                          </Box>
                        </MenuItem>
                      ))}
                    </Select>

                    {rows[modalRowIndex].provider_id && (
                      <IconButton
                        size="small"
                        onClick={() => handleShowProviderDetails(rows[modalRowIndex].provider_id)}
                        sx={{ ml: 1 }}
                      >
                        <InfoIcon fontSize="small" />
                      </IconButton>
                    )}
                  </Box>

                  <Select
                    label="Status"
                    value={rows[modalRowIndex].status || ''}
                    onChange={(e) => handleRowUpdate(modalRowIndex, 'status', e.target.value)}
                  >
                    {statusOptions.map((opt) => (
                      <MenuItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </MenuItem>
                    ))}
                  </Select>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={!!rows[modalRowIndex].results_received}
                        onChange={(e) => handleRowUpdate(modalRowIndex, 'results_received', e.target.checked)}
                      />
                    }
                    label="Resultados Recebidos"
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={!!rows[modalRowIndex].results_sent}
                        onChange={(e) => handleRowUpdate(modalRowIndex, 'results_sent', e.target.checked)}
                      />
                    }
                    label="Resultados Enviados"
                  />
                </Box>
              </DialogContent>
            )}
            <DialogActions>
              <Button onClick={() => setModalOpen(false)}>Fechar</Button>
            </DialogActions>
          </Dialog>

          {/* Modal de criação de novo prestador */}
          <Dialog open={providerModalOpen} onClose={() => setProviderModalOpen(false)} maxWidth="sm" fullWidth>
            <DialogTitle>Novo Prestador</DialogTitle>
            <DialogContent dividers>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField
                  label="Nome"
                  value={newProvider.name}
                  onChange={(e) => handleNewProviderChange('name', e.target.value)}
                  required
                />
                <TextField
                  label="CNPJ"
                  value={newProvider.cnpj}
                  onChange={(e) => handleNewProviderChange('cnpj', e.target.value)}
                />
                <TextField
                  label="Telefone"
                  value={newProvider.phone}
                  onChange={(e) => handleNewProviderChange('phone', e.target.value)}
                />
                <TextField
                  label="E-mail"
                  type="email"
                  value={newProvider.email}
                  onChange={(e) => handleNewProviderChange('email', e.target.value)}
                />
                <TextField
                  label="Endereço"
                  value={newProvider.address}
                  onChange={(e) => handleNewProviderChange('address', e.target.value)}
                />
                <Autocomplete
                  multiple
                  options={examsList}
                  getOptionLabel={(option) => option.name}
                  value={examsList.filter((ex) => newProvider.exam_ids.includes(ex.id))}
                  onChange={(_, selected) => {
                    const ids = selected.map((opt) => opt.id);
                    handleNewProviderChange('exam_ids', ids);
                  }}
                  renderTags={(value, getTagProps) =>
                    value.map((option, index) => (
                      <Chip
                        size="small"
                        label={option.name}
                        {...getTagProps({ index })}
                      />
                    ))
                  }
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Exames realizados"
                      placeholder="Selecione os exames"
                    />
                  )}
                  filterSelectedOptions
                />
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setProviderModalOpen(false)}>Cancelar</Button>
              <Button variant="contained" onClick={handleSaveProvider}>Salvar</Button>
            </DialogActions>
          </Dialog>

          {/* Modal de detalhes do prestador */}
          <Dialog open={providerDetailsOpen} onClose={() => setProviderDetailsOpen(false)} maxWidth="sm" fullWidth>
            <DialogTitle>Detalhes do Prestador</DialogTitle>
            {detailsProvider && (
              <DialogContent dividers>
                <Typography variant="subtitle1" gutterBottom>
                  {detailsProvider.name}
                </Typography>
                <Typography variant="body2">CNPJ: {detailsProvider.cnpj || '—'}</Typography>
                <Typography variant="body2">Telefone: {detailsProvider.phone || '—'}</Typography>
                <Typography variant="body2">E-mail: {detailsProvider.email || '—'}</Typography>
                <Typography variant="body2" gutterBottom>
                  Endereço: {detailsProvider.address || '—'}
                </Typography>
                {detailsProvider.address && (
                  <Typography variant="body2" gutterBottom>
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                        detailsProvider.address
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Ver no Google Maps
                    </a>
                  </Typography>
                )}
                <Typography variant="caption" color="textSecondary">Exames realizados:</Typography>
                <ul style={{ marginTop: 4 }}>
                  {(() => {
                    const names = detailsProvider.examNames || [];
                    if (!names || names.length === 0) {
                      return <li>Nenhum exame vinculado</li>;
                    }
                    return names.map((name, idx) => <li key={idx}>{name}</li>);
                  })()}
                </ul>
              </DialogContent>
            )}
            <DialogActions>
              <Button onClick={() => setProviderDetailsOpen(false)}>Fechar</Button>
            </DialogActions>
          </Dialog>

          {/* Modal de detalhes do solicitante */}
          <Dialog open={applicantDetailsOpen} onClose={() => setApplicantDetailsOpen(false)} maxWidth="md" fullWidth>
            <DialogTitle>Detalhes do Solicitante</DialogTitle>
            {detailsApplicant && (
              <DialogContent dividers>
                <Typography variant="h6" gutterBottom>
                  {detailsApplicant.applicant?.name}
                </Typography>

                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <List dense>
                      <ListItem><b>Corretora:</b>&nbsp;{detailsApplicant.applicant?.broker || '—'}</ListItem>
                      <ListItem><b>Seguradora:</b>&nbsp;{detailsApplicant.insurerName || '—'}</ListItem>
                      <ListItem><b>Capital:</b>&nbsp;{toBRL(detailsApplicant.applicant?.insured_capital)}</ListItem>
                      <ListItem><b>Solicitação:</b>&nbsp;{detailsApplicant.applicant?.request_date || '—'}</ListItem>
                      <ListItem><b>Nº do Caso:</b>&nbsp;{detailsApplicant.applicant?.case_number || '—'}</ListItem>
                    </List>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <List dense>
                      <ListItem><b>Endereço:</b>&nbsp;{[detailsApplicant.applicant?.numero, detailsApplicant.applicant?.complemento].filter(Boolean).join(', ') || '—'}</ListItem>
                      <ListItem><b>Cidade/UF:</b>&nbsp;{[detailsApplicant.applicant?.cidade, detailsApplicant.applicant?.estado].filter(Boolean).join(' / ') || '—'}</ListItem>
                      <ListItem><b>CEP:</b>&nbsp;{detailsApplicant.applicant?.cep || '—'}</ListItem>
                      <ListItem><b>Telefone:</b>&nbsp;{detailsApplicant.applicant?.telefone || '—'}</ListItem>
                      <ListItem><b>E-mail:</b>&nbsp;{detailsApplicant.applicant?.email || '—'}</ListItem>
                      <ListItem><b>Domiciliar:</b>&nbsp;{detailsApplicant.applicant?.domiciliar ? 'Sim' : 'Não'}</ListItem>
                      <ListItem><b>Comentários:</b>&nbsp;{detailsApplicant.applicant?.comments || '—'}</ListItem>
                    </List>
                  </Grid>
                </Grid>

                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle1">Exames</Typography>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Código</TableCell>
                        <TableCell>Exame</TableCell>
                        <TableCell>Data</TableCell>
                        <TableCell>Prestador</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Resultados</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {detailsApplicant.exams.map((ex, idx) => (
                        <TableRow key={idx}>
                          <TableCell>{ex.code || '—'}</TableCell>
                          <TableCell>{ex.name}</TableCell>
                          <TableCell>{ex.date || '—'}</TableCell>
                          <TableCell>{ex.provider || '—'}</TableCell>
                          <TableCell>{getStatusLabel(ex.status)}</TableCell>
                          <TableCell>{ex.results_sent ? 'Enviado' : ex.results_received ? 'Recebido' : '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Box>
              </DialogContent>
            )}
            <DialogActions>
              <Button onClick={() => setApplicantDetailsOpen(false)}>Fechar</Button>
            </DialogActions>
          </Dialog>
        </>
      )}
    </Box>
  );
}