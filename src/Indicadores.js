// src/Indicadores.js
import React, { useEffect, useMemo, useState } from "react";
import {
  Box, Paper, Typography, TextField, MenuItem, Button,
  Table, TableHead, TableRow, TableCell, TableBody,
  IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  Tooltip, Snackbar, Alert, Stack, LinearProgress, Collapse,
  Checkbox, ListItemText, useMediaQuery
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import ShowChartIcon from "@mui/icons-material/ShowChart";
import SaveIcon from "@mui/icons-material/Save";
import CloseIcon from "@mui/icons-material/Close";
import AddIcon from "@mui/icons-material/Add";
import ExpandMoreIcon from "@mui/icons-material/KeyboardArrowRight";
import ExpandLessIcon from "@mui/icons-material/KeyboardArrowDown";
import CompareIcon from "@mui/icons-material/CompareArrows";
import axios from "axios";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  Tooltip as RTooltip, CartesianGrid, Legend, LabelList
} from "recharts";

const MESES = [
  { k: "1",  l: "jan" }, { k: "2",  l: "fev" }, { k: "3",  l: "mar" },
  { k: "4",  l: "abr" }, { k: "5",  l: "mai" }, { k: "6",  l: "jun" },
  { k: "7",  l: "jul" }, { k: "8",  l: "ago" }, { k: "9",  l: "set" },
  { k: "10", l: "out" }, { k: "11", l: "nov" }, { k: "12", l: "dez" },
];

const anosList = (() => {
  const y = new Date().getFullYear();
  return [y - 1, y, y + 1];
})();

const menuProps = { PaperProps: { style: { maxHeight: 320 } } };

// inputs de mês: grandes e legíveis
const CELL_SX = {
  minWidth: { xs: 92, sm: 104, md: 112 },
  "& .MuiOutlinedInput-root": { borderRadius: 1.2 },
  "& .MuiInputBase-input": { fontSize: 16, padding: "10px 12px", textAlign: "right" },
};

// Cabeçalho: mantém fundo/cores padrão do tema, só negrito
const HEAD_WRAP_SX = {
  "& .MuiTableCell-root": { fontWeight: 700 }
};

function toNumber(v) {
  if (v === "" || v === null || v === undefined) return "";
  const n = Number(v);
  return Number.isFinite(n) ? n : "";
}
const keyFor = (r) => `${r.projeto}||${r.indicador}`;
const labelFor = (r) => `${r.projeto} — ${r.indicador}`;

// Se TODOS os preenchidos forem inteiros → "int"; senão "decimal"
function inferTipoFromValues(valObj) {
  const filled = Object.values(valObj ?? {})
    .map(v => (v === "" || v === null || v === undefined ? null : Number(v)))
    .filter(v => v !== null && Number.isFinite(v));
  if (filled.length === 0) return "decimal";
  return filled.every(v => Math.floor(v) === v) ? "int" : "decimal";
}

// paleta consistente para múltiplas linhas
const COLORS = [
  "#1f77b4","#ff7f0e","#2ca02c","#d62728","#9467bd",
  "#8c564b","#e377c2","#7f7f7f","#bcbd22","#17becf",
  "#003f5c","#58508d","#bc5090","#ff6361","#ffa600"
];

export default function Indicadores() {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));

  // filtros
  const [ano, setAno] = useState(new Date().getFullYear());
  const [projetosFiltro, setProjetosFiltro] = useState([]); // múltiplos
  const [projetosOptions, setProjetosOptions] = useState([]);
  const [loading, setLoading] = useState(false);

  // dados + agrupamento/expansão
  const [rows, setRows] = useState([]);
  const [openProjects, setOpenProjects] = useState({}); // { [proj]: bool }

  // para comparação (todos do ano)
  const [allRowsYear, setAllRowsYear] = useState([]);

  // criação
  const [addOpen, setAddOpen] = useState(false);
  const [addProjeto, setAddProjeto] = useState("");
  const [addProjetoSug, setAddProjetoSug] = useState("");
  const [addIndicador, setAddIndicador] = useState("");
  const [addAno, setAddAno] = useState(new Date().getFullYear());
  const [addValores, setAddValores] = useState(Object.fromEntries(MESES.map(m => [m.k, ""])));
  const [savingAdd, setSavingAdd] = useState(false);

  // edição inline
  const [editKey, setEditKey] = useState(null);
  const [editBuffer, setEditBuffer] = useState(null);

  // gráfico + comparação
  const [chartOpen, setChartOpen] = useState(false);
  const [chartRow, setChartRow] = useState(null);
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareKeys, setCompareKeys] = useState([]); // chaves selecionadas
  const [compareSeries, setCompareSeries] = useState([]); // rows
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareOpenProj, setCompareOpenProj] = useState({}); // expand no diálogo

  // feedback
  const [snack, setSnack] = useState({ open: false, type: "success", text: "" });

  // carrega lista de projetos (tabela de indicadores) — filtra por ano
  const loadProjetosFromIndicadores = async () => {
    try {
      const r = await axios.get("/indicadores/projetos", { params: { ano } });
      setProjetosOptions(r.data || []);
    } catch {
      setProjetosOptions([]);
    }
  };

  // dados (filtro)
  const carregar = async (preserveOpen = true) => {
    setLoading(true);
    const prev = preserveOpen ? { ...openProjects } : {};
    try {
      const params = { ano };
      if (projetosFiltro.length) params.projetos = projetosFiltro.join(",");
      const r = await axios.get("/indicadores", { params });
      const list = r.data || [];
      setRows(list);
      // prepara estado de expansão
      const nextOpen = {};
      const projList = [...new Set(list.map(i => i.projeto))].sort((a,b)=>a.localeCompare(b));
      projList.forEach(p => nextOpen[p] = prev[p] ?? false);
      setOpenProjects(nextOpen);
    } catch {
      setRows([]);
      setOpenProjects({});
    } finally {
      setLoading(false);
    }
  };

  // todos do ano para dialog de comparação
  const carregarAllYear = async () => {
    try {
      const r = await axios.get("/indicadores", { params: { ano } });
      setAllRowsYear(r.data || []);
      const allProj = [...new Set((r.data||[]).map(i => i.projeto))];
      const cmpOpen = {};
      allProj.forEach(p => cmpOpen[p] = false);
      setCompareOpenProj(cmpOpen);
    } catch {
      setAllRowsYear([]);
      setCompareOpenProj({});
    }
  };

  // ciclo de filtros
  useEffect(() => {
    loadProjetosFromIndicadores();
  }, [ano]);
  useEffect(() => {
    carregar(true);
    carregarAllYear();
    // eslint-disable-next-line
  }, [ano, projetosFiltro]);

  // agrupado por projeto (lista principal)
  const grouped = useMemo(() => {
    const map = {};
    for (const r of rows) {
      const p = r.projeto || "(Sem projeto)";
      if (!map[p]) map[p] = [];
      map[p].push(r);
    }
    return Object.keys(map).sort((a,b)=>a.localeCompare(b)).map(p => ({
      projeto: p,
      indicadores: map[p].sort((a,b)=>a.indicador.localeCompare(b.indicador)),
    }));
  }, [rows]);

  // agrupado por projeto (para diálogo de comparação)
  const groupedAllYear = useMemo(() => {
    const map = {};
    for (const r of allRowsYear) {
      const p = r.projeto || "(Sem projeto)";
      if (!map[p]) map[p] = [];
      map[p].push(r);
    }
    return Object.keys(map).sort((a,b)=>a.localeCompare(b)).map(p => ({
      projeto: p,
      indicadores: map[p].sort((a,b)=>a.indicador.localeCompare(b.indicador)),
    }));
  }, [allRowsYear]);

  const handleSetValor = (k, v, setter) => setter(prev => ({ ...prev, [k]: v }));
  const limparFiltros = () => setProjetosFiltro([]);

  // ADD
  const openAddDialog = () => {
    setAddProjeto("");
    setAddProjetoSug("");
    setAddIndicador("");
    setAddAno(ano);
    setAddValores(Object.fromEntries(MESES.map(m => [m.k, ""])));
    setAddOpen(true);
  };

  const salvarNovo = async () => {
    const projetoFinal = (addProjeto || addProjetoSug || "").trim();
    if (!projetoFinal || !addIndicador.trim()) {
      setSnack({ open: true, type: "error", text: "Informe projeto e indicador." });
      return;
    }
    const onlyFilled = {};
    for (const m of MESES) {
      const v = addValores[m.k];
      if (v !== "" && v !== null && v !== undefined) {
        onlyFilled[m.k] = toNumber(v);
      }
    }
    const tipo = inferTipoFromValues(onlyFilled);

    try {
      setSavingAdd(true);
      await axios.post("/indicadores/upsert", {
        projeto: projetoFinal,
        indicador: addIndicador.trim(),
        tipo,
        ano: addAno,
        valores: onlyFilled,
      });
      setSnack({ open: true, type: "success", text: "Indicador salvo!" });
      setAddOpen(false);
      await carregar(true);
      await carregarAllYear();
      if (!projetosOptions.includes(projetoFinal)) {
        setProjetosOptions(prev => [...prev, projetoFinal].sort((a,b)=>a.localeCompare(b)));
      }
    } catch {
      setSnack({ open: true, type: "error", text: "Erro ao salvar." });
    } finally {
      setSavingAdd(false);
    }
  };

  // EDIT
  const startEdit = (row) => {
    setEditKey(keyFor(row));
    setEditBuffer(JSON.parse(JSON.stringify(row)));
  };
  const cancelEdit = () => { setEditKey(null); setEditBuffer(null); };
  const saveEdit = async () => {
    if (!editBuffer) return;
    const body = {
      projeto: editBuffer.projeto,
      indicador: editBuffer.indicador,
      tipo: inferTipoFromValues(editBuffer.valores),
      ano: editBuffer.ano,
      valores: {},
    };
    for (const m of MESES) {
      const v = editBuffer.valores[m.k];
      if (v !== "" && v !== null && v !== undefined) {
        body.valores[m.k] = toNumber(v);
      }
    }
    try {
      await axios.post("/indicadores/upsert", body);
      setSnack({ open: true, type: "success", text: "Indicador atualizado!" });
      setEditKey(null);
      setEditBuffer(null);
      await carregar(true);
      await carregarAllYear();
    } catch {
      setSnack({ open: true, type: "error", text: "Erro ao atualizar." });
    }
  };

  // DELETE
  const excluir = async (row) => {
    if (!window.confirm(`Excluir "${row.indicador}" (${row.ano}) de "${row.projeto}"?`)) return;
    try {
      await axios.delete("/indicadores", {
        params: { projeto: row.projeto, indicador: row.indicador, ano: row.ano },
      });
      setSnack({ open: true, type: "success", text: "Indicador excluído!" });
      await carregar(true);
      await carregarAllYear();
    } catch {
      setSnack({ open: true, type: "error", text: "Erro ao excluir." });
    }
  };

  // CHART
  const openChart = (row) => {
    setChartRow(row);
    setCompareSeries([]);
    setCompareKeys([]);
    setChartOpen(true);
  };

  // dados do gráfico (múltiplas séries)
  const chartData = useMemo(() => {
    if (!chartRow) return [];
    const series = [chartRow, ...compareSeries];
    const labels = series.map(labelFor);
    return MESES.map(m => {
      const obj = { mes: m.l.toUpperCase() };
      for (let i = 0; i < series.length; i++) {
        const r = series[i];
        const v = r?.valores?.[m.k];
        obj[labels[i]] = (v === "" || v === null || v === undefined) ? null : Number(v);
      }
      return obj;
    });
  }, [chartRow, compareSeries]);

  const renderLines = () => {
    if (!chartRow) return null;
    const series = [chartRow, ...compareSeries];
    return series.map((r, idx) => {
      const dataKey = labelFor(r);
      const stroke = COLORS[idx % COLORS.length];
      return (
        <Line key={dataKey} type="monotone" dataKey={dataKey} stroke={stroke} strokeWidth={2} dot>
          <LabelList dataKey={dataKey} position="top" formatter={(v) => (v == null ? "" : v)} />
        </Line>
      );
    });
  };

  // DIÁLOGO COMPARAR — “estilo FOPAM”
  const openCompare = () => {
    const cmpOpen = {};
    groupedAllYear.forEach(sec => { cmpOpen[sec.projeto] = false; });
    setCompareOpenProj(cmpOpen);
    setCompareOpen(true);
  };

  const toggleCompareKey = (k) => {
    setCompareKeys(prev => prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k]);
  };

  const confirmCompare = async () => {
    try {
      setCompareLoading(true);
      const byKey = {};
      allRowsYear.forEach(r => { byKey[keyFor(r)] = r; });
      const picked = compareKeys
        .filter(k => !chartRow || k !== keyFor(chartRow))
        .map(k => byKey[k])
        .filter(Boolean);
      setCompareSeries(picked);
      setCompareOpen(false);
    } finally {
      setCompareLoading(false);
    }
  };

  return (
    <Box sx={{ p: 2, display: "grid", gap: 2 }}>
      {/* Filtros topo */}
      <Paper sx={{ p: 2, display: "grid", gap: 2 }}>
        <Typography variant="h6">Indicadores</Typography>
        <Stack direction="row" spacing={2} sx={{ flexWrap: "wrap" }}>
          <TextField
            label="Ano"
            select
            value={ano}
            onChange={(e) => setAno(Number(e.target.value))}
            sx={{ width: 140 }}
          >
            {anosList.map(y => <MenuItem key={y} value={y}>{y}</MenuItem>)}
          </TextField>

          <TextField
            label="Projetos (filtro)"
            select
            value={projetosFiltro}
            onChange={(e) => {
              const v = e.target.value;
              setProjetosFiltro(typeof v === "string" ? v.split(",") : v);
            }}
            SelectProps={{
              multiple: true,
              renderValue: (v) => (Array.isArray(v) ? v.join(", ") : ""),
              MenuProps: menuProps,
            }}
            sx={{ minWidth: { xs: 260, md: 360 } }}
          >
            {projetosOptions.map((p) => (
              <MenuItem key={p} value={p}>
                <Checkbox checked={projetosFiltro.indexOf(p) > -1} />
                <ListItemText primary={p} />
              </MenuItem>
            ))}
          </TextField>

          <Button onClick={limparFiltros}>Limpar</Button>

          <Box sx={{ flex: 1 }} />

          <Button variant="contained" startIcon={<AddIcon />} onClick={openAddDialog}>
            Novo Projeto/Indicador
          </Button>
        </Stack>
      </Paper>

      {/* Lista agrupada por projeto */}
      <Paper sx={{ p: 0, overflowX: "auto" }}>
        {loading ? (
          <Box sx={{ p: 2 }}>
            <LinearProgress />
            <Typography variant="body2" sx={{ mt: 1 }}>Carregando…</Typography>
          </Box>
        ) : grouped.length === 0 ? (
          <Box sx={{ p: 2 }}>
            <Typography color="text.secondary">Nenhum indicador para o filtro atual.</Typography>
          </Box>
        ) : (
          grouped.map(section => {
            const proj = section.projeto;
            const opened = !!openProjects[proj];
            return (
              <Box key={proj} sx={{ borderBottom: 1, borderColor: "divider" }}>
                {/* Cabeçalho do projeto */}
                <Box
                  sx={{ px: 2, py: 1.5, cursor: "pointer", display: "flex", alignItems: "center", bgcolor: "background.paper" }}
                  onClick={() => setOpenProjects(prev => ({ ...prev, [proj]: !prev[proj] }))}
                >
                  <IconButton size="small">
                    {opened ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  </IconButton>
                  <Typography variant="subtitle1" fontWeight="bold">{proj}</Typography>
                  <Typography variant="body2" sx={{ ml: 1, color: "text.secondary" }}>
                    — {section.indicadores.length} indicador(es)
                  </Typography>
                </Box>

                <Collapse in={opened} timeout="auto" unmountOnExit>
                  <Box sx={{ px: 2, pb: 2 }}>
                    <Table size="small" sx={{ minWidth: { xs: 1000, md: 1200 } }}>
                      <TableHead sx={HEAD_WRAP_SX}>
                        <TableRow>
                          <TableCell width={260}>Indicador</TableCell>
                          {MESES.map(m => <TableCell key={m.k} align="right">{m.l}</TableCell>)}
                          <TableCell align="center" width={190}>Ações</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {section.indicadores.map((row) => {
                          const k = keyFor(row);
                          const isEdit = editKey === k;
                          const buf = isEdit ? editBuffer : row;
                          return (
                            <TableRow key={k} hover>
                              <TableCell>{row.indicador}</TableCell>
                              {MESES.map(m => (
                                <TableCell key={m.k} align="right">
                                  {isEdit ? (
                                    <TextField
                                      type="number"
                                      size="medium"
                                      value={buf.valores[m.k] ?? ""}
                                      onChange={(e) => {
                                        const v = e.target.value;
                                        setEditBuffer(prev => ({
                                          ...prev,
                                          valores: { ...prev.valores, [m.k]: v }
                                        }));
                                      }}
                                      inputProps={{ step: "any" }}
                                      sx={CELL_SX}
                                    />
                                  ) : (
                                    (buf.valores[m.k] ?? "") !== "" ? buf.valores[m.k] : "-"
                                  )}
                                </TableCell>
                              ))}
                              <TableCell align="center">
                                {isEdit ? (
                                  <>
                                    <Button size="small" onClick={saveEdit}>Salvar</Button>
                                    <Button size="small" onClick={cancelEdit}>Cancelar</Button>
                                  </>
                                ) : (
                                  <>
                                    <Tooltip title="Editar">
                                      <IconButton size="small" onClick={() => startEdit(row)}>
                                        <EditIcon fontSize="small" />
                                      </IconButton>
                                    </Tooltip>
                                    <Tooltip title="Excluir">
                                      <IconButton size="small" onClick={() => excluir(row)}>
                                        <DeleteIcon fontSize="small" />
                                      </IconButton>
                                    </Tooltip>
                                    <Tooltip title="Visualizar / Comparar">
                                      <IconButton size="small" onClick={() => openChart(row)}>
                                        <ShowChartIcon fontSize="small" />
                                      </IconButton>
                                    </Tooltip>
                                  </>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </Box>
                </Collapse>
              </Box>
            );
          })
        )}
      </Paper>

      {/* Diálogo Novo Projeto/Indicador */}
      <Dialog open={addOpen} onClose={() => (savingAdd ? null : setAddOpen(false))} maxWidth="lg" fullWidth fullScreen={fullScreen}>
        <DialogTitle>Novo Projeto/Indicador</DialogTitle>
        <DialogContent dividers>
          {savingAdd && (
            <Box sx={{ mb: 2 }}>
              <LinearProgress />
              <Typography variant="body2" sx={{ mt: 1 }}>Carregando dados...</Typography>
            </Box>
          )}
          <Stack spacing={2} sx={{ opacity: savingAdd ? 0.6 : 1 }}>
            <Stack direction="row" spacing={2} sx={{ flexWrap: "wrap" }}>
              <TextField
                label="Projeto (sugerido – opcional)"
                select
                value={addProjetoSug}
                onChange={(e) => { setAddProjetoSug(e.target.value); setAddProjeto(e.target.value); }}
                sx={{ minWidth: { xs: 240, md: 300 } }}
              >
                <MenuItem value=""><em>— não usar sugestão —</em></MenuItem>
                {projetosOptions.map((p) => <MenuItem key={p} value={p}>{p}</MenuItem>)}
              </TextField>
              <TextField
                label="(ou) Projeto livre"
                value={addProjeto}
                onChange={(e) => setAddProjeto(e.target.value)}
                placeholder="Ex.: ASF - SUL/NORTE"
                sx={{ minWidth: { xs: 240, md: 300 } }}
              />
              <TextField
                label="Indicador"
                value={addIndicador}
                onChange={(e) => setAddIndicador(e.target.value)}
                sx={{ minWidth: { xs: 220, md: 260 } }}
                placeholder="Ex.: Horas, Plantões, Atendimentos"
              />
              <TextField
                label="Ano"
                select
                value={addAno}
                onChange={(e) => setAddAno(Number(e.target.value))}
                sx={{ width: 120 }}
              >
                {anosList.map(y => <MenuItem key={y} value={y}>{y}</MenuItem>)}
              </TextField>
            </Stack>

            <Box sx={{ overflowX: "auto" }}>
              <Table size="small" sx={{ minWidth: { xs: 1000, md: 1200 } }}>
                <TableHead sx={HEAD_WRAP_SX}>
                  <TableRow>
                    {MESES.map(m => <TableCell key={m.k} align="right">{m.l}</TableCell>)}
                  </TableRow>
                </TableHead>
                <TableBody>
                  <TableRow>
                    {MESES.map(m => (
                      <TableCell key={m.k} align="right">
                        <TextField
                          type="number"
                          size="medium"
                          value={addValores[m.k]}
                          inputProps={{ step: "any" }}
                          onChange={(e) => handleSetValor(m.k, e.target.value, setAddValores)}
                          sx={CELL_SX}
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                </TableBody>
              </Table>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddOpen(false)} disabled={savingAdd}>Cancelar</Button>
          <Button variant="contained" startIcon={<SaveIcon />} onClick={salvarNovo} disabled={savingAdd}>
            {savingAdd ? "Salvando..." : "Salvar indicador"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Gráfico */}
      <Dialog open={chartOpen} onClose={() => setChartOpen(false)} maxWidth="md" fullWidth fullScreen={fullScreen}>
        <DialogTitle>
          {chartRow ? `${chartRow.projeto} — ${chartRow.indicador} (${chartRow.ano})` : "Gráfico"}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 1, display: "flex", justifyContent: "flex-end" }}>
            <Button
              size="small"
              startIcon={<CompareIcon />}
              onClick={openCompare}
              disabled={!chartRow}
            >
              Comparar
            </Button>
          </Box>

          <Box sx={{ height: { xs: 300, md: 360 } }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mes" />
                <YAxis />
                <RTooltip />
                <Legend />
                {renderLines()}
              </LineChart>
            </ResponsiveContainer>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setChartOpen(false)}>Fechar</Button>
        </DialogActions>
      </Dialog>

      {/* Diálogo de Comparação — estilo FOPAM */}
      <Dialog open={compareOpen} onClose={() => (compareLoading ? null : setCompareOpen(false))} maxWidth="md" fullWidth fullScreen={fullScreen}>
        <DialogTitle>Comparar indicadores (Ano {ano})</DialogTitle>
        <DialogContent dividers>
          {compareLoading && (
            <Box sx={{ mb: 2 }}>
              <LinearProgress />
              <Typography variant="body2" sx={{ mt: 1 }}>Carregando…</Typography>
            </Box>
          )}

          <Paper variant="outlined" sx={{ p: 0 }}>
            {groupedAllYear.length === 0 ? (
              <Box sx={{ p: 2 }}>
                <Typography color="text.secondary">Nenhum indicador neste ano.</Typography>
              </Box>
            ) : (
              groupedAllYear.map(section => {
                const proj = section.projeto;
                const opened = !!compareOpenProj[proj];
                return (
                  <Box key={`cmp-${proj}`} sx={{ borderBottom: 1, borderColor: "divider" }}>
                    <Box
                      sx={{ px: 2, py: 1.2, cursor: "pointer", display: "flex", alignItems: "center", bgcolor: "background.paper" }}
                      onClick={() => setCompareOpenProj(prev => ({ ...prev, [proj]: !prev[proj] }))}
                    >
                      <IconButton size="small">
                        {opened ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                      </IconButton>
                      <Typography variant="subtitle2" fontWeight="bold">{proj}</Typography>
                      <Typography variant="body2" sx={{ ml: 1, color: "text.secondary" }}>
                        — {section.indicadores.length} indicador(es)
                      </Typography>
                    </Box>

                    <Collapse in={opened} timeout="auto" unmountOnExit>
                      <Box sx={{ px: 2, pb: 1 }}>
                        <Table size="small" sx={{ minWidth: { xs: 900, md: 1000 } }}>
                          <TableHead sx={HEAD_WRAP_SX}>
                            <TableRow>
                              <TableCell width={40}></TableCell>
                              <TableCell>Indicador</TableCell>
                              {MESES.map(m => <TableCell key={m.k} align="right">{m.l}</TableCell>)}
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {section.indicadores.map(r => {
                              const k = keyFor(r);
                              const disabled = chartRow && k === keyFor(chartRow);
                              const checked = compareKeys.includes(k);
                              return (
                                <TableRow key={`cmp-row-${k}`} hover>
                                  <TableCell>
                                    <Checkbox
                                      size="small"
                                      disabled={!!disabled}
                                      checked={checked}
                                      onChange={() => toggleCompareKey(k)}
                                    />
                                  </TableCell>
                                  <TableCell>{r.indicador}</TableCell>
                                  {MESES.map(m => (
                                    <TableCell key={m.k} align="right">
                                      {(r.valores[m.k] ?? "") !== "" ? r.valores[m.k] : "-"}
                                    </TableCell>
                                  ))}
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </Box>
                    </Collapse>
                  </Box>
                );
              })
            )}
          </Paper>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCompareOpen(false)} disabled={compareLoading}>Cancelar</Button>
          <Button variant="contained" onClick={confirmCompare} disabled={compareLoading || !chartRow}>
            {compareLoading ? "Aplicando..." : "Aplicar comparação"}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snack.open}
        autoHideDuration={3000}
        onClose={() => setSnack(s => ({ ...s, open: false }))}
      >
        <Alert severity={snack.type} sx={{ width: "100%" }}>{snack.text}</Alert>
      </Snackbar>
    </Box>
  );
}
