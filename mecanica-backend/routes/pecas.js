const express = require('express');
const crypto = require('crypto');
const { carregarPecas, salvarPecas } = require('../db');
const {
  validarPeca,
  validarAtualizacaoPeca,
  validarQuantidadeMovimentacao,
} = require('../validators/validarPeca');

const router = express.Router();

// GET /api/pecas
// Lista peças. Aceita ?busca=texto (código/nome/marca), ?ativo=true|false
// e ?abaixoMinimo=true (só peças com estoqueAtual <= estoqueMinimo)
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

// POST /api/pecas
// Body esperado: { codigo, nome, marca, precoCusto, precoVenda, estoqueAtual?, estoqueMinimo? }
router.post('/pecas', (req, res) => {
  const { codigo, nome, marca, precoCusto, precoVenda, estoqueAtual, estoqueMinimo } = req.body;

  const erros = validarPeca({ codigo, nome, marca, precoCusto, precoVenda, estoqueAtual, estoqueMinimo });
  if (erros.length > 0) {
    return res.status(400).json({ sucesso: false, erros });
  }

  const pecas = carregarPecas();

  // Evita cadastrar duas peças com o mesmo código
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

// PUT /api/pecas/:id
// Atualiza dados da peça (todos os campos são opcionais)
// Body esperado: { codigo?, nome?, marca?, precoCusto?, precoVenda?, estoqueAtual?, estoqueMinimo? }
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

  // Se o código for alterado, verifica se já não existe outra peça com esse código
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

// Ativa/desativa uma peça (soft delete)
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

// PATCH /api/pecas/:id/desativar
router.patch('/pecas/:id/desativar', (req, res) => alterarStatusPeca(req, res, false));

// PATCH /api/pecas/:id/ativar
router.patch('/pecas/:id/ativar', (req, res) => alterarStatusPeca(req, res, true));

// DELETE /api/pecas/:id (remoção definitiva)
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

// PATCH /api/pecas/:id/adicionar
// Body esperado: { quantidade }
// Soma a quantidade enviada ao estoqueAtual da peça (entrada de estoque)
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

// PATCH /api/pecas/:id/retirar
// Body esperado: { quantidade }
// Subtrai a quantidade enviada do estoqueAtual da peça (saída de estoque)
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
