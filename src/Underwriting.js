// src/Underwriting.js

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
} from '@mui/material';
import axios from 'axios';
import DeleteIcon from '@mui/icons-material/Delete';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import EventIcon from '@mui/icons-material/Event';
import EventBusyIcon from '@mui/icons-material/EventBusy';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SendIcon from '@mui/icons-material/Send';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import InfoIcon from '@mui/icons-material/Info';

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

  // Format number as currency (pt-BR) without currency symbol
  const formatCurrency = (val) => {
    if (val === '' || val === null || val === undefined) return '';
    const num = typeof val === 'number' ? val : parseFloat(val);
    if (isNaN(num)) return val;
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  };

  const [insurers, setInsurers] = useState([]);
  const [applicants, setApplicants] = useState([]);
  // Flattened appointment rows for display and editing
  const [rows, setRows] = useState([]);
  const [providers, setProviders] = useState([]);
  // Lista de todos os tipos de exame (usada para associar a prestadores)
  const [examsList, setExamsList] = useState([]);
  const statusOptions = [
    'To Schedule',
    'Scheduled',
    'In Progress',
    'Completed',
    'Results Received',
    'Billed',
  ];
  const [form, setForm] = useState({
    insurer_name: '',
    name: '',
    birth_date: '',
    sex: 'M',
    is_asian: false,
    insured_capital: '',
  });
  const [requiredExams, setRequiredExams] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Filters for managing cases
  const [filterStatus, setFilterStatus] = useState('');
  const [filterInsurer, setFilterInsurer] = useState('');
  const [searchName, setSearchName] = useState('');

  // Modal for editing an appointment (exam)
  const [modalOpen, setModalOpen] = useState(false);
  const [modalRowIndex, setModalRowIndex] = useState(null);

  // Modal para criação de prestador
  const [providerModalOpen, setProviderModalOpen] = useState(false);
  const [newProvider, setNewProvider] = useState({
    name: '',
    cnpj: '',
    phone: '',
    email: '',
    address: '',
    exam_ids: [],
  });

  // Modal de detalhes do prestador
  const [providerDetailsOpen, setProviderDetailsOpen] = useState(false);
  const [detailsProvider, setDetailsProvider] = useState(null);

  const handleShowProviderDetails = (providerId) => {
    const prov = providers.find((p) => p.id === providerId);
    if (prov) {
      // Compute a list of exam names if the provider has exam ids
      let examIds = prov.exams || prov.exam_ids;
      if (!Array.isArray(examIds)) examIds = [];
      const examNames = examIds
        .map((id) => examsList.find((ex) => ex.id === id)?.name)
        .filter(Boolean);
      setDetailsProvider({ ...prov, examNames });
      setProviderDetailsOpen(true);
    }
  };

  const handleNewProviderChange = (field, value) => {
    setNewProvider((prev) => ({ ...prev, [field]: value }));
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

  // Fetch insurers and applicants on mount
  useEffect(() => {
    loadInsurers();
    loadApplicants();
    loadProviders();
    // carregar lista de exames para o modal de prestadores
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
      // Flatten appointments into rows array
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

  // Carrega todos os tipos de exame definidos no backend
  const loadExamsList = async () => {
    try {
      const res = await axios.get('/uw/exams');
      setExamsList(res.data || []);
    } catch (err) {
      console.error('Erro ao carregar lista de exames', err);
    }
  };

  // Update a single appointment row both locally and remotely
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
    const confirm = window.confirm('Tem certeza que deseja excluir este solicitante e todos os exames associados?');
    if (!confirm) return;
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
    // Basic validation
    if (!form.insurer_name || !form.name || !form.birth_date || !form.insured_capital) {
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
        insured_capital: parseFloat(form.insured_capital),
      };
      const res = await axios.post('/uw/applicants', payload);
      // Append new applicant and show required exams
      const { applicant, required_exams } = res.data || {};
      if (applicant) {
        // Recarrega lista completa (inclui novos agendamentos)
        await loadApplicants();
        setRequiredExams(required_exams || []);
        // Reset form
        setForm({ insurer_name: '', name: '', birth_date: '', sex: 'M', is_asian: false, insured_capital: '' });
      }
    } catch (err) {
      const msg = err.response?.data?.error || err.message;
      setError(msg);
    }
    setLoading(false);
  };

  // Compute filtered rows based on selected filters
  const filteredRows = rows.filter((row) => {
    if (filterStatus && row.status !== filterStatus) return false;
    if (filterInsurer && row.insurer_name !== filterInsurer) return false;
    if (searchName && !row.applicant_name?.toLowerCase().includes(searchName.toLowerCase())) return false;
    return true;
  });

  // Group rows by applicant for table view
  const grouped = {};
  filteredRows.forEach((row, idx) => {
    const aid = row.applicant_id;
    if (!grouped[aid]) {
      grouped[aid] = { applicant_name: row.applicant_name, insurer_name: row.insurer_name, items: [] };
    }
    grouped[aid].items.push({ ...row, rowIndex: rows.indexOf(row) });
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
          sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center', mb: 3 }}
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
        >
          <Select
            name="insurer_name"
            value={form.insurer_name}
            onChange={handleChange}
            displayEmpty
            required
            sx={{ minWidth: 200 }}
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
          <TextField
            name="name"
            label="Nome"
            value={form.name}
            onChange={handleChange}
            required
          />
          <TextField
            name="birth_date"
            type="date"
            label="Data de Nascimento"
            value={form.birth_date}
            onChange={handleChange}
            InputLabelProps={{ shrink: true }}
            required
          />
          <Select name="sex" value={form.sex} onChange={handleChange} required>
            <MenuItem value="M">Masculino</MenuItem>
            <MenuItem value="F">Feminino</MenuItem>
          </Select>
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
          <TextField
            name="insured_capital"
            label="Capital Segurado"
            type="text"
            value={formatCurrency(form.insured_capital)}
            onChange={(e) => {
              const raw = e.target.value;
              // remove pontos de milhar e substituir vírgula por ponto
              const numericString = raw
                .replace(/\./g, '')
                .replace(/,/g, '.')
                .replace(/[^0-9.]/g, '');
              const num = parseFloat(numericString);
              setForm((prev) => ({
                ...prev,
                insured_capital: isNaN(num) ? '' : num,
              }));
            }}
            required
          />
          <Button variant="contained" type="submit" disabled={loading}>
            {loading ? 'Enviando...' : 'Adicionar'}
          </Button>
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
          {/* Filtros */}
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
                <MenuItem key={opt} value={opt}>
                  {opt}
                </MenuItem>
              ))}
            </Select>
            <TextField
              label="Buscar por nome"
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
            />
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
                {groupedList.map((group, idx) => (
                  <TableRow key={idx}>
                    <TableCell>{group.applicant_name}</TableCell>
                    <TableCell>{group.insurer_name}</TableCell>
                    <TableCell>
                      {/* Render exams as chips with status icons and tooltips */}
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        {group.items.map((it) => {
                          // Determine icon, color and tooltip based on status, dates and results
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
                          } else if (it.status === 'Completed') {
                            IconComp = CheckCircleIcon;
                            chipColor = 'success';
                            tooltip = 'Exame realizado';
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
                            <Tooltip key={it.appointment_id} title={tooltip} arrow>
                              <Chip
                                icon={<IconComp />}
                                label={label}
                                color={chipColor}
                                size="small"
                                onClick={() => {
                                  setModalRowIndex(it.rowIndex);
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
                      {/* Excluir apenas uma vez por solicitante */}
                      <IconButton
                        size="small"
                        onClick={() => handleDeleteApplicant(group.items[0].applicant_id)}
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

                {/* Exibe subexames (descrição detalhada) se houver mapeamento */}
                {(() => {
                  const descMap = {
                    'Perfil de Sangue (BCP)': [
                      'Hemograma Completo',
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
                      'Triglicérides',
                      'Colesterol Total',
                      'Colesterol HDL',
                      'Colesterol LDL',
                    ],
                    'Hemograma': [
                      'Hemoglobina',
                      'Hematócrito',
                      'Hemácias',
                      'Leucócitos',
                      'Plaquetas',
                    ],
                    'Perfil Lipídico': [
                      'Colesterol Total',
                      'Colesterol HDL',
                      'Colesterol LDL',
                      'Triglicérides',
                    ],
                    'Exame Clínico': [
                      'Avaliação clínica completa pelo médico',
                    ],
                    'Urinálise': [
                      'Urina Tipo I',
                    ],
                    'ECG': [
                      'Eletrocardiograma de 12 derivações em repouso',
                    ],
                    'Teste Ergométrico': [
                      'Teste de esforço em esteira ou bicicleta',
                    ],
                    'Radiografia de Tórax': [
                      'Raio-X de Tórax (PA e Perfil)',
                    ],
                    'Análise Financeira Auditada': [
                      'Relatório financeiro auditado por contador',
                    ],
                    'Questionário Financeiro': [
                      'Questionário com dados financeiros do proponente',
                    ],
                    'Relatório de Inspeção (com Entrevista)': [
                      'Entrevista com investigador',
                    ],
                    'Prova de Patrimônio': [
                      'Documentos de comprovação de bens e ativos',
                    ],
                    'Marcadores de Hepatite B e C': [
                      'Hepatite B (HBsAg, Anti-HBs)',
                      'Hepatite C (Anti-HCV)',
                    ],
                    'APS Completa': [
                      'Histórico clínico completo dos últimos 3 anos',
                    ],
                    'Declaração Financeira': [
                      'Formulário de Declaração Financeira',
                    ],
                    'Carta do Consultor': [
                      'Carta do consultor justificando o seguro',
                    ],
                  };
                  const examName = rows[modalRowIndex].exam_name;
                  const desc = descMap[examName];
                  if (!desc) return null;
                  return (
                    <Box sx={{ mt: 1, mb: 2 }}>
                      <Typography variant="caption" color="textSecondary">
                        Subexames:
                      </Typography>
                      <ul style={{ marginTop: 4, marginBottom: 8 }}>
                        {desc.map((d, i) => (
                          <li key={i} style={{ fontSize: '0.8rem' }}>{d}</li>
                        ))}
                      </ul>
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
                  {
                    /* Seleção de prestador com opção de adicionar novo */
                  }
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
                  >
                    <MenuItem value="">
                      <em>Selecione um prestador</em>
                    </MenuItem>
                    {/* opção para criar novo prestador */}
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
                  {/* Botão para ver detalhes do prestador selecionado */}
                  {rows[modalRowIndex].provider_id && (
                    <IconButton
                      size="small"
                      onClick={() => handleShowProviderDetails(rows[modalRowIndex].provider_id)}
                      sx={{ ml: 1 }}
                    >
                      <InfoIcon fontSize="small" />
                    </IconButton>
                  )}
                  <Select
                    label="Status"
                    value={rows[modalRowIndex].status || ''}
                    onChange={(e) => handleRowUpdate(modalRowIndex, 'status', e.target.value)}
                  >
                    {statusOptions.map((opt) => (
                      <MenuItem key={opt} value={opt}>
                        {opt}
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
                <Select
                  multiple
                  value={newProvider.exam_ids}
                  onChange={(e) => handleNewProviderChange('exam_ids', e.target.value)}
                  renderValue={(selected) => {
                    const names = selected
                      .map((id) => examsList.find((ex) => ex.id === id)?.name)
                      .filter(Boolean);
                    return names.join(', ');
                  }}
                  displayEmpty
                >
                  {examsList.map((ex) => (
                    <MenuItem key={ex.id} value={ex.id}>
                      <Checkbox checked={newProvider.exam_ids.includes(ex.id)} />
                      <Typography variant="body2">{ex.name}</Typography>
                    </MenuItem>
                  ))}
                </Select>
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
                {/* Lista de exames que o prestador realiza */}
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
        </>
      )}
    </Box>
  );
}