const express = require('express');
const crypto = require('crypto');
const { carregarVeiculos, salvarVeiculos, carregarUsuarios } = require('../db');

// 🔥 FIREBASE
const { db, admin } = require('../firebase-db');

const {
  validarVeiculo,
  validarAtualizacaoVeiculo,
  normalizarPlaca,
} = require('../validators/validarVeiculo');

const router = express.Router();

// GET /api/veiculos
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

// POST /api/veiculos (JSON DB)
router.post('/veiculos', (req, res) => {
  const { clienteId, placa, marca, modelo, ano, cor, quilometragem, foto } = req.body;

  const erros = validarVeiculo({ clienteId, placa, marca, modelo, ano, cor, quilometragem, foto });
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

  const placaNormalizada = normalizarPlaca(placa);
  const veiculos = carregarVeiculos();
  const placaExiste = veiculos.some((v) => v.placa === placaNormalizada);
  if (placaExiste) {
    return res.status(409).json({ sucesso: false, erros: ['Já existe um veículo cadastrado com essa placa.'] });
  }

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

// 🔥 NOVA ROTA - SALVA NO FIREBASE
router.post('/veiculos-firebase', async (req, res) => {
  const { clienteId, placa, marca, modelo, ano, cor, quilometragem, foto } = req.body;

  const erros = validarVeiculo({ clienteId, placa, marca, modelo, ano, cor, quilometragem, foto });
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

  const placaNormalizada = normalizarPlaca(placa);
  const veiculos = carregarVeiculos();
  const placaExiste = veiculos.some((v) => v.placa === placaNormalizada);
  if (placaExiste) {
    return res.status(409).json({ sucesso: false, erros: ['Já existe um veículo cadastrado com essa placa.'] });
  }

  try {
    const firebaseData = {
      clienteId,
      placa: placaNormalizada,
      marca: marca.trim(),
      modelo: modelo.trim(),
      ano: Number(ano),
      cor: cor.trim(),
      quilometragem: Number(quilometragem),
      foto: foto ? foto.trim() : null,
      ativo: true,
      criadoEm: admin.firestore.FieldValue.serverTimestamp(),
    };

    const docRef = await db.collection('veiculos').add(firebaseData);
    const firebaseId = docRef.id;

    const novoVeiculo = {
      id: firebaseId,
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
      firebaseId,
    };

    veiculos.push(novoVeiculo);
    salvarVeiculos(veiculos);

    return res.status(201).json({
      sucesso: true,
      mensagem: 'Veículo salvo no Firebase e no JSON!',
      firebaseId,
      veiculo: novoVeiculo,
    });

  } catch (error) {
    console.error('Erro ao salvar veículo no Firebase:', error);
    return res.status(500).json({
      sucesso: false,
      erros: ['Erro ao salvar no Firebase: ' + error.message]
    });
  }
});

// 🔥 NOVA ROTA - LISTAR VEÍCULOS DO FIREBASE
router.get('/veiculos-firebase', async (req, res) => {
  try {
    const { clienteId, ativo } = req.query;
    let query = db.collection('veiculos');

    if (clienteId) {
      query = query.where('clienteId', '==', clienteId);
    }
    if (ativo !== undefined) {
      query = query.where('ativo', '==', ativo === 'true');
    }

    const snapshot = await query.get();
    const veiculos = [];
    snapshot.forEach(doc => {
      veiculos.push({ id: doc.id, ...doc.data() });
    });

    return res.json({ sucesso: true, veiculos });
  } catch (error) {
    console.error('Erro ao listar veículos do Firebase:', error);
    return res.status(500).json({
      sucesso: false,
      erros: ['Erro ao listar veículos do Firebase: ' + error.message]
    });
  }
});

// PUT /api/veiculos/:id
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

router.patch('/veiculos/:id/desativar', (req, res) => alterarStatusVeiculo(req, res, false));
router.patch('/veiculos/:id/ativar', (req, res) => alterarStatusVeiculo(req, res, true));

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