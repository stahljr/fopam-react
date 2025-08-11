// src/Relatorios.js
import React, { useState, useEffect, useMemo } from "react";
import {
  Box,
  Typography,
  Button,
  TextField,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Checkbox,
  MenuItem,
  ListItemText,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
} from "@mui/material";
import axios from "axios";
import FileDownloadIcon from "@mui/icons-material/FileDownload";

const menuProps = {
  PaperProps: { style: { maxHeight: 320 } },
};

function formatBRL(v) {
  const n = Number(v);
  if (!isFinite(n)) return "-";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function Relatorios() {
  const [projetos, setProjetos] = useState([]);
  const [selectedProjetos, setSelectedProjetos] = useState([]);
  const [tipoFiltroData, setTipoFiltroData] = useState("pagamento"); // "pagamento" | "servico"
  const [dateIni, setDateIni] = useState("");
  const [dateFim, setDateFim] = useState("");
  const [loading, setLoading] = useState(false);
  const [dados, setDados] = useState([]);

  useEffect(() => {
    // carrega TODOS os projetos existentes no Supabase (sem filtrar por mês)
    axios.get("/projetos").then((res) => {
      const arr = Array.isArray(res.data) ? res.data : [];
      setProjetos(arr);
    });
  }, []);

  const handleGerarRelatorio = async () => {
    setLoading(true);
    try {
      const res = await axios.get("/relatorios", {
        params: {
          projetos: selectedProjetos.join(","),
          tipo_data: tipoFiltroData,
          data_ini: dateIni || undefined,
          data_fim: dateFim || undefined,
        },
      });
      setDados(res.data || []);
    } catch {
      setDados([]);
    } finally {
      setLoading(false);
    }
  };

  const handleExportar = async () => {
    try {
      const res = await axios.get("/relatorios/export", {
        params: {
          projetos: selectedProjetos.join(","),
          tipo_data: tipoFiltroData,
          data_ini: dateIni || undefined,
          data_fim: dateFim || undefined,
        },
        responseType: "blob",
      });
      const blob = new Blob([res.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "relatorio_fopam.xlsx";
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      alert("Erro ao exportar relatório.");
    }
  };

  const limparFiltros = () => {
    setSelectedProjetos([]);
    setTipoFiltroData("pagamento");
    setDateIni("");
    setDateFim("");
    setDados([]);
  };

  // totais (opcional, útil pra conferência)
  const totais = useMemo(() => {
    const soma = (key) =>
      dados.reduce((acc, r) => {
        const n = Number(r?.[key]);
        return acc + (isFinite(n) ? n : 0);
      }, 0);
    return {
      pagamento: soma("pagamento"),
      faturamento: soma("faturamento"),
    };
  }, [dados]);

  return (
    <Box sx={{ p: 3 }}>
      {/* filtros */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "minmax(260px, 1fr) auto auto auto auto auto",
          gap: 2,
          alignItems: "center",
          mb: 2,
        }}
      >
        <TextField
          select
          label="Projetos"
          value={selectedProjetos}
          onChange={(e) => {
            const v = e.target.value;
            setSelectedProjetos(typeof v === "string" ? v.split(",") : v);
          }}
          SelectProps={{
            multiple: true,
            renderValue: (v) => (Array.isArray(v) ? v.join(", ") : ""),
            MenuProps: menuProps,
          }}
          variant="outlined"
          size="small"
          sx={{ minWidth: 260 }}
        >
          {projetos.map((p) => (
            <MenuItem key={p} value={p}>
              <Checkbox checked={selectedProjetos.indexOf(p) > -1} />
              <ListItemText primary={p} />
            </MenuItem>
          ))}
        </TextField>

        <FormControl component="fieldset" sx={{ ml: 1 }}>
          <FormLabel component="legend" sx={{ mb: 0.5 }}>
            Base da data
          </FormLabel>
          <RadioGroup
            row
            value={tipoFiltroData}
            onChange={(e) => setTipoFiltroData(e.target.value)}
          >
            <FormControlLabel value="pagamento" control={<Radio />} label="Pagamento" />
            <FormControlLabel value="servico" control={<Radio />} label="Serviço" />
          </RadioGroup>
        </FormControl>

        <TextField
          label="Data Inicial"
          type="date"
          value={dateIni}
          onChange={(e) => setDateIni(e.target.value)}
          InputLabelProps={{ shrink: true }}
          size="small"
          sx={{ minWidth: 160 }}
        />
        <TextField
          label="Data Final"
          type="date"
          value={dateFim}
          onChange={(e) => setDateFim(e.target.value)}
          InputLabelProps={{ shrink: true }}
          size="small"
          sx={{ minWidth: 160 }}
        />

        <Button variant="contained" onClick={handleGerarRelatorio} disabled={loading}>
          {loading ? "Gerando..." : "Gerar Relatório"}
        </Button>
        <Button
          variant="outlined"
          startIcon={<FileDownloadIcon />}
          onClick={handleExportar}
          disabled={!dados.length}
        >
          Exportar
        </Button>
        <Button color="inherit" onClick={limparFiltros}>
          Limpar
        </Button>
      </Box>

      {/* resultado */}
      <Box sx={{ mt: 3 }}>
        {dados.length === 0 ? (
          <Typography color="text.secondary">Nenhum dado encontrado.</Typography>
        ) : (
          <>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Projeto</TableCell>
                  <TableCell>Profissional</TableCell>
                  <TableCell>Data Serviço</TableCell>
                  <TableCell>Data Pagamento</TableCell>
                  <TableCell align="right">Pagamento</TableCell>
                  <TableCell align="right">Faturamento</TableCell>
                  <TableCell>NF Serviço</TableCell>
                  <TableCell>NF Faturamento</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {dados.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell>{r.projeto}</TableCell>
                    <TableCell>{r.profissional}</TableCell>
                    <TableCell>{r.data_servico}</TableCell>
                    <TableCell>{r.data_pagamento}</TableCell>
                    <TableCell align="right">{formatBRL(r.pagamento)}</TableCell>
                    <TableCell align="right">{formatBRL(r.faturamento)}</TableCell>
                    <TableCell>{r.nf_servico || ""}</TableCell>
                    <TableCell>{r.nf_faturamento || ""}</TableCell>
                  </TableRow>
                ))}
                {/* Linha de totais */}
                <TableRow>
                  <TableCell colSpan={4} align="right" sx={{ fontWeight: "bold" }}>
                    Totais:
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: "bold" }}>
                    {formatBRL(totais.pagamento)}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: "bold" }}>
                    {formatBRL(totais.faturamento)}
                  </TableCell>
                  <TableCell colSpan={2} />
                </TableRow>
              </TableBody>
            </Table>
          </>
        )}
      </Box>
    </Box>
  );
}
