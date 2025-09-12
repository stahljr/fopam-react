// src/AcompanhamentoCassi.js
import React, { useEffect, useMemo, useState } from "react";
import {
  Box, Paper, Typography, Stack, TextField, MenuItem, Button, IconButton,
  Table, TableHead, TableRow, TableCell, TableBody, Tooltip, Snackbar, Alert,
  Divider, Tabs, Tab, LinearProgress, Checkbox, Switch, Chip
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import SaveIcon from "@mui/icons-material/Save";
import RefreshIcon from "@mui/icons-material/Refresh";
import EditIcon from "@mui/icons-material/Edit";
import CloseIcon from "@mui/icons-material/Close";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  Tooltip as RTooltip, CartesianGrid, Legend, LabelList
} from "recharts";
import axios from "axios";

// ===== Helpers =====
const mesesNomes = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
const mesesOpt = [...Array(12)].map((_,i)=>({value: String(i+1).padStart(2,"0"), label: mesesNomes[i]}));
const anosList = (() => {
  const y = new Date().getFullYear();
  return [y - 1, y, y + 1];
})();

const pct = (num, den) => {
  const n = Number(num), d = Number(den);
  if (!isFinite(n) || !isFinite(d) || d === 0) return "-";
  return (100 * n / d).toFixed(1) + "%";
};
const valueOrDash = (v) => (v === null || v === undefined || v === "" ? "-" : v);
const pctOrDash = pct;

// Diário
const UFS = [
  "DELTA","AC","AM","AP","BA","CE","ES","GO","MA","MG","MS","MT",
  "PA","PE","PI","PR","RJ","RN","RO","RR","RS","SP","TO"
];
const COLORS = [
  "#1f77b4","#ff7f0e","#2ca02c","#d62728","#9467bd",
  "#8c564b","#e377c2","#7f7f7f","#bcbd22","#17becf",
  "#003f5c","#58508d","#bc5090","#ff6361","#ffa600"
];
const iso = (d) => d.toISOString().slice(0,10);
const addDays = (d, n) => { const x=new Date(d); x.setDate(x.getDate()+n); return x; };

// === NOVO: definição dos campos EPS (UI) ===
// UI mostra estes 3 campos. O backend pode usar 'previsto_atendimento' OU 'previstos'.
// O componente SerieMensal tem um keyMap para converter automaticamente.
const EPS_FIELDS = [
  { key: "agendado",   label: "Agendado" },   // mapeado para previsto_atendimento/previstos no backend
  { key: "realizados", label: "Realizado" },
  { key: "no_show",    label: "No Show" },
];

// Guias (permanece como estava)
const GUIAS_KEYS = ["exames_realizados","guias_faturadas","gap","guias_a_lancar","sfat"];

// ===== Componente Principal =====
export default function AcompanhamentoCassi() {
  const [tab, setTab] = useState(0);
  const [snack, setSnack] = useState({ open:false, type:"success", text:"" });

  return (
    <Box sx={{ p: 2, display: "grid", gap: 2 }}>
      <Typography variant="h5" fontWeight="bold">Acompanhamento CASSI</Typography>

      <Paper sx={{ p: 1 }}>
        <Tabs value={tab} onChange={(_,v)=>setTab(v)} variant="scrollable" allowScrollButtonsMobile>
          <Tab label="Resumo por Captador" />
          <Tab label="Resumo por EPS" />
          <Tab label="Resumo por Dependência" />
          <Tab label="Andamento EPS" />
          <Tab label="Guias" />
          <Tab label="Dependências Em Aberto" />
          <Tab label="Acompanhamento Diário" />
        </Tabs>
      </Paper>

      {tab === 0 && <ResumoCaptador setSnack={setSnack} />}
      {tab === 1 && <ResumoPorEPS setSnack={setSnack} />}
      {tab === 2 && <ResumoDependencia setSnack={setSnack} />}

      {tab === 3 && (
        <SerieMensal
          kind="eps"
          title="Andamento EPS"
          keysDef={EPS_FIELDS.map(f => f.key)}
          labelMap={Object.fromEntries(EPS_FIELDS.map(f => [f.key, f.label]))}
          colors={["#1f77b4","#ff7f0e","#2ca02c"]}
          setSnack={setSnack}
          // Mapeamento UI -> Backend e Backend -> UI
          keyMap={{
            toBackend: { agendado: ["previsto_atendimento","previstos"], realizados: "realizados", no_show: "no_show" },
            fromBackendCandidates: { agendado: ["previsto_atendimento","previstos"], realizados: ["realizados"], no_show: ["no_show"] }
          }}
        />
      )}

      {tab === 4 && (
        <SerieMensal
          kind="guias"
          title="Guias"
          keysDef={GUIAS_KEYS}
          labelMap={null}
          colors={["#1f77b4","#ff7f0e","#2ca02c","#17becf","#9467bd"]}
          setSnack={setSnack}
        />
      )}
      {tab === 5 && <DependenciasSemanais setSnack={setSnack} />}
      {tab === 6 && <AcompanhamentoDiario setSnack={setSnack} />}

      <Snackbar
        open={snack.open}
        autoHideDuration={3000}
        onClose={()=>setSnack(s=>({...s,open:false}))}
      >
        <Alert severity={snack.type} variant="filled">{snack.text}</Alert>
      </Snackbar>
    </Box>
  );
}

// ===== Resumo por Captador (COM MÊS, salva em lote) =====
function ResumoCaptador({ setSnack }) {
  const today = new Date();
  const [ano, setAno] = useState(today.getFullYear());
  const [mes, setMes] = useState(String(today.getMonth()+1).padStart(2,"0"));

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);

  const totals = useMemo(()=>{
    const acc = {aberto:0, agendado:0, realizado:0, atendido:0, no_show:0, andamento:0, total:0};
    for (const r of rows) {
      acc.aberto    += +r.aberto    || 0;
      acc.agendado  += +r.agendado  || 0;
      acc.realizado += +r.realizado || 0;
      acc.atendido  += +r.atendido  || 0;
      acc.no_show   += +r.no_show   || 0;
      acc.andamento += +r.andamento || 0;
      acc.total     += +r.total     || 0;
    }
    return acc;
  },[rows]);

  const periodoStr = `${ano}-${mes}`;

  const load = async () => {
    setLoading(true);
    try {
      const r = await axios.get("/cassi/resumo", { params: { mes: periodoStr }});
      setRows(Array.isArray(r.data) ? r.data : []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(()=>{ load(); /* eslint-disable-next-line */ }, [ano, mes]);

  const addRow = () => setRows(prev => [...prev, {
    captador:"", aberto:"", agendado:"", realizado:"", atendido:"", no_show:"", andamento:"", total:""
  }]);

  const delRow = (idx) => setRows(prev => prev.filter((_,i)=>i!==idx));

  const save = async () => {
    try {
      await axios.post("/cassi/resumo/upsert", { mes: periodoStr, rows });
      setSnack({ open:true, type:"success", text:"Resumo salvo!" });
      await load();
      setEditMode(false);
    } catch {
      setSnack({ open:true, type:"error", text:"Falha ao salvar Resumo." });
    }
  };

  return (
    <Paper sx={{ p: 2 }}>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2, flexWrap: "wrap" }}>
        <TextField select label="Ano" value={ano} onChange={(e)=>setAno(Number(e.target.value))} sx={{ width: 140 }}>
          {anosList.map(y=><MenuItem key={y} value={y}>{y}</MenuItem>)}
        </TextField>
        <TextField select label="Mês" value={mes} onChange={(e)=>setMes(e.target.value)} sx={{ width: 160 }}>
          {mesesOpt.map(m=><MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>)}
        </TextField>
        <Box sx={{ flex:1 }} />
        <Stack direction="row" alignItems="center" spacing={1}>
          <EditIcon fontSize="small" />
          <Switch checked={editMode} onChange={(e)=>setEditMode(e.target.checked)} />
          <Typography variant="body2">{editMode ? "Modo edição" : "Somente leitura"}</Typography>
        </Stack>
        <Button startIcon={<RefreshIcon />} onClick={load} disabled={loading}>
          {loading ? "Carregando..." : "Recarregar"}
        </Button>
        {editMode && (
          <>
            <Button variant="contained" startIcon={<SaveIcon />} onClick={save} disabled={loading}>
              Salvar
            </Button>
            <Button variant="outlined" startIcon={<AddIcon />} onClick={addRow} disabled={loading}>
              Adicionar linha
            </Button>
          </>
        )}
      </Stack>

      {loading ? (
        <Box sx={{ p: 2 }}><LinearProgress /><Typography variant="body2" sx={{ mt: 1 }}>Carregando…</Typography></Box>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Captador</TableCell>
              <TableCell align="right">Aberto</TableCell>
              <TableCell align="right">Agendado</TableCell>
              <TableCell align="right">Realizado</TableCell>
              <TableCell align="right">Atendido</TableCell>
              <TableCell align="right">No Show</TableCell>
              <TableCell align="right">Andamento</TableCell>
              <TableCell align="right">Total</TableCell>
              {editMode && <TableCell align="center" width={60}>Ações</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r, idx) => (
              <TableRow key={idx} hover>
                <TableCell>
                  {editMode ? (
                    <TextField
                      value={r.captador ?? ""}
                      onChange={(e)=>setRows(prev=>{
                        const n=[...prev]; n[idx]={...n[idx],captador:e.target.value}; return n;
                      })}
                      size="small"
                      placeholder="Nome"
                      fullWidth
                    />
                  ) : (r.captador || "-")}
                </TableCell>

                {["aberto","agendado","realizado","atendido","no_show","andamento","total"].map((k)=>(
                  <TableCell key={k} align="right" sx={{ whiteSpace:"nowrap" }}>
                    <Stack direction="row" spacing={1} justifyContent="flex-end" alignItems="center">
                      {editMode ? (
                        <TextField
                          value={r[k] ?? ""}
                          onChange={(e)=>setRows(prev=>{
                            const val = e.target.value === "" ? "" : Number(e.target.value);
                            const n=[...prev]; n[idx] = { ...n[idx], [k]: val }; return n;
                          })}
                          type="number"
                          size="small"
                          sx={{ width: 110 }}
                          inputProps={{ step:"any" }}
                        />
                      ) : <Typography>{valueOrDash(r[k])}</Typography>}
                      <Typography variant="caption" color="text.secondary">
                        {k==="total" ? "-" : pct(r[k], r.total)}
                      </Typography>
                    </Stack>
                  </TableCell>
                ))}

                {editMode && (
                  <TableCell align="center">
                    <Tooltip title="Excluir">
                      <IconButton size="small" onClick={()=>delRow(idx)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                )}
              </TableRow>
            ))}

            <TableRow>
              <TableCell sx={{ fontWeight: "bold" }}>Total</TableCell>
              <TableCell align="right" sx={{ fontWeight: "bold" }}>{valueOrDash(totals.aberto)}</TableCell>
              <TableCell align="right" sx={{ fontWeight: "bold" }}>{valueOrDash(totals.agendado)}</TableCell>
              <TableCell align="right" sx={{ fontWeight: "bold" }}>{valueOrDash(totals.realizado)}</TableCell>
              <TableCell align="right" sx={{ fontWeight: "bold" }}>{valueOrDash(totals.atendido)}</TableCell>
              <TableCell align="right" sx={{ fontWeight: "bold" }}>{valueOrDash(totals.no_show)}</TableCell>
              <TableCell align="right" sx={{ fontWeight: "bold" }}>{valueOrDash(totals.andamento)}</TableCell>
              <TableCell align="right" sx={{ fontWeight: "bold" }}>{valueOrDash(totals.total)}</TableCell>
              {editMode && <TableCell />}
            </TableRow>
          </TableBody>
        </Table>
      )}
    </Paper>
  );
}

// ===== Resumo por EPS (por UF) =====
function ResumoPorEPS({ setSnack }) {
  const today = new Date();
  const [ano, setAno] = useState(today.getFullYear());
  const [mes, setMes] = useState(String(today.getMonth()+1).padStart(2,"0"));
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const periodoStr = `${ano}-${mes}`;

  const UFS_ALL = [
    "AC","AM","AP","BA","CE","ES","GO","MA","MG","MS","MT",
    "PA","PE","PI","PR","RJ","RN","RO","RR","RS","SP","TO"
  ];

  const totals = useMemo(()=>{
    const acc = {aberto:0, agendado:0, realizado:0, atendido:0, no_show:0, total:0};
    for (const r of rows) {
      acc.aberto   += +r.aberto   || 0;
      acc.agendado += +r.agendado || 0;
      acc.realizado+= +r.realizado|| 0;
      acc.atendido += +r.atendido || 0;
      acc.no_show  += +r.no_show  || 0;
      acc.total    += +r.total    || 0;
    }
    return acc;
  }, [rows]);

  const load = async () => {
    setLoading(true);
    try {
      const r = await axios.get("/cassi/resumo-eps", { params: { mes: periodoStr }});
      const arr = Array.isArray(r.data) ? r.data : [];
      const map = new Map(arr.map(x => [x.uf, x]));
      const completed = UFS_ALL.map(uf => map.get(uf) || { uf, aberto:"", agendado:"", realizado:"", atendido:"", no_show:"", total:"" });
      setRows(completed);
    } catch {
      setRows(UFS_ALL.map(uf => ({ uf, aberto:"", agendado:"", realizado:"", atendido:"", no_show:"", total:"" })));
    } finally {
      setLoading(false);
    }
  };
  useEffect(()=>{ load(); /* eslint-disable-next-line */ }, [ano, mes]);

  const setVal = (idx, key, value) => {
    setRows(prev => {
      const n = [...prev];
      n[idx] = { ...n[idx], [key]: (value==="" ? "" : Number(value)) };
      return n;
    });
  };

  const save = async () => {
    try {
      await axios.post("/cassi/resumo-eps/upsert", { mes: periodoStr, rows });
      setSnack({ open:true, type:"success", text:"Resumo por EPS salvo!" });
      await load();
      setEditMode(false);
    } catch {
      setSnack({ open:true, type:"error", text:"Falha ao salvar Resumo por EPS." });
    }
  };

  return (
    <Paper sx={{ p:2 }}>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb:2, flexWrap:"wrap" }}>
        <TextField select label="Ano" value={ano} onChange={(e)=>setAno(Number(e.target.value))} sx={{ width: 140 }}>
          {anosList.map(y=><MenuItem key={y} value={y}>{y}</MenuItem>)}
        </TextField>
        <TextField select label="Mês" value={mes} onChange={(e)=>setMes(e.target.value)} sx={{ width: 160 }}>
          {mesesOpt.map(m=><MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>)}
        </TextField>
        <Box sx={{ flex:1 }} />
        <Stack direction="row" alignItems="center" spacing={1}>
          <EditIcon fontSize="small" />
          <Switch checked={editMode} onChange={(e)=>setEditMode(e.target.checked)} />
          <Typography variant="body2">{editMode ? "Modo edição" : "Somente leitura"}</Typography>
        </Stack>
        <Button startIcon={<RefreshIcon />} onClick={load} disabled={loading}>
          {loading ? "Carregando..." : "Recarregar"}
        </Button>
        {editMode && (
          <Button variant="contained" startIcon={<SaveIcon />} onClick={save} disabled={loading}>
            Salvar
          </Button>
        )}
      </Stack>

      {loading ? (
        <Box sx={{ p:2 }}><LinearProgress /><Typography variant="body2" sx={{ mt:1 }}>Carregando…</Typography></Box>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>UF</TableCell>
              <TableCell align="right">Em Aberto</TableCell>
              <TableCell align="right">Agendado</TableCell>
              <TableCell align="right">Realizado</TableCell>
              <TableCell align="right">Atendido</TableCell>
              <TableCell align="right">No Show</TableCell>
              <TableCell align="right">Andamento</TableCell>
              <TableCell align="right">Total</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r, idx)=>(
              <TableRow key={r.uf} hover>
                <TableCell sx={{ fontWeight: 600 }}>{r.uf}</TableCell>

                {["aberto","agendado","realizado","atendido","no_show"].map(k=>(
                  <TableCell key={k} align="right">
                    <Stack direction="row" spacing={1} justifyContent="flex-end" alignItems="center">
                      {editMode ? (
                        <TextField
                          type="number" size="small" sx={{ width: 110 }}
                          value={r[k] ?? ""} onChange={(e)=>setVal(idx, k, e.target.value)}
                          inputProps={{ step:"any" }}
                        />
                      ) : <Typography>{valueOrDash(r[k])}</Typography>}
                      <Typography variant="caption" color="text.secondary">
                        {k==="no_show" ? "-" : pctOrDash(r[k], r.total)}
                      </Typography>
                    </Stack>
                  </TableCell>
                ))}

                <TableCell align="right">{pctOrDash(r.realizado, r.total)}</TableCell>

                <TableCell align="right">
                  {editMode ? (
                    <TextField
                      type="number" size="small" sx={{ width: 110 }}
                      value={r.total ?? ""} onChange={(e)=>setVal(idx, "total", e.target.value)}
                      inputProps={{ step:"any" }}
                    />
                  ) : (valueOrDash(r.total))}
                </TableCell>
              </TableRow>
            ))}

            <TableRow>
              <TableCell sx={{ fontWeight: "bold" }}>Total</TableCell>
              <TableCell align="right" sx={{ fontWeight: "bold" }}>{valueOrDash(totals.aberto)}</TableCell>
              <TableCell align="right" sx={{ fontWeight: "bold" }}>{valueOrDash(totals.agendado)}</TableCell>
              <TableCell align="right" sx={{ fontWeight: "bold" }}>{valueOrDash(totals.realizado)}</TableCell>
              <TableCell align="right" sx={{ fontWeight: "bold" }}>{valueOrDash(totals.atendido)}</TableCell>
              <TableCell align="right" sx={{ fontWeight: "bold" }}>{valueOrDash(totals.no_show)}</TableCell>
              <TableCell align="right" sx={{ fontWeight: "bold" }}>{pctOrDash(totals.realizado, totals.total)}</TableCell>
              <TableCell align="right" sx={{ fontWeight: "bold" }}>{valueOrDash(totals.total)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      )}
    </Paper>
  );
}

// ===== Resumo por Dependência (por UF) =====
function ResumoDependencia({ setSnack }) {
  const today = new Date();
  const [ano, setAno] = useState(today.getFullYear());
  const [mes, setMes] = useState(String(today.getMonth()+1).padStart(2,"0"));
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const periodoStr = `${ano}-${mes}`;

  const UFS_ALL = [
    "AC","AM","AP","BA","CE","ES","GO","MA","MG","MS","MT",
    "PA","PE","PI","PR","RJ","RN","RO","RR","RS","SP","TO"
  ];

  const totals = useMemo(()=>{
    const acc = {aberto:0, agendado:0, realizado:0, total:0};
    for (const r of rows) {
      acc.aberto   += +r.aberto   || 0;
      acc.agendado += +r.agendado || 0;
      acc.realizado+= +r.realizado|| 0;
      acc.total    += +r.total    || 0;
    }
    return acc;
  }, [rows]);

  const load = async () => {
    setLoading(true);
    try {
      const r = await axios.get("/cassi/resumo-dependencia", { params: { mes: periodoStr }});
      const arr = Array.isArray(r.data) ? r.data : [];
      const map = new Map(arr.map(x => [x.uf, x]));
      const completed = UFS_ALL.map(uf => map.get(uf) || { uf, aberto:"", agendado:"", realizado:"", andamento:"", total:"" });
      setRows(completed);
    } catch {
      setRows(UFS_ALL.map(uf => ({ uf, aberto:"", agendado:"", realizado:"", andamento:"", total:"" })));
    } finally {
      setLoading(false);
    }
  };
  useEffect(()=>{ load(); /* eslint-disable-next-line */ }, [ano, mes]);

  const setVal = (idx, key, value) => {
    setRows(prev => {
      const n = [...prev];
      n[idx] = { ...n[idx], [key]: (value==="" ? "" : Number(value)) };
      return n;
    });
  };

  const save = async () => {
    try {
      await axios.post("/cassi/resumo-dependencia/upsert", { mes: periodoStr, rows });
      setSnack({ open:true, type:"success", text:"Resumo por Dependência salvo!" });
      await load();
      setEditMode(false);
    } catch {
      setSnack({ open:true, type:"error", text:"Falha ao salvar Resumo por Dependência." });
    }
  };

  return (
    <Paper sx={{ p:2 }}>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb:2, flexWrap:"wrap" }}>
        <TextField select label="Ano" value={ano} onChange={(e)=>setAno(Number(e.target.value))} sx={{ width: 140 }}>
          {anosList.map(y=><MenuItem key={y} value={y}>{y}</MenuItem>)}
        </TextField>
        <TextField select label="Mês" value={mes} onChange={(e)=>setMes(e.target.value)} sx={{ width: 160 }}>
          {mesesOpt.map(m=><MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>)}
        </TextField>
        <Box sx={{ flex:1 }} />
        <Stack direction="row" alignItems="center" spacing={1}>
          <EditIcon fontSize="small" />
          <Switch checked={editMode} onChange={(e)=>setEditMode(e.target.checked)} />
          <Typography variant="body2">{editMode ? "Modo edição" : "Somente leitura"}</Typography>
        </Stack>
        <Button startIcon={<RefreshIcon />} onClick={load} disabled={loading}>
          {loading ? "Carregando..." : "Recarregar"}
        </Button>
        {editMode && (
          <Button variant="contained" startIcon={<SaveIcon />} onClick={save} disabled={loading}>
            Salvar
          </Button>
        )}
      </Stack>

      {loading ? (
        <Box sx={{ p:2 }}><LinearProgress /><Typography variant="body2" sx={{ mt:1 }}>Carregando…</Typography></Box>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>UF</TableCell>
              <TableCell align="right">Em Aberto</TableCell>
              <TableCell align="right">Agendado</TableCell>
              <TableCell align="right">Realizado</TableCell>
              <TableCell align="right">Andamento</TableCell>
              <TableCell align="right">Total</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r, idx)=>(
              <TableRow key={r.uf} hover>
                <TableCell sx={{ fontWeight: 600 }}>{r.uf}</TableCell>

                {["aberto","agendado","realizado"].map(k=>(
                  <TableCell key={k} align="right">
                    <Stack direction="row" spacing={1} justifyContent="flex-end" alignItems="center">
                      {editMode ? (
                        <TextField
                          type="number" size="small" sx={{ width: 110 }}
                          value={r[k] ?? ""} onChange={(e)=>setVal(idx, k, e.target.value)}
                          inputProps={{ step:"any" }}
                        />
                      ) : <Typography>{valueOrDash(r[k])}</Typography>}
                      <Typography variant="caption" color="text.secondary">
                        {pctOrDash(r[k], r.total)}
                      </Typography>
                    </Stack>
                  </TableCell>
                ))}

                <TableCell align="right">{pctOrDash(r.realizado, r.total)}</TableCell>

                <TableCell align="right">
                  {editMode ? (
                    <TextField
                      type="number" size="small" sx={{ width: 110 }}
                      value={r.total ?? ""} onChange={(e)=>setVal(idx, "total", e.target.value)}
                      inputProps={{ step:"any" }}
                    />
                  ) : (valueOrDash(r.total))}
                </TableCell>
              </TableRow>
            ))}

            <TableRow>
              <TableCell sx={{ fontWeight: "bold" }}>Total</TableCell>
              <TableCell align="right" sx={{ fontWeight: "bold" }}>{valueOrDash(totals.aberto)}</TableCell>
              <TableCell align="right" sx={{ fontWeight: "bold" }}>{valueOrDash(totals.agendado)}</TableCell>
              <TableCell align="right" sx={{ fontWeight: "bold" }}>{valueOrDash(totals.realizado)}</TableCell>
              <TableCell align="right" sx={{ fontWeight: "bold" }}>{pctOrDash(totals.realizado, totals.total)}</TableCell>
              <TableCell align="right" sx={{ fontWeight: "bold" }}>{valueOrDash(totals.total)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      )}
    </Paper>
  );
}

// ===== Séries Mensais (EPS / Guias) =====
function SerieMensal({ kind, title, keysDef, labelMap, colors, setSnack, keyMap }) {
  const [ano, setAno] = useState(new Date().getFullYear());
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);

  // helpers para mapear chaves entre UI <-> backend (opcional)
  const fromBackend = (backendMonthObj) => {
    if (!keyMap) return backendMonthObj || {};
    const out = {};
    for (const uiKey of keysDef) {
      const candidates = keyMap.fromBackendCandidates?.[uiKey] || [uiKey];
      let found = null;
      for (const cand of candidates) {
        if (backendMonthObj?.[cand] !== undefined) { found = backendMonthObj[cand]; break; }
      }
      out[uiKey] = found;
    }
    return out;
  };
  const toBackend = (uiMonthObj) => {
    if (!keyMap) return uiMonthObj || {};
    const out = {};
    for (const uiKey of keysDef) {
      const backendName = Array.isArray(keyMap.toBackend?.[uiKey])
        ? keyMap.toBackend[uiKey][0]              // prioriza o primeiro nome
        : (keyMap.toBackend?.[uiKey] || uiKey);
      out[backendName] = uiMonthObj?.[uiKey];
    }
    return out;
  };

  const load = async () => {
    setLoading(true);
    try {
      const r = await axios.get(`/cassi/series/${kind}`, { params: { ano }});
      const raw = r.data || {};
      // converte mês a mês se houver keyMap
      const normalized = {};
      for (const m of Object.keys(raw)) {
        normalized[m] = fromBackend(raw[m]);
      }
      setData(normalized);
    } catch {
      setData({});
    } finally {
      setLoading(false);
    }
  };

  useEffect(()=>{ load(); /* eslint-disable-next-line */ }, [ano]);

  const save = async () => {
    try {
      // aplica conversão por mês na ida
      const payload = {};
      for (const m of Object.keys(data || {})) {
        payload[m] = toBackend(data[m]);
      }
      await axios.post(`/cassi/series/${kind}/upsert`, { ano, data: payload });
      setSnack({ open:true, type:"success", text:`${title} salvo!` });
      await load();
      setEditMode(false);
    } catch {
      setSnack({ open:true, type:"error", text:`Falha ao salvar ${title}.` });
    }
  };

  const handleSet = (m, k, val) => {
    setData(prev => {
      const month = { ...(prev[m] || {}) };
      month[k] = val === "" ? "" : Number(val);
      return { ...prev, [m]: month };
    });
  };

  const chartData = useMemo(()=>{
    return mesesOpt.map(m => {
      const row = { mes: m.label.toUpperCase() };
      keysDef.forEach(k => {
        const v = data?.[m.value]?.[k];
        row[k] = (v === "" || v === null || v === undefined) ? null : Number(v);
      });
      return row;
    });
  }, [data, keysDef]);

  const legendFormatter = (value) => {
    if (!labelMap) return value.replaceAll("_"," ");
    return labelMap[value] || value;
  };

  return (
    <Paper sx={{ p: 2 }}>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h6">{title}</Typography>
        <Box sx={{ flex:1 }} />
        <Stack direction="row" alignItems="center" spacing={1}>
          <EditIcon fontSize="small" />
          <Switch checked={editMode} onChange={(e)=>setEditMode(e.target.checked)} />
          <Typography variant="body2">{editMode ? "Modo edição" : "Somente leitura"}</Typography>
        </Stack>
        <TextField select label="Ano" value={ano} onChange={(e)=>setAno(Number(e.target.value))} sx={{ width: 140 }}>
          {anosList.map(y=><MenuItem key={y} value={y}>{y}</MenuItem>)}
        </TextField>
        <Button startIcon={<RefreshIcon />} onClick={load} disabled={loading}>
          {loading ? "Carregando..." : "Recarregar"}
        </Button>
        {editMode && (
          <Button variant="contained" startIcon={<SaveIcon />} onClick={save} disabled={loading}>
            Salvar
          </Button>
        )}
      </Stack>

      <Box sx={{ overflowX: "auto" }}>
        <Table size="small" sx={{ minWidth: 1000 }}>
          <TableHead>
            <TableRow>
              <TableCell>Mês</TableCell>
              {keysDef.map(k => (
                <TableCell key={k} align="right" sx={{ textTransform:"capitalize" }}>
                  {labelMap ? (labelMap[k] || k) : k.replaceAll("_"," ")}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {mesesOpt.map(m => (
              <TableRow key={m.value} hover>
                <TableCell sx={{ textTransform:"capitalize" }}>{m.label}</TableCell>
                {keysDef.map((k) => (
                  <TableCell key={k} align="right">
                    {editMode ? (
                      <TextField
                        size="small"
                        type="number"
                        value={data?.[m.value]?.[k] ?? ""}
                        onChange={(e)=>handleSet(m.value, k, e.target.value)}
                        inputProps={{ step:"any" }}
                        sx={{ width: 140 }}
                      />
                    ) : (
                      <Typography>{valueOrDash(data?.[m.value]?.[k])}</Typography>
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>

      <Box sx={{ mt: 3, height: { xs: 280, md: 360 } }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="mes" />
            <YAxis />
            <RTooltip />
            <Legend formatter={legendFormatter} />
            {keysDef.map((k, idx) => (
              <Line key={k} type="monotone" dataKey={k} stroke={colors[idx % colors.length]} strokeWidth={2} dot connectNulls={false}>
                <LabelList dataKey={k} position="top" formatter={(v)=> (v==null ? "" : v)} />
              </Line>
            ))}
          </LineChart>
        </ResponsiveContainer>
      </Box>
    </Paper>
  );
}

// ===== Dependências Semanais =====
function DependenciasSemanais({ setSnack }) {
  const [ano, setAno] = useState(new Date().getFullYear());
  const [meses, setMeses] = useState(["09","10","11","12"]);
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await axios.get("/cassi/dependencias", { params: { ano, meses: meses.join(",") }});
      setData(r.data || {});
    } catch {
      setData({});
    } finally {
      setLoading(false);
    }
  };

  useEffect(()=>{ load(); /* eslint-disable-next-line */ }, [ano, meses.join(",")]);

  const save = async () => {
    try {
      await axios.post("/cassi/dependencias/upsert", { ano, data });
      setSnack({ open:true, type:"success", text:"Dependências salvas!" });
      await load();
      setEditMode(false);
    } catch {
      setSnack({ open:true, type:"error", text:"Falha ao salvar Dependências." });
    }
  };

  const toggleMes = (m) => setMeses(prev => prev.includes(m) ? prev.filter(x=>x!==m) : [...prev, m].sort());
  const setWeekVal = (m, w, val) => {
    setData(prev => {
      const month = { ...(prev[m] || {}) };
      month[w] = (val === "" ? "" : Number(val));
      return { ...prev, [m]: month };
    });
  };

  const chartData = useMemo(()=>{
    const items = [];
    meses.forEach(m => {
      for (let w=1; w<=5; w++) {
        const key = String(w);
        const label = `${mesesNomes[Number(m)-1]} S${w}`;
        const v = data?.[m]?.[key];
        items.push({ periodo: label.toUpperCase(), valor: (v===""||v==null? null : Number(v)) });
      }
    });
    return items;
  }, [data, meses]);

  return (
    <Paper sx={{ p: 2 }}>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2, flexWrap:"wrap" }}>
        <TextField select label="Ano" value={ano} onChange={(e)=>setAno(Number(e.target.value))} sx={{ width: 140 }}>
          {anosList.map(y=><MenuItem key={y} value={y}>{y}</MenuItem>)}
        </TextField>

        <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap:"wrap" }}>
          {mesesOpt.map(m => (
            <Stack key={m.value} direction="row" alignItems="center" sx={{ mr: 1 }}>
              <Checkbox checked={meses.includes(m.value)} onChange={()=>toggleMes(m.value)} size="small" />
              <Typography variant="body2" sx={{ textTransform:"capitalize" }}>{m.label}</Typography>
            </Stack>
          ))}
        </Stack>

        <Box sx={{ flex:1 }} />
        <Stack direction="row" alignItems="center" spacing={1}>
          <EditIcon fontSize="small" />
          <Switch checked={editMode} onChange={(e)=>setEditMode(e.target.checked)} />
          <Typography variant="body2">{editMode ? "Modo edição" : "Somente leitura"}</Typography>
        </Stack>
        <Button startIcon={<RefreshIcon />} onClick={load} disabled={loading}>
          {loading ? "Carregando..." : "Recarregar"}
        </Button>
        {editMode && (
          <Button variant="contained" startIcon={<SaveIcon />} onClick={save} disabled={loading}>
            Salvar
          </Button>
        )}
      </Stack>

      {loading ? (
        <Box sx={{ p: 2 }}><LinearProgress /><Typography variant="body2" sx={{ mt: 1 }}>Carregando…</Typography></Box>
      ) : (
        <Box sx={{ display: "grid", gap: 2 }}>
          {editMode && meses.map(m => (
            <Paper key={m} variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle1" sx={{ mb: 1, textTransform:"capitalize" }}>
                {mesesNomes[Number(m)-1]} / {ano}
              </Typography>
              <Stack direction="row" spacing={2} alignItems="center" sx={{ flexWrap:"wrap" }}>
                {[1,2,3,4,5].map(w => (
                  <Stack key={w} spacing={0.5} sx={{ width: 140 }}>
                    <Typography variant="caption">Semana {w}</Typography>
                    <TextField
                      size="small"
                      type="number"
                      value={data?.[m]?.[String(w)] ?? ""}
                      onChange={(e)=>setWeekVal(m, String(w), e.target.value)}
                      inputProps={{ step:"any" }}
                    />
                  </Stack>
                ))}
              </Stack>
            </Paper>
          ))}

          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle1" sx={{ mb: 1 }}>Linha do tempo (Semanas)</Typography>
            <Box sx={{ height: { xs: 280, md: 340 } }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="periodo" />
                  <YAxis />
                  <RTooltip />
                  <Legend />
                  <Line type="monotone" dataKey="valor" stroke="#1f77b4" strokeWidth={2} dot connectNulls={false}>
                    <LabelList dataKey="valor" position="top" formatter={(v)=> (v==null?"":v)} />
                  </Line>
                </LineChart>
              </ResponsiveContainer>
            </Box>
          </Paper>
        </Box>
      )}
    </Paper>
  );
}

// ===== Acompanhamento Diário (EDITA EM BUFFER E SALVA EM LOTE) =====
function AcompanhamentoDiario({ setSnack }) {
  const [editMode, setEditMode] = useState(false);
  const [dateStart, setDateStart] = useState(() => {
    const t = new Date(); t.setMonth(8); t.setDate(12);
    return iso(t);
  });
  const [dateEnd, setDateEnd] = useState(() => {
    const t = new Date(); t.setMonth(11); t.setDate(31);
    return iso(t);
  });

  const [diarioLoading, setDiarioLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [rows, setRows] = useState([]); // [{data, uf, valor}]

  const originalMap = useMemo(() => {
    const map = {};
    for (const uf of UFS) map[uf] = {};
    for (const r of (rows || [])) {
      const uf = (r.uf || "").toUpperCase();
      if (!map[uf]) map[uf] = {};
      map[uf][r.data] = (r.valor === "" || r.valor == null) ? null : Number(r.valor);
    }
    return map;
  }, [rows]);

  const [draft, setDraft] = useState({});

  const colDates = useMemo(()=>{
    const a = new Date(dateStart), b = new Date(dateEnd);
    const out = [];
    for(let d=new Date(a); d<=b; d=addDays(d,1)) out.push(iso(d));
    return out;
  }, [dateStart, dateEnd]);

  const [weekly, setWeekly] = useState([]);

  const load = async ()=>{
    if(!dateStart || !dateEnd) return;
    setDiarioLoading(true);
    try {
      const r = await axios.get("/cassi/diario", { params: { start: dateStart, end: dateEnd }});
      setRows(r.data || []);
    } catch {
      setRows([]);
    } finally { setDiarioLoading(false); }
  };
  const loadWeekly = async ()=>{
    if(!dateStart || !dateEnd) return;
    try {
      const r = await axios.get("/cassi/diario/weekly", { params: { start: dateStart, end: dateEnd }});
      setWeekly(r.data || []);
    } catch { setWeekly([]); }
  };

  useEffect(()=>{ load(); loadWeekly(); /* eslint-disable-next-line */ }, [dateStart, dateEnd]);

  useEffect(()=>{
    if (editMode) {
      const init = {};
      for (const uf of UFS) {
        init[uf] = {};
        for (const d of colDates) {
          const orig = originalMap?.[uf]?.[d];
          init[uf][d] = (orig === undefined ? null : orig);
        }
      }
      setDraft(init);
    } else {
      setDraft({});
    }
    /* eslint-disable-next-line */
  }, [editMode, originalMap, colDates.join("|")]);

  const hasChanges = useMemo(()=>{
    if (!editMode) return false;
    for (const uf of UFS) {
      const origRow = originalMap[uf] || {};
      const draftRow = draft[uf] || {};
      for (const d of colDates) {
        const o = (origRow[d] === undefined ? null : origRow[d]);
        const v = (draftRow[d] === undefined ? null : draftRow[d]);
        const oo = (o === "" ? null : o);
        const vv = (v === "" ? null : v);
        if (oo !== vv) return true;
      }
    }
    return false;
  }, [editMode, originalMap, draft, colDates]);

  const onChangeCell = (uf, dateISO, raw) => {
    setDraft(prev => {
      const copy = { ...(prev || {}) };
      const row = { ...(copy[uf] || {}) };
      row[dateISO] = raw === "" ? "" : Number(raw);
      copy[uf] = row;
      return copy;
    });
  };

  const discard = async () => {
    setDraft({});
    setEditMode(false);
    await load();
    await loadWeekly();
  };

  const save = async () => {
    if (!hasChanges) {
      setSnack({ open:true, type:"info", text:"Nenhuma alteração para salvar." });
      return;
    }
    setSaving(true);
    try {
      const payloads = [];
      for (const uf of UFS) {
        const origRow = originalMap[uf] || {};
        const draftRow = draft[uf] || {};
        for (const d of colDates) {
          const o = (origRow[d] === undefined ? null : origRow[d]);
          const v = (draftRow[d] === undefined ? null : draftRow[d]);
          const oo = (o === "" ? null : o);
          const vv = (v === "" ? null : v);
          if (oo !== vv) {
            payloads.push({ data: d, uf, valor: vv });
          }
        }
      }

      await Promise.all(payloads.map(p => axios.post("/cassi/diario/upsert", p)));

      setSnack({ open:true, type:"success", text:"Alterações salvas!" });
      await load();
      await loadWeekly();
      setEditMode(false);
    } catch {
      setSnack({ open:true, type:"error", text:"Falha ao salvar alterações." });
    } finally {
      setSaving(false);
    }
  };

  const getCellValue = (uf, d) => {
    if (editMode) {
      const v = draft?.[uf]?.[d];
      return v ?? "";
    }
    const o = originalMap?.[uf]?.[d];
    return (o == null ? null : o);
  };

  return (
    <Paper sx={{ p:2, display:"grid", gap:2 }}>
      <Stack direction="row" spacing={2} sx={{ flexWrap:"wrap", alignItems:"center" }}>
        <TextField
          label="Início" type="date" value={dateStart}
          onChange={(e)=>setDateStart(e.target.value)}
          InputLabelProps={{ shrink:true }} size="small"
        />
        <TextField
          label="Fim" type="date" value={dateEnd}
          onChange={(e)=>setDateEnd(e.target.value)}
          InputLabelProps={{ shrink:true }} size="small"
        />
        <Button startIcon={<RefreshIcon />} onClick={()=>{ load(); loadWeekly(); }} disabled={diarioLoading || saving}>
          {(diarioLoading || saving) ? "Carregando..." : "Atualizar"}
        </Button>
        <Box sx={{ flex:1 }} />
        {editMode && (
          <>
            {hasChanges && (
              <Chip label="Alterações não salvas" color="warning" size="small" sx={{ mr: 1 }} />
            )}
            <Button
              variant="outlined"
              startIcon={<CloseIcon />}
              onClick={discard}
              disabled={saving}
              sx={{ mr: 1 }}
            >
              Descartar
            </Button>
            <Button
              variant="contained"
              startIcon={<SaveIcon />}
              onClick={save}
              disabled={!hasChanges || saving}
            >
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </>
        )}
        <Stack direction="row" alignItems="center" spacing={1} sx={{ ml: editMode ? 1 : 0 }}>
          <EditIcon fontSize="small" />
          <Switch checked={editMode} onChange={(e)=>setEditMode(e.target.checked)} />
          <Typography variant="body2">{editMode ? "Modo edição" : "Somente leitura"}</Typography>
        </Stack>
      </Stack>

      {(diarioLoading && !editMode) ? <LinearProgress /> : (
        <>
          <Box sx={{ overflowX:"auto" }}>
            <Table size="small" sx={{ minWidth: Math.max(1000, colDates.length*110) }}>
              <TableHead>
                <TableRow>
                  <TableCell>UF</TableCell>
                  {colDates.map(d=>(
                    <TableCell key={d} align="right">
                      {new Date(d).toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit"})}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {UFS.map((uf)=>(
                  <TableRow key={uf} hover>
                    <TableCell sx={{ fontWeight: uf==="DELTA" ? 700 : 400 }}>{uf}</TableCell>
                    {colDates.map((d)=>{
                      const v = getCellValue(uf, d);
                      return (
                        <TableCell key={`${uf}-${d}`} align="right">
                          {editMode ? (
                            <TextField
                              type="number"
                              value={v ?? ""}
                              onChange={(e)=>onChangeCell(uf, d, e.target.value)}
                              size="small"
                              inputProps={{ step:"any", style:{ textAlign:"right" }}}
                              sx={{ minWidth: 100 }}
                            />
                          ) : (
                            v==null ? "-" : v
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>

          <Typography variant="subtitle1" sx={{ mt:2 }}>Evolução Semanal (DELTA)</Typography>
          <Box sx={{ height: 340 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weekly} margin={{top:10,right:20,left:0,bottom:0}}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" />
                <YAxis />
                <RTooltip />
                <Legend />
                <Line type="monotone" dataKey="total" stroke={COLORS[0]} strokeWidth={2} dot />
              </LineChart>
            </ResponsiveContainer>
          </Box>
        </>
      )}
    </Paper>
  );
}
