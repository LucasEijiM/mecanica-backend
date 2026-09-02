// Valida os campos do cadastro de peça (POST) - documento pecas/{id}
// Campos esperados: codigo, nome, marca, precoCusto, precoVenda, estoqueAtual, estoqueMinimo
function validarPeca(dados) {
  const erros = [];
  const { codigo, nome, marca, precoCusto, precoVenda, estoqueAtual, estoqueMinimo } = dados;

  if (!codigo || typeof codigo !== 'string' || codigo.trim().length < 1) {
    erros.push('Código é obrigatório.');
  }
  if (!nome || typeof nome !== 'string' || nome.trim().length < 2) {
    erros.push('Nome deve ter pelo menos 2 caracteres.');
  }
  if (!marca || typeof marca !== 'string' || marca.trim().length < 1) {
    erros.push('Marca é obrigatória.');
  }
  if (precoCusto === undefined || precoCusto === null || isNaN(precoCusto) || Number(precoCusto) < 0) {
    erros.push('Preço de custo deve ser um número maior ou igual a 0.');
  }
  if (precoVenda === undefined || precoVenda === null || isNaN(precoVenda) || Number(precoVenda) < 0) {
    erros.push('Preço de venda deve ser um número maior ou igual a 0.');
  }
  if (
    estoqueAtual !== undefined &&
    (isNaN(estoqueAtual) || !Number.isInteger(Number(estoqueAtual)) || Number(estoqueAtual) < 0)
  ) {
    erros.push('Estoque atual deve ser um número inteiro maior ou igual a 0.');
  }
  if (
    estoqueMinimo !== undefined &&
    (isNaN(estoqueMinimo) || !Number.isInteger(Number(estoqueMinimo)) || Number(estoqueMinimo) < 0)
  ) {
    erros.push('Estoque mínimo deve ser um número inteiro maior ou igual a 0.');
  }

  return erros;
}

// Valida uma atualização (PUT) - todos os campos são opcionais,
// mas se forem enviados precisam ser válidos
function validarAtualizacaoPeca(dados) {
  const erros = [];
  const { codigo, nome, marca, precoCusto, precoVenda, estoqueAtual, estoqueMinimo } = dados;

  if (codigo !== undefined && (typeof codigo !== 'string' || codigo.trim().length < 1)) {
    erros.push('Código é obrigatório.');
  }
  if (nome !== undefined && (typeof nome !== 'string' || nome.trim().length < 2)) {
    erros.push('Nome deve ter pelo menos 2 caracteres.');
  }
  if (marca !== undefined && (typeof marca !== 'string' || marca.trim().length < 1)) {
    erros.push('Marca é obrigatória.');
  }
  if (precoCusto !== undefined && (isNaN(precoCusto) || Number(precoCusto) < 0)) {
    erros.push('Preço de custo deve ser um número maior ou igual a 0.');
  }
  if (precoVenda !== undefined && (isNaN(precoVenda) || Number(precoVenda) < 0)) {
    erros.push('Preço de venda deve ser um número maior ou igual a 0.');
  }
  if (
    estoqueAtual !== undefined &&
    (isNaN(estoqueAtual) || !Number.isInteger(Number(estoqueAtual)) || Number(estoqueAtual) < 0)
  ) {
    erros.push('Estoque atual deve ser um número inteiro maior ou igual a 0.');
  }
  if (
    estoqueMinimo !== undefined &&
    (isNaN(estoqueMinimo) || !Number.isInteger(Number(estoqueMinimo)) || Number(estoqueMinimo) < 0)
  ) {
    erros.push('Estoque mínimo deve ser um número inteiro maior ou igual a 0.');
  }

  return erros;
}

// Valida o valor enviado para adicionar/retirar quantidade do estoque
function validarQuantidadeMovimentacao(quantidade) {
  const erros = [];
  if (
    quantidade === undefined ||
    isNaN(quantidade) ||
    !Number.isInteger(Number(quantidade)) ||
    Number(quantidade) <= 0
  ) {
    erros.push('Quantidade deve ser um número inteiro maior que 0.');
  }
  return erros;
}

module.exports = { validarPeca, validarAtualizacaoPeca, validarQuantidadeMovimentacao };
