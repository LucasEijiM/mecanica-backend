const express = require('express');
const crypto = require('crypto');
const { carregarAgendamentos, salvarAgendamentos, carregarUsuarios, carregarVeiculos } = require('../db');
const {
  validarAgendamento,
  validarAtualizacaoAgendamento,
} = require('../validators/validarAgendamento');

const router = express.Router();

// GET /api/agendamentos
// Lista agendamentos. Aceita ?clienteId=..., ?mecanicoId=..., ?data=AAAA-MM-DD e/ou ?status=...
router.get('/agendamentos', (req, res) => {
  const { clienteId, mecanicoId, data, status } = req.query;
  let agendamentos = carregarAgendamentos();

  if (clienteId) {
    agendamentos = agendamentos.filter((a) => a.clienteId === clienteId);
  }
  if (mecanicoId) {
    agendamentos = agendamentos.filter((a) => a.mecanicoId === mecanicoId);
  }
  if (data) {
    agendamentos = agendamentos.filter((a) => a.data === data);
  }
  if (status) {
    agendamentos = agendamentos.filter((a) => a.status === status);
  }

  return res.json({ sucesso: true, agendamentos });
});

// GET /api/agendamentos/:id
router.get('/agendamentos/:id', (req, res) => {
  const agendamento = carregarAgendamentos().find((a) => a.id === req.params.id);

  if (!agendamento) {
    return res.status(404).json({ sucesso: false, erros: ['Agendamento não encontrado.'] });
  }

  return res.json({ sucesso: true, agendamento });
});

// POST /api/agendamentos
// Body esperado: { clienteId, mecanicoId, veiculoId, data, hora, servicos, status?, observacoes? }
router.post('/agendamentos', (req, res) => {
  const { clienteId, mecanicoId, veiculoId, data, hora, servicos, status, observacoes } = req.body;

  // 1. Validar campos
  const erros = validarAgendamento({ clienteId, mecanicoId, veiculoId, data, hora, servicos, status, observacoes });
  if (erros.length > 0) {
    return res.status(400).json({ sucesso: false, erros });
  }

  const usuarios = carregarUsuarios();

  // 2. Verificar se o cliente existe e é do tipo "cliente"
  const cliente = usuarios.find((u) => u.uid === clienteId);
  if (!cliente || cliente.tipo !== 'cliente') {
    return res.status(404).json({ sucesso: false, erros: ['Cliente não encontrado.'] });
  }
  if (!cliente.ativo) {
    return res.status(409).json({ sucesso: false, erros: ['Cliente está inativo.'] });
  }

  // 3. Verificar se o mecânico existe e é do tipo "mecanico"
  const mecanico = usuarios.find((u) => u.uid === mecanicoId);
  if (!mecanico || mecanico.tipo !== 'mecanico') {
    return res.status(404).json({ sucesso: false, erros: ['Mecânico não encontrado.'] });
  }
  if (!mecanico.ativo) {
    return res.status(409).json({ sucesso: false, erros: ['Mecânico está inativo.'] });
  }

  // 4. Verificar se o veículo existe e pertence ao cliente informado
  const veiculo = carregarVeiculos().find((v) => v.id === veiculoId);
  if (!veiculo) {
    return res.status(404).json({ sucesso: false, erros: ['Veículo não encontrado.'] });
  }
  if (veiculo.clienteId !== clienteId) {
    return res.status(400).json({ sucesso: false, erros: ['O veículo informado não pertence a esse cliente.'] });
  }

  // 5. Verificar conflito de horário para o mesmo mecânico (ignora agendamentos cancelados)
  const agendamentos = carregarAgendamentos();
  const conflito = agendamentos.some(
    (a) => a.mecanicoId === mecanicoId && a.data === data && a.hora === hora && a.status !== 'cancelado'
  );
  if (conflito) {
    return res.status(409).json({
      sucesso: false,
      erros: ['O mecânico já possui um agendamento nesse dia e horário.'],
    });
  }

  // 6. Montar o documento agendamentos/{id}
  const novoAgendamento = {
    id: crypto.randomUUID(),
    clienteId,
    mecanicoId,
    veiculoId,
    data,
    hora,
    servicos: servicos.map((s) => s.trim()),
    status: status || 'agendado',
    observacoes: observacoes ? observacoes.trim() : '',
  };

  agendamentos.push(novoAgendamento);
  salvarAgendamentos(agendamentos);

  return res.status(201).json({
    sucesso: true,
    mensagem: 'Agendamento criado com sucesso!',
    agendamento: novoAgendamento,
  });
});

// PUT /api/agendamentos/:id
// Atualiza um agendamento (todos os campos são opcionais, exceto clienteId, que não muda)
// Body esperado: { mecanicoId?, veiculoId?, data?, hora?, servicos?, status?, observacoes? }
router.put('/agendamentos/:id', (req, res) => {
  const { mecanicoId, veiculoId, data, hora, servicos, status, observacoes } = req.body;

  const erros = validarAtualizacaoAgendamento({ mecanicoId, veiculoId, data, hora, servicos, status, observacoes });
  if (erros.length > 0) {
    return res.status(400).json({ sucesso: false, erros });
  }

  const agendamentos = carregarAgendamentos();
  const indice = agendamentos.findIndex((a) => a.id === req.params.id);

  if (indice === -1) {
    return res.status(404).json({ sucesso: false, erros: ['Agendamento não encontrado.'] });
  }

  const atual = agendamentos[indice];

  // Se o mecânico for alterado, verifica se existe e está ativo
  if (mecanicoId !== undefined) {
    const mecanico = carregarUsuarios().find((u) => u.uid === mecanicoId);
    if (!mecanico || mecanico.tipo !== 'mecanico') {
      return res.status(404).json({ sucesso: false, erros: ['Mecânico não encontrado.'] });
    }
    if (!mecanico.ativo) {
      return res.status(409).json({ sucesso: false, erros: ['Mecânico está inativo.'] });
    }
  }

  // Se o veículo for alterado, verifica se existe e pertence ao cliente do agendamento
  if (veiculoId !== undefined) {
    const veiculo = carregarVeiculos().find((v) => v.id === veiculoId);
    if (!veiculo) {
      return res.status(404).json({ sucesso: false, erros: ['Veículo não encontrado.'] });
    }
    if (veiculo.clienteId !== atual.clienteId) {
      return res.status(400).json({ sucesso: false, erros: ['O veículo informado não pertence a esse cliente.'] });
    }
  }

  // Verifica conflito de horário se mecânico, data ou hora forem alterados
  const mecanicoFinal = mecanicoId !== undefined ? mecanicoId : atual.mecanicoId;
  const dataFinal = data !== undefined ? data : atual.data;
  const horaFinal = hora !== undefined ? hora : atual.hora;

  if (mecanicoId !== undefined || data !== undefined || hora !== undefined) {
    const conflito = agendamentos.some(
      (a, i) =>
        i !== indice &&
        a.mecanicoId === mecanicoFinal &&
        a.data === dataFinal &&
        a.hora === horaFinal &&
        a.status !== 'cancelado'
    );
    if (conflito) {
      return res.status(409).json({
        sucesso: false,
        erros: ['O mecânico já possui um agendamento nesse dia e horário.'],
      });
    }
  }

  const atualizado = {
    ...atual,
    mecanicoId: mecanicoFinal,
    veiculoId: veiculoId !== undefined ? veiculoId : atual.veiculoId,
    data: dataFinal,
    hora: horaFinal,
    servicos: servicos !== undefined ? servicos.map((s) => s.trim()) : atual.servicos,
    status: status !== undefined ? status : atual.status,
    observacoes: observacoes !== undefined ? observacoes.trim() : atual.observacoes,
  };

  agendamentos[indice] = atualizado;
  salvarAgendamentos(agendamentos);

  return res.json({
    sucesso: true,
    mensagem: 'Agendamento atualizado com sucesso!',
    agendamento: atualizado,
  });
});

// Altera apenas o status de um agendamento (ex: confirmar, iniciar, concluir, cancelar)
function alterarStatusAgendamento(req, res, novoStatus) {
  const agendamentos = carregarAgendamentos();
  const indice = agendamentos.findIndex((a) => a.id === req.params.id);

  if (indice === -1) {
    return res.status(404).json({ sucesso: false, erros: ['Agendamento não encontrado.'] });
  }

  agendamentos[indice] = { ...agendamentos[indice], status: novoStatus };
  salvarAgendamentos(agendamentos);

  return res.json({
    sucesso: true,
    mensagem: `Agendamento marcado como "${novoStatus}" com sucesso!`,
    agendamento: agendamentos[indice],
  });
}

// PATCH /api/agendamentos/:id/confirmar
router.patch('/agendamentos/:id/confirmar', (req, res) => alterarStatusAgendamento(req, res, 'confirmado'));

// PATCH /api/agendamentos/:id/iniciar
router.patch('/agendamentos/:id/iniciar', (req, res) => alterarStatusAgendamento(req, res, 'emAndamento'));

// PATCH /api/agendamentos/:id/concluir
router.patch('/agendamentos/:id/concluir', (req, res) => alterarStatusAgendamento(req, res, 'concluido'));

// PATCH /api/agendamentos/:id/cancelar
router.patch('/agendamentos/:id/cancelar', (req, res) => alterarStatusAgendamento(req, res, 'cancelado'));

// DELETE /api/agendamentos/:id
router.delete('/agendamentos/:id', (req, res) => {
  const agendamentos = carregarAgendamentos();
  const indice = agendamentos.findIndex((a) => a.id === req.params.id);

  if (indice === -1) {
    return res.status(404).json({ sucesso: false, erros: ['Agendamento não encontrado.'] });
  }

  const [removido] = agendamentos.splice(indice, 1);
  salvarAgendamentos(agendamentos);

  return res.json({
    sucesso: true,
    mensagem: 'Agendamento removido com sucesso!',
    agendamento: removido,
  });
});

module.exports = router;
