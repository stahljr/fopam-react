// src/Relatorios.js

import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Button,
  TextField,
  Switch,
  FormControlLabel,
  Checkbox,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  MenuItem,
  ListItemText,
} from "@mui/material";
import axios from "axios";
import FileDownloadIcon from "@mui/icons-material/FileDownload";

export default function Relatorios() {
  const [projetos, setProjetos] = useState([]);
  const [selectedProjetos, setSelectedProjetos] = useState([]);
  const [tipoFiltroData, setTipoFiltroData] = useState("pagamento");
  const [dateIni, setDateIni] = useState("");
  const [dateFim, setDateFim] = useState("");
  const [loading, setLoading] = useState(false);
  const [dados, setDados] = useState([]);

  useEffect(() => {
    axios.get("/projetos").then(res => setProjetos(res.data || []));
  }, []);

  const handleGerarRelatorio = async () => {
    setLoading(true);
    try {
      const res = await axios.get("/relatorios", {
        params: {
          projetos: selectedProjetos.join(","),
          tipo_data: tipoFiltroData,
          data_ini: dateIni,
          data_fim: dateFim,
        },
      });
      setDados(res.data || []);
    } catch {
      setDados([]);
    }
    setLoading(false);
  };

  const handleExportar = async () => {
    try {
      const res = await axios.get("/relatorios/export", {
        params: {
          projetos: selectedProjetos.join(","),
          tipo_data: tipoFiltroData,
          data_ini: dateIni,
          data_fim: dateFim,
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

  return (
    <Box sx={{ p: 3 }}>
      {/* filtros sem fundo extra */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
        <TextField
          select
          label="Projetos"
          value={selectedProjetos}
          onChange={e => setSelectedProjetos(e.target.value)}
          SelectProps={{
            multiple: true,
            renderValue: v => v.join(", "),
          }}
          variant="outlined"
          size="small"
          sx={{ minWidth: 200 }}
        >
          {projetos.map(p => (
            <MenuItem key={p} value={p}>
              <Checkbox checked={selectedProjetos.includes(p)} />
              <ListItemText primary={p} />
            </MenuItem>
          ))}
        </TextField>

        <FormControlLabel
          control={
            <Switch
              checked={tipoFiltroData === "pagamento"}
              onChange={() => setTipoFiltroData("pagamento")}
            />
          }
          label="Data de Pagamento"
        />
        <FormControlLabel
          control={
            <Switch
              checked={tipoFiltroData === "servico"}
              onChange={() => setTipoFiltroData("servico")}
            />
          }
          label="Data de Serviço"
        />

        <TextField
          label="Data Inicial"
          type="date"
          value={dateIni}
          onChange={e => setDateIni(e.target.value)}
          InputLabelProps={{ shrink: true }}
          size="small"
          sx={{ minWidth: 150 }}
        />
        <TextField
          label="Data Final"
          type="date"
          value={dateFim}
          onChange={e => setDateFim(e.target.value)}
          InputLabelProps={{ shrink: true }}
          size="small"
          sx={{ minWidth: 150 }}
        />

        <Button
          variant="contained"
          onClick={handleGerarRelatorio}
          disabled={loading}
        >
          Gerar Relatório
        </Button>
        <Button
          variant="outlined"
          startIcon={<FileDownloadIcon />}
          onClick={handleExportar}
          disabled={!dados.length}
        >
          Exportar
        </Button>
      </Box>

      {/* resultado */}
      <Box sx={{ mt: 3 }}>
        {dados.length === 0 ? (
          <Typography>Nenhum dado encontrado.</Typography>
        ) : (
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
                  <TableCell align="right">
                    {parseFloat(r.pagamento).toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })}
                  </TableCell>
                  <TableCell align="right">
                    {parseFloat(r.faturamento).toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })}
                  </TableCell>
                  <TableCell>{r.nf_servico}</TableCell>
                  <TableCell>{r.nf_faturamento}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Box>
    </Box>
);
}
