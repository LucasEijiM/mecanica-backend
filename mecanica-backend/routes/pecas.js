const express = require('express');
const crypto = require('crypto');
const { carregarPecas, salvarPecas } = require('../db');

// 🔥 FIREBASE
const { db, admin } = require('../firebase-db');

const {
  validarPeca,
  validarAtualizacaoPeca,
  validarQuantidadeMovimentacao,
} = require('../validators/validarPeca');

const router = express.Router();

// GET /api/pecas
router.get('/pecas', (req, res) => {
  const { busca, ativo, abaixoMinimo } = req.query;
  let pecas = carregarPecas();

  if (busca) {
    const termo = busca.toLowerCase();
    pecas = pecas.filter(
      (p) =>
        p.codigo.toLowerCase().includes(termo) ||
        p.nome.toLowerCase().includes(termo) ||
        p.marca.toLowerCase().includes(termo)
    );
  }
  if (ativo !== undefined) {
    pecas = pecas.filter((p) => p.ativo === (ativo === 'true'));
  }
  if (abaixoMinimo === 'true') {
    pecas = pecas.filter((p) => p.estoqueAtual <= p.estoqueMinimo);
  }

  return res.json({ sucesso: true, pecas });
});

// GET /api/pecas/:id
router.get('/pecas/:id', (req, res) => {
  const peca = carregarPecas().find((p) => p.id === req.params.id);

  if (!peca) {
    return res.status(404).json({ sucesso: false, erros: ['Peça não encontrada.'] });
  }

  return res.json({ sucesso: true, peca });
});

// POST /api/pecas (JSON DB)
router.post('/pecas', (req, res) => {
  const { codigo, nome, marca, precoCusto, precoVenda, estoqueAtual, estoqueMinimo } = req.body;

  const erros = validarPeca({ codigo, nome, marca, precoCusto, precoVenda, estoqueAtual, estoqueMinimo });
  if (erros.length > 0) {
    return res.status(400).json({ sucesso: false, erros });
  }

  const pecas = carregarPecas();

  const codigoLimpo = codigo.trim().toUpperCase();
  const codigoExiste = pecas.some((p) => p.codigo === codigoLimpo);
  if (codigoExiste) {
    return res.status(409).json({
      sucesso: false,
      erros: ['Já existe uma peça cadastrada com esse código.'],
    });
  }

  const novaPeca = {
    id: crypto.randomUUID(),
    codigo: codigoLimpo,
    nome: nome.trim(),
    marca: marca.trim(),
    precoCusto: Number(precoCusto),
    precoVenda: Number(precoVenda),
    estoqueAtual: estoqueAtual !== undefined ? Number(estoqueAtual) : 0,
    estoqueMinimo: estoqueMinimo !== undefined ? Number(estoqueMinimo) : 0,
    ativo: true,
  };

  pecas.push(novaPeca);
  salvarPecas(pecas);

  return res.status(201).json({
    sucesso: true,
    mensagem: 'Peça cadastrada com sucesso!',
    peca: novaPeca,
  });
});

// 🔥 NOVA ROTA - SALVA NO FIREBASE
router.post('/pecas-firebase', async (req, res) => {
  const { codigo, nome, marca, precoCusto, precoVenda, estoqueAtual, estoqueMinimo } = req.body;

  const erros = validarPeca({ codigo, nome, marca, precoCusto, precoVenda, estoqueAtual, estoqueMinimo });
  if (erros.length > 0) {
    return res.status(400).json({ sucesso: false, erros });
  }

  const pecas = carregarPecas();

  const codigoLimpo = codigo.trim().toUpperCase();
  const codigoExiste = pecas.some((p) => p.codigo === codigoLimpo);
  if (codigoExiste) {
    return res.status(409).json({
      sucesso: false,
      erros: ['Já existe uma peça cadastrada com esse código.'],
    });
  }

  try {
    const firebaseData = {
      codigo: codigoLimpo,
      nome: nome.trim(),
      marca: marca.trim(),
      precoCusto: Number(precoCusto),
      precoVenda: Number(precoVenda),
      estoqueAtual: estoqueAtual !== undefined ? Number(estoqueAtual) : 0,
      estoqueMinimo: estoqueMinimo !== undefined ? Number(estoqueMinimo) : 0,
      ativo: true,
      criadoEm: admin.firestore.FieldValue.serverTimestamp(),
    };

    const docRef = await db.collection('pecas').add(firebaseData);
    const firebaseId = docRef.id;

    const novaPeca = {
      id: firebaseId,
      codigo: codigoLimpo,
      nome: nome.trim(),
      marca: marca.trim(),
      precoCusto: Number(precoCusto),
      precoVenda: Number(precoVenda),
      estoqueAtual: estoqueAtual !== undefined ? Number(estoqueAtual) : 0,
      estoqueMinimo: estoqueMinimo !== undefined ? Number(estoqueMinimo) : 0,
      ativo: true,
      firebaseId,
    };

    pecas.push(novaPeca);
    salvarPecas(pecas);

    return res.status(201).json({
      sucesso: true,
      mensagem: 'Peça salva no Firebase e no JSON!',
      firebaseId,
      peca: novaPeca,
    });

  } catch (error) {
    console.error('Erro ao salvar peça no Firebase:', error);
    return res.status(500).json({
      sucesso: false,
      erros: ['Erro ao salvar no Firebase: ' + error.message]
    });
  }
});

// 🔥 NOVA ROTA - LISTAR PEÇAS DO FIREBASE
router.get('/pecas-firebase', async (req, res) => {
  try {
    const { busca, ativo, abaixoMinimo } = req.query;
    let query = db.collection('pecas');

    const snapshot = await query.get();
    let pecas = [];
    snapshot.forEach(doc => {
      pecas.push({ id: doc.id, ...doc.data() });
    });

    if (busca) {
      const termo = busca.toLowerCase();
      pecas = pecas.filter(
        (p) =>
          p.codigo?.toLowerCase().includes(termo) ||
          p.nome?.toLowerCase().includes(termo) ||
          p.marca?.toLowerCase().includes(termo)
      );
    }
    if (ativo !== undefined) {
      pecas = pecas.filter((p) => p.ativo === (ativo === 'true'));
    }
    if (abaixoMinimo === 'true') {
      pecas = pecas.filter((p) => p.estoqueAtual <= p.estoqueMinimo);
    }

    return res.json({ sucesso: true, pecas });
  } catch (error) {
    console.error('Erro ao listar peças do Firebase:', error);
    return res.status(500).json({
      sucesso: false,
      erros: ['Erro ao listar peças do Firebase: ' + error.message]
    });
  }
});

// PUT /api/pecas/:id
router.put('/pecas/:id', (req, res) => {
  const { codigo, nome, marca, precoCusto, precoVenda, estoqueAtual, estoqueMinimo } = req.body;

  const erros = validarAtualizacaoPeca({ codigo, nome, marca, precoCusto, precoVenda, estoqueAtual, estoqueMinimo });
  if (erros.length > 0) {
    return res.status(400).json({ sucesso: false, erros });
  }

  const pecas = carregarPecas();
  const indice = pecas.findIndex((p) => p.id === req.params.id);

  if (indice === -1) {
    return res.status(404).json({ sucesso: false, erros: ['Peça não encontrada.'] });
  }

  let codigoLimpo;
  if (codigo !== undefined) {
    codigoLimpo = codigo.trim().toUpperCase();
    const codigoExiste = pecas.some((p, i) => i !== indice && p.codigo === codigoLimpo);
    if (codigoExiste) {
      return res.status(409).json({
        sucesso: false,
        erros: ['Já existe uma peça cadastrada com esse código.'],
      });
    }
  }

  const pecaAtual = pecas[indice];
  const pecaAtualizada = {
    ...pecaAtual,
    codigo: codigoLimpo !== undefined ? codigoLimpo : pecaAtual.codigo,
    nome: nome !== undefined ? nome.trim() : pecaAtual.nome,
    marca: marca !== undefined ? marca.trim() : pecaAtual.marca,
    precoCusto: precoCusto !== undefined ? Number(precoCusto) : pecaAtual.precoCusto,
    precoVenda: precoVenda !== undefined ? Number(precoVenda) : pecaAtual.precoVenda,
    estoqueAtual: estoqueAtual !== undefined ? Number(estoqueAtual) : pecaAtual.estoqueAtual,
    estoqueMinimo: estoqueMinimo !== undefined ? Number(estoqueMinimo) : pecaAtual.estoqueMinimo,
  };

  pecas[indice] = pecaAtualizada;
  salvarPecas(pecas);

  return res.json({
    sucesso: true,
    mensagem: 'Peça atualizada com sucesso!',
    peca: pecaAtualizada,
  });
});

function alterarStatusPeca(req, res, ativo) {
  const pecas = carregarPecas();
  const indice = pecas.findIndex((p) => p.id === req.params.id);

  if (indice === -1) {
    return res.status(404).json({ sucesso: false, erros: ['Peça não encontrada.'] });
  }

  pecas[indice].ativo = ativo;
  salvarPecas(pecas);

  return res.json({
    sucesso: true,
    mensagem: `Peça ${ativo ? 'ativada' : 'desativada'} com sucesso!`,
    peca: pecas[indice],
  });
}

router.patch('/pecas/:id/desativar', (req, res) => alterarStatusPeca(req, res, false));
router.patch('/pecas/:id/ativar', (req, res) => alterarStatusPeca(req, res, true));

router.delete('/pecas/:id', (req, res) => {
  const pecas = carregarPecas();
  const indice = pecas.findIndex((p) => p.id === req.params.id);

  if (indice === -1) {
    return res.status(404).json({ sucesso: false, erros: ['Peça não encontrada.'] });
  }

  const [removida] = pecas.splice(indice, 1);
  salvarPecas(pecas);

  return res.json({
    sucesso: true,
    mensagem: 'Peça removida com sucesso!',
    peca: removida,
  });
});

router.patch('/pecas/:id/adicionar', (req, res) => {
  const { quantidade } = req.body;

  const erros = validarQuantidadeMovimentacao(quantidade);
  if (erros.length > 0) {
    return res.status(400).json({ sucesso: false, erros });
  }

  const pecas = carregarPecas();
  const indice = pecas.findIndex((p) => p.id === req.params.id);

  if (indice === -1) {
    return res.status(404).json({ sucesso: false, erros: ['Peça não encontrada.'] });
  }

  pecas[indice].estoqueAtual += Number(quantidade);
  salvarPecas(pecas);

  return res.json({
    sucesso: true,
    mensagem: `${quantidade} unidade(s) adicionada(s) ao estoque.`,
    peca: pecas[indice],
  });
});

router.patch('/pecas/:id/retirar', (req, res) => {
  const { quantidade } = req.body;

  const erros = validarQuantidadeMovimentacao(quantidade);
  if (erros.length > 0) {
    return res.status(400).json({ sucesso: false, erros });
  }

  const pecas = carregarPecas();
  const indice = pecas.findIndex((p) => p.id === req.params.id);

  if (indice === -1) {
    return res.status(404).json({ sucesso: false, erros: ['Peça não encontrada.'] });
  }

  const peca = pecas[indice];
  if (Number(quantidade) > peca.estoqueAtual) {
    return res.status(400).json({
      sucesso: false,
      erros: [`Quantidade insuficiente em estoque. Disponível: ${peca.estoqueAtual}.`],
    });
  }

  peca.estoqueAtual -= Number(quantidade);
  salvarPecas(pecas);

  return res.json({
    sucesso: true,
    mensagem: `${quantidade} unidade(s) retirada(s) do estoque.`,
    peca,
  });
});

module.exports = router;