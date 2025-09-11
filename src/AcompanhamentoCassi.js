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
const defaultResumoRow = () => ({
  captador: "", aberto: 0, agendado: 0, realizado: 0, atendido: 0, no_show: 0, andamento: 0, total: 0,
});
const EPS_KEYS = ["previstos","realizados","no_show"];
const GUIAS_KEYS = ["exames_realizados","guias_faturadas","gap","guias_a_lancar","sfat"];

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
          <Tab label="Meta Mensal" />
          <Tab label="Andamento EPS" />
          <Tab label="Guias" />
          <Tab label="Dependências (Semanas)" />
          <Tab label="Acompanhamento Diário" />
        </Tabs>
      </Paper>

      {tab === 0 && <ResumoCaptador setSnack={setSnack} />}
      {tab === 1 && <MetaMensal setSnack={setSnack} />}
      {tab === 2 && <SerieMensal kind="eps" title="Andamento EPS" keysDef={EPS_KEYS} colors={["#1f77b4","#ff7f0e","#2ca02c"]} setSnack={setSnack} />}
      {tab === 3 && <SerieMensal kind="guias" title="Guias" keysDef={GUIAS_KEYS} colors={["#1f77b4","#ff7f0e","#2ca02c","#17becf","#9467bd"]} setSnack={setSnack} />}
      {tab === 4 && <DependenciasSemanais setSnack={setSnack} />}
      {tab === 5 && <AcompanhamentoDiario setSnack={setSnack} />}

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

// ===== Resumo por Captador (GERAL com fallback para mês atual) =====
function ResumoCaptador({ setSnack }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [fallbackInfo, setFallbackInfo] = useState(null); // string | null

  const totals = useMemo(()=>{
    const acc = {aberto:0, agendado:0, realizado:0, atendido:0, no_show:0, andamento:0, total:0};
    for (const r of rows) {
      acc.aberto += +r.aberto||0;
      acc.agendado += +r.agendado||0;
      acc.realizado += +r.realizado||0;
      acc.atendido += +r.atendido||0;
      acc.no_show += +r.no_show||0;
      acc.andamento += +r.andamento||0;
      acc.total += +r.total||0;
    }
    return acc;
  },[rows]);

  const load = async () => {
    setLoading(true);
    setFallbackInfo(null);
    try {
      // 1) tenta GERAL (sem params)
      const r1 = await axios.get("/cassi/resumo");
      const arr1 = Array.isArray(r1.data) ? r1.data : [];
      if (arr1.length > 0) {
        setRows(arr1);
        return;
      }

      // 2) fallback: mês atual (para não ficar sem dados)
      const now = new Date();
      const mes = String(now.getMonth()+1).padStart(2,"0");
      const periodoStr = `${now.getFullYear()}-${mes}`;
      const r2 = await axios.get("/cassi/resumo", { params: { mes: periodoStr }});
      setRows(Array.isArray(r2.data) ? r2.data : []);
      setFallbackInfo(`Sem suporte a "geral" no backend; exibindo mês ${mesesNomes[Number(mes)-1].toUpperCase()}/${now.getFullYear()}.`);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(()=>{ load(); }, []);

  const addRow = () => setRows(prev => [...prev, defaultResumoRow()]);
  const delRow = (idx) => setRows(prev => prev.filter((_,i)=>i!==idx));

  const save = async () => {
    try {
      await axios.post("/cassi/resumo/upsert", { rows });
      setSnack({ open:true, type:"success", text:"Resumo salvo!" });
      await load();
      setEditMode(false);
    } catch {
      setSnack({ open:true, type:"error", text:"Falha ao salvar Resumo." });
    }
  };

  return (
    <Paper sx={{ p: 2 }}>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1, flexWrap: "wrap" }}>
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

      {fallbackInfo && (
        <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display:"block" }}>
          {fallbackInfo}
        </Typography>
      )}

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
                      value={r.captador || ""}
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
                            const n=[...prev];
                            n[idx] = { ...n[idx], [k]: val };
                            return n;
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

            {/* Totais */}
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

// ===== Meta Mensal =====
function MetaMensal({ setSnack }) {
  const [ano, setAno] = useState(new Date().getFullYear());
  const [meses, setMeses] = useState(["05","06","07","08","09","10"]);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [editMode, setEditMode] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await axios.get("/cassi/meta", { params: { ano, meses: meses.join(",") }});
      setRows(Array.isArray(r.data) ? r.data : []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(()=>{ load(); /* eslint-disable-next-line */ }, [ano, meses.join(",")]);

  const addRow = () => {
    const metas = {};
    meses.forEach(m => metas[m] = { meta: "", realizado: "", diferenca: "" });
    setRows(prev => [...prev, { captador: "", metas }]);
  };
  const delRow = (idx) => setRows(prev => prev.filter((_,i)=>i!==idx));

  const save = async () => {
    try {
      await axios.post("/cassi/meta/upsert", { ano, meses, rows });
      setSnack({ open:true, type:"success", text:"Metas salvas!" });
      await load();
      setEditMode(false);
    } catch {
      setSnack({ open:true, type:"error", text:"Falha ao salvar Metas." });
    }
  };

  const toggleMes = (m) => setMeses(prev => prev.includes(m) ? prev.filter(x=>x!==m) : [...prev, m].sort());

  return (
    <Paper sx={{ p: 2 }}>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2, flexWrap: "wrap" }}>
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
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small" sx={{ minWidth: 1000 }}>
            <TableHead>
              <TableRow>
                <TableCell>Captador</TableCell>
                {meses.map(m=>(
                  <TableCell key={m} align="center" sx={{ minWidth: 260 }}>
                    <Typography variant="subtitle2">{mesesNomes[Number(m)-1].toUpperCase()}</Typography>
                    <Divider />
                    <Stack direction="row" spacing={2} justifyContent="space-between" sx={{ mt: .5 }}>
                      <Typography variant="caption" sx={{ width: 70, textAlign:"right" }}>Meta</Typography>
                      <Typography variant="caption" sx={{ width: 90, textAlign:"right" }}>Realizado</Typography>
                      <Typography variant="caption" sx={{ width: 90, textAlign:"right" }}>Diferença</Typography>
                    </Stack>
                  </TableCell>
                ))}
                {editMode && <TableCell align="center" width={60}>Ações</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((r, idx)=>(
                <TableRow key={idx} hover>
                  <TableCell sx={{ minWidth: 220 }}>
                    {editMode ? (
                      <TextField
                        size="small"
                        fullWidth
                        placeholder="Nome (ou Time)"
                        value={r.captador || ""}
                        onChange={(e)=>setRows(prev=>{
                          const n=[...prev]; n[idx]={...n[idx], captador:e.target.value}; return n;
                        })}
                      />
                    ) : (r.captador || "-")}
                  </TableCell>

                  {meses.map(m=>{
                    const cell = r.metas?.[m] || { meta:"", realizado:"", diferenca:"" };
                    return (
                      <TableCell key={m} align="center">
                        {editMode ? (
                          <Stack direction="row" spacing={2} justifyContent="space-between">
                            <TextField
                              size="small" type="number" sx={{ width: 70 }}
                              value={cell.meta}
                              onChange={(e)=>setRows(prev=>{
                                const n=[...prev]; const metas={...(n[idx].metas||{})};
                                metas[m]={ ...(metas[m]||{}), meta: e.target.value === "" ? "" : Number(e.target.value) };
                                n[idx]={...n[idx], metas}; return n;
                              })}
                              inputProps={{ step:"any" }}
                            />
                            <TextField
                              size="small" type="number" sx={{ width: 90 }}
                              value={cell.realizado}
                              onChange={(e)=>setRows(prev=>{
                                const n=[...prev]; const metas={...(n[idx].metas||{})};
                                metas[m]={ ...(metas[m]||{}), realizado: e.target.value === "" ? "" : Number(e.target.value) };
                                n[idx]={...n[idx], metas}; return n;
                              })}
                              inputProps={{ step:"any" }}
                            />
                            <TextField
                              size="small" type="number" sx={{ width: 90 }}
                              value={cell.diferenca}
                              onChange={(e)=>setRows(prev=>{
                                const n=[...prev]; const metas={...(n[idx].metas||{})};
                                metas[m]={ ...(metas[m]||{}), diferenca: e.target.value === "" ? "" : Number(e.target.value) };
                                n[idx]={...n[idx], metas}; return n;
                              })}
                              inputProps={{ step:"any" }}
                            />
                          </Stack>
                        ) : (
                          <Stack direction="row" spacing={2} justifyContent="space-between">
                            <Typography sx={{ width: 70, textAlign:"right" }}>{valueOrDash(cell.meta)}</Typography>
                            <Typography sx={{ width: 90, textAlign:"right" }}>{valueOrDash(cell.realizado)}</Typography>
                            <Typography sx={{ width: 90, textAlign:"right" }}>{valueOrDash(cell.diferenca)}</Typography>
                          </Stack>
                        )}
                      </TableCell>
                    );
                  })}

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
            </TableBody>
          </Table>
        </Box>
      )}
    </Paper>
  );
}

// ===== Séries Mensais (EPS / Guias) =====
function SerieMensal({ kind, title, keysDef, colors, setSnack }) {
  const [ano, setAno] = useState(new Date().getFullYear());
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await axios.get(`/cassi/series/${kind}`, { params: { ano }});
      setData(r.data || {});
    } catch {
      setData({});
    } finally {
      setLoading(false);
    }
  };

  useEffect(()=>{ load(); /* eslint-disable-next-line */ }, [ano]);

  const save = async () => {
    try {
      await axios.post(`/cassi/series/${kind}/upsert`, { ano, data });
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
                <TableCell key={k} align="right" sx={{ textTransform:"capitalize" }}>{k.replaceAll("_"," ")}</TableCell>
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
            <Legend />
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
  const [ano, setAno] = useState(2025);
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
          {/* Tabelas de entrada por mês (apenas em modo edição) */}
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

          {/* Linha do tempo */}
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
    const t = new Date(); t.setMonth(8); t.setDate(12); // 12/set (ajuste livre)
    return iso(t);
  });
  const [dateEnd, setDateEnd] = useState(() => {
    const t = new Date(); t.setMonth(11); t.setDate(31);
    return iso(t);
  });

  const [diarioLoading, setDiarioLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // dados "originais" vindos do backend (lista)
  const [rows, setRows] = useState([]); // [{data, uf, valor}]

  // mapa original (para diff): uf -> { dateISO: number|null }
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

  // draft (buffer de edição): uf -> { dateISO: number|null|"" }
  const [draft, setDraft] = useState({});

  // colunas de datas no período
  const colDates = useMemo(()=>{
    const a = new Date(dateStart), b = new Date(dateEnd);
    const out = [];
    for(let d=new Date(a); d<=b; d=addDays(d,1)) out.push(iso(d));
    return out;
  }, [dateStart, dateEnd]);

  // carrega dados + semanal
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

  // Quando entra em modo edição, inicializa draft a partir do originalMap (somente período atual)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editMode, originalMap, colDates.join("|")]);

  // há alterações?
  const hasChanges = useMemo(()=>{
    if (!editMode) return false;
    for (const uf of UFS) {
      const origRow = originalMap[uf] || {};
      const draftRow = draft[uf] || {};
      for (const d of colDates) {
        const o = (origRow[d] === undefined ? null : origRow[d]);
        const v = (draftRow[d] === undefined ? null : draftRow[d]);
        // tratar vazio "" como null
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

      // salva em "lote" com Promise.all (mantendo o endpoint atual /cassi/diario/upsert)
      await Promise.all(
        payloads.map(p => axios.post("/cassi/diario/upsert", p))
      );

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

  // Tabela usa draft quando em edição; senão, usa originalMapa
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
