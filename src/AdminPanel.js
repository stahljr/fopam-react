// src/AdminPanel.js

import React, { useEffect, useState } from "react";
import {
  Box, Typography, Table, TableHead, TableRow, TableCell, TableBody,
  Button, Switch, Select, MenuItem, IconButton, CircularProgress
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import axios from "axios";

const ROLES = ["admin", "gestor", "operador"];

export default function AdminPanel() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(null); // id do usuário sendo aprovado

  // Carrega a lista de usuários
  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await axios.get("/users");
      setUsers(res.data);
    } catch (err) {
      // trate erros aqui, se quiser
    }
    setLoading(false);
  };

  // Aprovar usuário e enviar convite
  const handleApprove = async (user) => {
    setApproving(user.id);
    try {
      await axios.post("/users/approve", { id: user.id });
      await fetchUsers();
      alert("Convite enviado! O usuário recebeu um e-mail para criar a senha.");
    } catch (e) {
      alert("Erro ao aprovar: " + (e.response?.data?.error || e.message));
    }
    setApproving(null);
  };

  // Ativar/desativar usuário já ativo
  const handleUpdate = (email, updates) => {
    axios.post("/users/update", { email, ...updates }).then(() => {
      setUsers(users => users.map(u => u.email === email ? { ...u, ...updates } : u));
    });
  };

  // Trocar role
  const handleRoleChange = (email, newRole) => {
    handleUpdate(email, { role: newRole });
  };

  // Excluir usuário
  const handleDelete = (email) => {
    axios.post("/users/delete", { email }).then(() => {
      setUsers(users => users.filter(u => u.email !== email));
    });
  };

  return (
    <Box p={3}>
      <Typography variant="h5" gutterBottom>Administração de Usuários</Typography>
      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Nome</TableCell>
              <TableCell>E-mail</TableCell>
              <TableCell>Tipo</TableCell>
              <TableCell>Ativo</TableCell>
              <TableCell>Ações</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.map(user => (
              <TableRow key={user.email}>
                <TableCell>{user.name}</TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>
                  <Select
                    value={user.role}
                    onChange={e => handleRoleChange(user.email, e.target.value)}
                    size="small"
                  >
                    {ROLES.map(role => (
                      <MenuItem value={role} key={role}>{role}</MenuItem>
                    ))}
                  </Select>
                </TableCell>
                <TableCell>
                  {!user.active ? (
                    <Button
                      variant="contained"
                      color="success"
                      size="small"
                      disabled={approving === user.id}
                      onClick={() => handleApprove(user)}
                    >
                      {approving === user.id ? <CircularProgress size={18} /> : "Aprovar & Enviar Convite"}
                    </Button>
                  ) : (
                    <Switch
                      checked={!!user.active}
                      onChange={e => handleUpdate(user.email, { active: e.target.checked })}
                    />
                  )}
                </TableCell>
                <TableCell>
                  <IconButton color="error" onClick={() => handleDelete(user.email)}>
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Box>
  );
}
