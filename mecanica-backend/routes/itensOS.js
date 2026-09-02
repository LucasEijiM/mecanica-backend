const express = require('express');
const crypto = require('crypto');
const { carregarItensOS, salvarItensOS, carregarPecas, salvarPecas } = require('../db');
const { validarItemOS, validarAtualizacaoItemOS } = require('../validators/validarItemOS');

const router = express.Router();

function arredondar(valor) {
  return Math.round(valor * 100) / 100;
}

// GET /api/itensOS
// Lista itens de OS. Aceita ?ordemServicoId=... e/ou ?tipo=peca|servico
router.get('/itensOS', (req, res) => {
  const { ordemServicoId, tipo } = req.query;
  let itens = carregarItensOS();

  if (ordemServicoId) {
    itens = itens.filter((i) => i.ordemServicoId === ordemServicoId);
  }
  if (tipo) {
    itens = itens.filter((i) => i.tipo === tipo);
  }

  const total = arredondar(itens.reduce((soma, i) => soma + i.subtotal, 0));

  return res.json({ sucesso: true, itensOS: itens, total });
});

// GET /api/itensOS/:id
router.get('/itensOS/:id', (req, res) => {
  const item = carregarItensOS().find((i) => i.id === req.params.id);

  if (!item) {
    return res.status(404).json({ sucesso: false, erros: ['Item de OS não encontrado.'] });
  }

  return res.json({ sucesso: true, itemOS: item });
});

// POST /api/itensOS
// Body esperado:
//  - tipo "peca":    { ordemServicoId, tipo: "peca", itemId, quantidade }
//                     (nome e precoUnitario são preenchidos a partir da peça,
//                      e a baixa é feita automaticamente no estoqueAtual)
//  - tipo "servico": { ordemServicoId, tipo: "servico", nome, quantidade, precoUnitario }
router.post('/itensOS', (req, res) => {
  const { ordemServicoId, tipo, itemId, quantidade } = req.body;
  let { nome, precoUnitario } = req.body;

  const errosComuns = validarItemOS({ ordemServicoId, tipo, itemId, nome, quantidade, precoUnitario });
  if (errosComuns.length > 0) {
    return res.status(400).json({ sucesso: false, erros: errosComuns });
  }

  const pecas = carregarPecas();
  let pecaIndice = -1;

  if (tipo === 'peca') {
    pecaIndice = pecas.findIndex((p) => p.id === itemId);
    if (pecaIndice === -1) {
      return res.status(404).json({ sucesso: false, erros: ['Peça não encontrada.'] });
    }
    const peca = pecas[pecaIndice];
    if (!peca.ativo) {
      return res.status(409).json({ sucesso: false, erros: ['Peça está inativa.'] });
    }
    if (Number(quantidade) > peca.estoqueAtual) {
      return res.status(400).json({
        sucesso: false,
        erros: [`Quantidade insuficiente em estoque. Disponível: ${peca.estoqueAtual}.`],
      });
    }
    // Preenche nome/preço a partir do cadastro da peça (garante consistência)
    nome = peca.nome;
    precoUnitario = peca.precoVenda;
  }

  const novoItem = {
    id: crypto.randomUUID(),
    ordemServicoId,
    tipo,
    itemId: tipo === 'peca' ? itemId : (itemId || null),
    nome: nome.trim(),
    quantidade: Number(quantidade),
    precoUnitario: Number(precoUnitario),
    subtotal: arredondar(Number(quantidade) * Number(precoUnitario)),
  };

  // Baixa automática no estoque quando o item é uma peça
  if (tipo === 'peca') {
    pecas[pecaIndice].estoqueAtual -= Number(quantidade);
    salvarPecas(pecas);
  }

  const itens = carregarItensOS();
  itens.push(novoItem);
  salvarItensOS(itens);

  return res.status(201).json({
    sucesso: true,
    mensagem: 'Item adicionado à ordem de serviço com sucesso!',
    itemOS: novoItem,
  });
});

// PUT /api/itensOS/:id
// Atualiza um item de OS. Body esperado (opcionais): { quantidade?, nome?, precoUnitario? }
// - nome e precoUnitario só podem ser alterados em itens do tipo "servico"
// - quantidade: em itens do tipo "peca", ajusta o estoqueAtual pela diferença
router.put('/itensOS/:id', (req, res) => {
  const { quantidade, nome, precoUnitario } = req.body;

  const erros = validarAtualizacaoItemOS({ quantidade, nome, precoUnitario });
  if (erros.length > 0) {
    return res.status(400).json({ sucesso: false, erros });
  }

  const itens = carregarItensOS();
  const indice = itens.findIndex((i) => i.id === req.params.id);

  if (indice === -1) {
    return res.status(404).json({ sucesso: false, erros: ['Item de OS não encontrado.'] });
  }

  const itemAtual = itens[indice];

  if ((nome !== undefined || precoUnitario !== undefined) && itemAtual.tipo !== 'servico') {
    return res.status(400).json({
      sucesso: false,
      erros: ['Nome e preço unitário só podem ser alterados em itens do tipo "servico".'],
    });
  }

  // Se a quantidade de um item do tipo "peca" mudar, ajusta o estoqueAtual pela diferença
  if (quantidade !== undefined && itemAtual.tipo === 'peca') {
    const pecas = carregarPecas();
    const pecaIndice = pecas.findIndex((p) => p.id === itemAtual.itemId);

    if (pecaIndice === -1) {
      return res.status(404).json({ sucesso: false, erros: ['Peça não encontrada.'] });
    }

    const diferenca = Number(quantidade) - itemAtual.quantidade; // positivo = precisa retirar mais do estoque
    if (diferenca > 0 && diferenca > pecas[pecaIndice].estoqueAtual) {
      return res.status(400).json({
        sucesso: false,
        erros: [`Quantidade insuficiente em estoque. Disponível: ${pecas[pecaIndice].estoqueAtual}.`],
      });
    }

    pecas[pecaIndice].estoqueAtual -= diferenca;
    salvarPecas(pecas);
  }

  const itemAtualizado = {
    ...itemAtual,
    nome: nome !== undefined ? nome.trim() : itemAtual.nome,
    quantidade: quantidade !== undefined ? Number(quantidade) : itemAtual.quantidade,
    precoUnitario: precoUnitario !== undefined ? Number(precoUnitario) : itemAtual.precoUnitario,
  };
  itemAtualizado.subtotal = arredondar(itemAtualizado.quantidade * itemAtualizado.precoUnitario);

  itens[indice] = itemAtualizado;
  salvarItensOS(itens);

  return res.json({
    sucesso: true,
    mensagem: 'Item de OS atualizado com sucesso!',
    itemOS: itemAtualizado,
  });
});

// DELETE /api/itensOS/:id
// Remove o item da OS. Se for uma peça, devolve a quantidade ao estoqueAtual.
router.delete('/itensOS/:id', (req, res) => {
  const itens = carregarItensOS();
  const indice = itens.findIndex((i) => i.id === req.params.id);

  if (indice === -1) {
    return res.status(404).json({ sucesso: false, erros: ['Item de OS não encontrado.'] });
  }

  const [removido] = itens.splice(indice, 1);
  salvarItensOS(itens);

  if (removido.tipo === 'peca') {
    const pecas = carregarPecas();
    const pecaIndice = pecas.findIndex((p) => p.id === removido.itemId);
    if (pecaIndice !== -1) {
      pecas[pecaIndice].estoqueAtual += removido.quantidade;
      salvarPecas(pecas);
    }
  }

  return res.json({
    sucesso: true,
    mensagem: 'Item removido da ordem de serviço com sucesso!',
    itemOS: removido,
  });
});

module.exports = router;
