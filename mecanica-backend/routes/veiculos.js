const express = require('express');
const crypto = require('crypto');
const { carregarVeiculos, salvarVeiculos, carregarUsuarios } = require('../db');
const {
  validarVeiculo,
  validarAtualizacaoVeiculo,
  normalizarPlaca,
} = require('../validators/validarVeiculo');

const router = express.Router();

// GET /api/veiculos
// Lista veículos. Aceita ?clienteId=uid e/ou ?ativo=true|false
router.get('/veiculos', (req, res) => {
  const { clienteId, ativo } = req.query;
  let veiculos = carregarVeiculos();

  if (clienteId) {
    veiculos = veiculos.filter((v) => v.clienteId === clienteId);
  }
  if (ativo !== undefined) {
    veiculos = veiculos.filter((v) => v.ativo === (ativo === 'true'));
  }

  return res.json({ sucesso: true, veiculos });
});

// GET /api/veiculos/:id
router.get('/veiculos/:id', (req, res) => {
  const veiculo = carregarVeiculos().find((v) => v.id === req.params.id);

  if (!veiculo) {
    return res.status(404).json({ sucesso: false, erros: ['Veículo não encontrado.'] });
  }

  return res.json({ sucesso: true, veiculo });
});

// POST /api/veiculos
// Body esperado: { clienteId, placa, marca, modelo, ano, cor, quilometragem, foto? }
router.post('/veiculos', (req, res) => {
  const { clienteId, placa, marca, modelo, ano, cor, quilometragem, foto } = req.body;

  // 1. Validar campos
  const erros = validarVeiculo({ clienteId, placa, marca, modelo, ano, cor, quilometragem, foto });
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

  // 3. Verificar duplicidade de placa
  const placaNormalizada = normalizarPlaca(placa);
  const veiculos = carregarVeiculos();
  const placaExiste = veiculos.some((v) => v.placa === placaNormalizada);
  if (placaExiste) {
    return res.status(409).json({ sucesso: false, erros: ['Já existe um veículo cadastrado com essa placa.'] });
  }

  // 4. Montar o documento veiculos/{id}
  const novoVeiculo = {
    id: crypto.randomUUID(),
    clienteId,
    placa: placaNormalizada,
    marca: marca.trim(),
    modelo: modelo.trim(),
    ano: Number(ano),
    cor: cor.trim(),
    quilometragem: Number(quilometragem),
    foto: foto ? foto.trim() : null,
    criadoEm: new Date().toISOString(),
    ativo: true,
  };

  veiculos.push(novoVeiculo);
  salvarVeiculos(veiculos);

  return res.status(201).json({
    sucesso: true,
    mensagem: 'Veículo cadastrado com sucesso!',
    veiculo: novoVeiculo,
  });
});

// PUT /api/veiculos/:id
// Atualiza dados do veículo (todos os campos são opcionais, exceto clienteId)
// Body esperado: { placa?, marca?, modelo?, ano?, cor?, quilometragem?, foto? }
router.put('/veiculos/:id', (req, res) => {
  const { placa, marca, modelo, ano, cor, quilometragem, foto } = req.body;

  const erros = validarAtualizacaoVeiculo({ placa, marca, modelo, ano, cor, quilometragem, foto });
  if (erros.length > 0) {
    return res.status(400).json({ sucesso: false, erros });
  }

  const veiculos = carregarVeiculos();
  const indice = veiculos.findIndex((v) => v.id === req.params.id);

  if (indice === -1) {
    return res.status(404).json({ sucesso: false, erros: ['Veículo não encontrado.'] });
  }

  // Se a placa for alterada, verifica se já não existe outro veículo com essa placa
  let placaNormalizada;
  if (placa !== undefined) {
    placaNormalizada = normalizarPlaca(placa);
    const placaExiste = veiculos.some(
      (v, i) => i !== indice && v.placa === placaNormalizada
    );
    if (placaExiste) {
      return res.status(409).json({ sucesso: false, erros: ['Já existe um veículo cadastrado com essa placa.'] });
    }
  }

  const veiculoAtual = veiculos[indice];
  const veiculoAtualizado = {
    ...veiculoAtual,
    placa: placaNormalizada !== undefined ? placaNormalizada : veiculoAtual.placa,
    marca: marca !== undefined ? marca.trim() : veiculoAtual.marca,
    modelo: modelo !== undefined ? modelo.trim() : veiculoAtual.modelo,
    ano: ano !== undefined ? Number(ano) : veiculoAtual.ano,
    cor: cor !== undefined ? cor.trim() : veiculoAtual.cor,
    quilometragem: quilometragem !== undefined ? Number(quilometragem) : veiculoAtual.quilometragem,
    foto: foto !== undefined ? (foto ? foto.trim() : null) : veiculoAtual.foto,
  };

  veiculos[indice] = veiculoAtualizado;
  salvarVeiculos(veiculos);

  return res.json({
    sucesso: true,
    mensagem: 'Veículo atualizado com sucesso!',
    veiculo: veiculoAtualizado,
  });
});

// Ativa/desativa um veículo (soft delete)
function alterarStatusVeiculo(req, res, ativo) {
  const veiculos = carregarVeiculos();
  const indice = veiculos.findIndex((v) => v.id === req.params.id);

  if (indice === -1) {
    return res.status(404).json({ sucesso: false, erros: ['Veículo não encontrado.'] });
  }

  veiculos[indice].ativo = ativo;
  salvarVeiculos(veiculos);

  return res.json({
    sucesso: true,
    mensagem: `Veículo ${ativo ? 'ativado' : 'desativado'} com sucesso!`,
    veiculo: veiculos[indice],
  });
}

// PATCH /api/veiculos/:id/desativar
router.patch('/veiculos/:id/desativar', (req, res) => alterarStatusVeiculo(req, res, false));

// PATCH /api/veiculos/:id/ativar
router.patch('/veiculos/:id/ativar', (req, res) => alterarStatusVeiculo(req, res, true));

// DELETE /api/veiculos/:id (remoção definitiva)
router.delete('/veiculos/:id', (req, res) => {
  const veiculos = carregarVeiculos();
  const indice = veiculos.findIndex((v) => v.id === req.params.id);

  if (indice === -1) {
    return res.status(404).json({ sucesso: false, erros: ['Veículo não encontrado.'] });
  }

  const [removido] = veiculos.splice(indice, 1);
  salvarVeiculos(veiculos);

  return res.json({
    sucesso: true,
    mensagem: 'Veículo removido com sucesso!',
    veiculo: removido,
  });
});

module.exports = router;
