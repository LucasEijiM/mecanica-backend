const express = require('express');
const crypto = require('crypto');
const { carregarFinanceiro, salvarFinanceiro, carregarUsuarios } = require('../db');
const {
  validarFinanceiro,
  validarAtualizacaoFinanceiro,
} = require('../validators/validarFinanceiro');

const router = express.Router();

// GET /api/financeiro
// Lista lançamentos financeiros. Aceita ?clienteId=..., ?ordemServicoId=... e/ou ?status=...
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

// POST /api/financeiro
// Body esperado: { ordemServicoId, clienteId, valor, formaPagamento, parcelas?, status? }
router.post('/financeiro', (req, res) => {
  const { ordemServicoId, clienteId, valor, formaPagamento, parcelas, status } = req.body;

  // 1. Validar campos
  const erros = validarFinanceiro({ ordemServicoId, clienteId, valor, formaPagamento, parcelas, status });
  if (erros.length > 0) {
    return res.status(400).json({ sucesso: false, erros });
  }

  // 2. Verificar se o cliente existe e é do tipo "cliente"
  const cliente = carregarUsuarios().find((u) => u.uid === clienteId);
  if (!cliente || cliente.tipo !== 'cliente') {
    return res.status(404).json({ sucesso: false, erros: ['Cliente não encontrado.'] });
  }
  if (!cliente.ativo) {
    return res.status(409).json({ sucesso: false, erros: ['Cliente está inativo.'] });
  }

  const statusFinal = status || 'pendente';

  // 3. Montar o documento financeiro/{id}
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

// PUT /api/financeiro/:id
// Atualiza um lançamento financeiro (todos os campos são opcionais)
// Body esperado: { valor?, formaPagamento?, parcelas?, status? }
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

  // Se o status mudar para "pago" e ainda não havia dataPagamento, registra agora.
  // Se mudar para outro status, mantém a dataPagamento anterior (histórico).
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

// Altera apenas o status de um lançamento (ex: marcar como pago/cancelado/estornado)
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

// PATCH /api/financeiro/:id/pagar
router.patch('/financeiro/:id/pagar', (req, res) => alterarStatusFinanceiro(req, res, 'pago'));

// PATCH /api/financeiro/:id/cancelar
router.patch('/financeiro/:id/cancelar', (req, res) => alterarStatusFinanceiro(req, res, 'cancelado'));

// PATCH /api/financeiro/:id/estornar
router.patch('/financeiro/:id/estornar', (req, res) => alterarStatusFinanceiro(req, res, 'estornado'));

// DELETE /api/financeiro/:id
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
