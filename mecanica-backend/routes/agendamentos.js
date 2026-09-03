const express = require('express');
const crypto = require('crypto');
const { 
  carregarAgendamentos, 
  salvarAgendamentos, 
  carregarUsuarios, 
  carregarVeiculos 
} = require('../db');

// 🔥 FIREBASE
const { db, admin } = require('../firebase-db');

const {
  validarAgendamento,
  validarAtualizacaoAgendamento,
} = require('../validators/validarAgendamento');

const router = express.Router();

// GET /api/agendamentos
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

// POST /api/agendamentos (JSON DB)
router.post('/agendamentos', (req, res) => {
  const { clienteId, mecanicoId, veiculoId, data, hora, servicos, status, observacoes } = req.body;

  const erros = validarAgendamento({ clienteId, mecanicoId, veiculoId, data, hora, servicos, status, observacoes });
  if (erros.length > 0) {
    return res.status(400).json({ sucesso: false, erros });
  }

  const usuarios = carregarUsuarios();

  const cliente = usuarios.find((u) => u.uid === clienteId);
  if (!cliente || cliente.tipo !== 'cliente') {
    return res.status(404).json({ sucesso: false, erros: ['Cliente não encontrado.'] });
  }
  if (!cliente.ativo) {
    return res.status(409).json({ sucesso: false, erros: ['Cliente está inativo.'] });
  }

  const mecanico = usuarios.find((u) => u.uid === mecanicoId);
  if (!mecanico || mecanico.tipo !== 'mecanico') {
    return res.status(404).json({ sucesso: false, erros: ['Mecânico não encontrado.'] });
  }
  if (!mecanico.ativo) {
    return res.status(409).json({ sucesso: false, erros: ['Mecânico está inativo.'] });
  }

  const veiculo = carregarVeiculos().find((v) => v.id === veiculoId);
  if (!veiculo) {
    return res.status(404).json({ sucesso: false, erros: ['Veículo não encontrado.'] });
  }
  if (veiculo.clienteId !== clienteId) {
    return res.status(400).json({ sucesso: false, erros: ['O veículo informado não pertence a esse cliente.'] });
  }

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

// 🔥 NOVA ROTA - SALVA NO FIREBASE
router.post('/agendamentos-firebase', async (req, res) => {
  const { clienteId, mecanicoId, veiculoId, data, hora, servicos, status, observacoes } = req.body;

  const erros = validarAgendamento({ clienteId, mecanicoId, veiculoId, data, hora, servicos, status, observacoes });
  if (erros.length > 0) {
    return res.status(400).json({ sucesso: false, erros });
  }

  const usuarios = carregarUsuarios();

  const cliente = usuarios.find((u) => u.uid === clienteId);
  if (!cliente || cliente.tipo !== 'cliente') {
    return res.status(404).json({ sucesso: false, erros: ['Cliente não encontrado.'] });
  }
  if (!cliente.ativo) {
    return res.status(409).json({ sucesso: false, erros: ['Cliente está inativo.'] });
  }

  const mecanico = usuarios.find((u) => u.uid === mecanicoId);
  if (!mecanico || mecanico.tipo !== 'mecanico') {
    return res.status(404).json({ sucesso: false, erros: ['Mecânico não encontrado.'] });
  }
  if (!mecanico.ativo) {
    return res.status(409).json({ sucesso: false, erros: ['Mecânico está inativo.'] });
  }

  const veiculo = carregarVeiculos().find((v) => v.id === veiculoId);
  if (!veiculo) {
    return res.status(404).json({ sucesso: false, erros: ['Veículo não encontrado.'] });
  }
  if (veiculo.clienteId !== clienteId) {
    return res.status(400).json({ sucesso: false, erros: ['O veículo informado não pertence a esse cliente.'] });
  }

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

  try {
    const firebaseData = {
      clienteId,
      mecanicoId,
      veiculoId,
      data,
      hora,
      servicos: servicos.map((s) => s.trim()),
      status: status || 'agendado',
      observacoes: observacoes ? observacoes.trim() : '',
      criadoEm: admin.firestore.FieldValue.serverTimestamp(),
    };

    const docRef = await db.collection('agendamentos').add(firebaseData);
    const firebaseId = docRef.id;

    const novoAgendamento = {
      id: firebaseId,
      clienteId,
      mecanicoId,
      veiculoId,
      data,
      hora,
      servicos: servicos.map((s) => s.trim()),
      status: status || 'agendado',
      observacoes: observacoes ? observacoes.trim() : '',
      firebaseId,
    };

    agendamentos.push(novoAgendamento);
    salvarAgendamentos(agendamentos);

    return res.status(201).json({
      sucesso: true,
      mensagem: 'Agendamento salvo no Firebase e no JSON!',
      firebaseId,
      agendamento: novoAgendamento,
    });

  } catch (error) {
    console.error('Erro ao salvar agendamento no Firebase:', error);
    return res.status(500).json({
      sucesso: false,
      erros: ['Erro ao salvar no Firebase: ' + error.message]
    });
  }
});

// 🔥 NOVA ROTA - LISTAR AGENDAMENTOS DO FIREBASE
router.get('/agendamentos-firebase', async (req, res) => {
  try {
    const { clienteId, mecanicoId, data, status } = req.query;
    let query = db.collection('agendamentos');

    if (clienteId) {
      query = query.where('clienteId', '==', clienteId);
    }
    if (mecanicoId) {
      query = query.where('mecanicoId', '==', mecanicoId);
    }
    if (data) {
      query = query.where('data', '==', data);
    }
    if (status) {
      query = query.where('status', '==', status);
    }

    const snapshot = await query.get();
    const agendamentos = [];
    snapshot.forEach(doc => {
      agendamentos.push({ id: doc.id, ...doc.data() });
    });

    return res.json({ sucesso: true, agendamentos });
  } catch (error) {
    console.error('Erro ao listar agendamentos do Firebase:', error);
    return res.status(500).json({
      sucesso: false,
      erros: ['Erro ao listar agendamentos do Firebase: ' + error.message]
    });
  }
});

// PUT /api/agendamentos/:id
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

  if (mecanicoId !== undefined) {
    const mecanico = carregarUsuarios().find((u) => u.uid === mecanicoId);
    if (!mecanico || mecanico.tipo !== 'mecanico') {
      return res.status(404).json({ sucesso: false, erros: ['Mecânico não encontrado.'] });
    }
    if (!mecanico.ativo) {
      return res.status(409).json({ sucesso: false, erros: ['Mecânico está inativo.'] });
    }
  }

  if (veiculoId !== undefined) {
    const veiculo = carregarVeiculos().find((v) => v.id === veiculoId);
    if (!veiculo) {
      return res.status(404).json({ sucesso: false, erros: ['Veículo não encontrado.'] });
    }
    if (veiculo.clienteId !== atual.clienteId) {
      return res.status(400).json({ sucesso: false, erros: ['O veículo informado não pertence a esse cliente.'] });
    }
  }

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

router.patch('/agendamentos/:id/confirmar', (req, res) => alterarStatusAgendamento(req, res, 'confirmado'));
router.patch('/agendamentos/:id/iniciar', (req, res) => alterarStatusAgendamento(req, res, 'emAndamento'));
router.patch('/agendamentos/:id/concluir', (req, res) => alterarStatusAgendamento(req, res, 'concluido'));
router.patch('/agendamentos/:id/cancelar', (req, res) => alterarStatusAgendamento(req, res, 'cancelado'));

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