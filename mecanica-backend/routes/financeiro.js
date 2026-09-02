const express = require('express');
const crypto = require('crypto');
const { carregarFinanceiro, salvarFinanceiro, carregarUsuarios } = require('../db');

// 🔥 FIREBASE
const { db, admin } = require('../firebase-db');

const {
  validarFinanceiro,
  validarAtualizacaoFinanceiro,
} = require('../validators/validarFinanceiro');

const router = express.Router();

// GET /api/financeiro
router.get('/financeiro', (req, res) => {
  const { clienteId, ordemServicoId, status } = req.query;
  let lancamentos = carregarFinanceiro();

  if (clienteId) {
    lancamentos = lancamentos.filter((f) => f.clienteId === clienteId);
  }
  if (ordemServicoId) {
    lancamentos = lancamentos.filter((f) => f.ordemServicoId === ordemServicoId);
  }
  if (status) {
    lancamentos = lancamentos.filter((f) => f.status === status);
  }

  return res.json({ sucesso: true, financeiro: lancamentos });
});

// GET /api/financeiro/:id
router.get('/financeiro/:id', (req, res) => {
  const lancamento = carregarFinanceiro().find((f) => f.id === req.params.id);

  if (!lancamento) {
    return res.status(404).json({ sucesso: false, erros: ['Lançamento financeiro não encontrado.'] });
  }

  return res.json({ sucesso: true, financeiro: lancamento });
});

// POST /api/financeiro (JSON DB)
router.post('/financeiro', (req, res) => {
  const { ordemServicoId, clienteId, valor, formaPagamento, parcelas, status } = req.body;

  const erros = validarFinanceiro({ ordemServicoId, clienteId, valor, formaPagamento, parcelas, status });
  if (erros.length > 0) {
    return res.status(400).json({ sucesso: false, erros });
  }

  const cliente = carregarUsuarios().find((u) => u.uid === clienteId);
  if (!cliente || cliente.tipo !== 'cliente') {
    return res.status(404).json({ sucesso: false, erros: ['Cliente não encontrado.'] });
  }
  if (!cliente.ativo) {
    return res.status(409).json({ sucesso: false, erros: ['Cliente está inativo.'] });
  }

  const statusFinal = status || 'pendente';
  const novoLancamento = {
    id: crypto.randomUUID(),
    ordemServicoId,
    clienteId,
    valor: Number(valor),
    formaPagamento,
    status: statusFinal,
    dataPagamento: statusFinal === 'pago' ? new Date().toISOString() : null,
    parcelas: parcelas !== undefined && parcelas !== null ? Number(parcelas) : 1,
  };

  const lancamentos = carregarFinanceiro();
  lancamentos.push(novoLancamento);
  salvarFinanceiro(lancamentos);

  return res.status(201).json({
    sucesso: true,
    mensagem: 'Lançamento financeiro criado com sucesso!',
    financeiro: novoLancamento,
  });
});

// 🔥 NOVA ROTA - SALVA NO FIREBASE
router.post('/financeiro-firebase', async (req, res) => {
  const { ordemServicoId, clienteId, valor, formaPagamento, parcelas, status } = req.body;

  const erros = validarFinanceiro({ ordemServicoId, clienteId, valor, formaPagamento, parcelas, status });
  if (erros.length > 0) {
    return res.status(400).json({ sucesso: false, erros });
  }

  const cliente = carregarUsuarios().find((u) => u.uid === clienteId);
  if (!cliente || cliente.tipo !== 'cliente') {
    return res.status(404).json({ sucesso: false, erros: ['Cliente não encontrado.'] });
  }
  if (!cliente.ativo) {
    return res.status(409).json({ sucesso: false, erros: ['Cliente está inativo.'] });
  }

  const statusFinal = status || 'pendente';

  try {
    const firebaseData = {
      ordemServicoId,
      clienteId,
      valor: Number(valor),
      formaPagamento,
      status: statusFinal,
      dataPagamento: statusFinal === 'pago' ? new Date().toISOString() : null,
      parcelas: parcelas !== undefined && parcelas !== null ? Number(parcelas) : 1,
      criadoEm: admin.firestore.FieldValue.serverTimestamp(),
    };

    const docRef = await db.collection('financeiro').add(firebaseData);
    const firebaseId = docRef.id;

    const novoLancamento = {
      id: firebaseId,
      ordemServicoId,
      clienteId,
      valor: Number(valor),
      formaPagamento,
      status: statusFinal,
      dataPagamento: statusFinal === 'pago' ? new Date().toISOString() : null,
      parcelas: parcelas !== undefined && parcelas !== null ? Number(parcelas) : 1,
      firebaseId,
    };

    const lancamentos = carregarFinanceiro();
    lancamentos.push(novoLancamento);
    salvarFinanceiro(lancamentos);

    return res.status(201).json({
      sucesso: true,
      mensagem: 'Lançamento financeiro salvo no Firebase e no JSON!',
      firebaseId,
      financeiro: novoLancamento,
    });

  } catch (error) {
    console.error('Erro ao salvar lançamento financeiro no Firebase:', error);
    return res.status(500).json({
      sucesso: false,
      erros: ['Erro ao salvar no Firebase: ' + error.message]
    });
  }
});

// 🔥 NOVA ROTA - LISTAR FINANCEIRO DO FIREBASE
router.get('/financeiro-firebase', async (req, res) => {
  try {
    const { clienteId, ordemServicoId, status } = req.query;
    let query = db.collection('financeiro');

    if (clienteId) {
      query = query.where('clienteId', '==', clienteId);
    }
    if (ordemServicoId) {
      query = query.where('ordemServicoId', '==', ordemServicoId);
    }
    if (status) {
      query = query.where('status', '==', status);
    }

    const snapshot = await query.get();
    const lancamentos = [];
    snapshot.forEach(doc => {
      lancamentos.push({ id: doc.id, ...doc.data() });
    });

    return res.json({ sucesso: true, financeiro: lancamentos });
  } catch (error) {
    console.error('Erro ao listar financeiro do Firebase:', error);
    return res.status(500).json({
      sucesso: false,
      erros: ['Erro ao listar financeiro do Firebase: ' + error.message]
    });
  }
});

// PUT /api/financeiro/:id
router.put('/financeiro/:id', (req, res) => {
  const { valor, formaPagamento, parcelas, status } = req.body;

  const erros = validarAtualizacaoFinanceiro({ valor, formaPagamento, parcelas, status });
  if (erros.length > 0) {
    return res.status(400).json({ sucesso: false, erros });
  }

  const lancamentos = carregarFinanceiro();
  const indice = lancamentos.findIndex((f) => f.id === req.params.id);

  if (indice === -1) {
    return res.status(404).json({ sucesso: false, erros: ['Lançamento financeiro não encontrado.'] });
  }

  const atual = lancamentos[indice];
  const novoStatus = status !== undefined ? status : atual.status;

  let dataPagamento = atual.dataPagamento;
  if (status !== undefined && status === 'pago' && atual.status !== 'pago') {
    dataPagamento = new Date().toISOString();
  }

  const atualizado = {
    ...atual,
    valor: valor !== undefined ? Number(valor) : atual.valor,
    formaPagamento: formaPagamento !== undefined ? formaPagamento : atual.formaPagamento,
    parcelas: parcelas !== undefined ? Number(parcelas) : atual.parcelas,
    status: novoStatus,
    dataPagamento,
  };

  lancamentos[indice] = atualizado;
  salvarFinanceiro(lancamentos);

  return res.json({
    sucesso: true,
    mensagem: 'Lançamento financeiro atualizado com sucesso!',
    financeiro: atualizado,
  });
});

function alterarStatusFinanceiro(req, res, novoStatus) {
  const lancamentos = carregarFinanceiro();
  const indice = lancamentos.findIndex((f) => f.id === req.params.id);

  if (indice === -1) {
    return res.status(404).json({ sucesso: false, erros: ['Lançamento financeiro não encontrado.'] });
  }

  const atual = lancamentos[indice];
  const dataPagamento =
    novoStatus === 'pago' && atual.status !== 'pago' ? new Date().toISOString() : atual.dataPagamento;

  lancamentos[indice] = { ...atual, status: novoStatus, dataPagamento };
  salvarFinanceiro(lancamentos);

  return res.json({
    sucesso: true,
    mensagem: `Lançamento marcado como "${novoStatus}" com sucesso!`,
    financeiro: lancamentos[indice],
  });
}

router.patch('/financeiro/:id/pagar', (req, res) => alterarStatusFinanceiro(req, res, 'pago'));
router.patch('/financeiro/:id/cancelar', (req, res) => alterarStatusFinanceiro(req, res, 'cancelado'));
router.patch('/financeiro/:id/estornar', (req, res) => alterarStatusFinanceiro(req, res, 'estornado'));

router.delete('/financeiro/:id', (req, res) => {
  const lancamentos = carregarFinanceiro();
  const indice = lancamentos.findIndex((f) => f.id === req.params.id);

  if (indice === -1) {
    return res.status(404).json({ sucesso: false, erros: ['Lançamento financeiro não encontrado.'] });
  }

  const [removido] = lancamentos.splice(indice, 1);
  salvarFinanceiro(lancamentos);

  return res.json({
    sucesso: true,
    mensagem: 'Lançamento financeiro removido com sucesso!',
    financeiro: removido,
  });
});

module.exports = router;