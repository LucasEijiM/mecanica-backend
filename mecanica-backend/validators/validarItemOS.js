// Valida os campos comuns de um item de OS (documento itensOS/{id})
// tipo "peca"    -> exige itemId (referência a pecas/{id}); nome e precoUnitario
//                   são preenchidos automaticamente a partir da peça
// tipo "servico" -> exige nome e precoUnitario informados no corpo da requisição
function validarItemOS(dados) {
  const erros = [];
  const { ordemServicoId, tipo, itemId, nome, quantidade, precoUnitario } = dados;

  if (!ordemServicoId || typeof ordemServicoId !== 'string') {
    erros.push('O campo "ordemServicoId" é obrigatório.');
  }
  if (!['peca', 'servico'].includes(tipo)) {
    erros.push('O campo "tipo" deve ser "peca" ou "servico".');
  }
  if (
    quantidade === undefined ||
    quantidade === null ||
    isNaN(quantidade) ||
    Number(quantidade) <= 0
  ) {
    erros.push('Quantidade deve ser um número maior que 0.');
  }

  if (tipo === 'peca') {
    if (!itemId || typeof itemId !== 'string') {
      erros.push('O campo "itemId" é obrigatório para itens do tipo "peca".');
    }
  } else if (tipo === 'servico') {
    if (!nome || typeof nome !== 'string' || nome.trim().length < 2) {
      erros.push('Nome do serviço deve ter pelo menos 2 caracteres.');
    }
    if (precoUnitario === undefined || precoUnitario === null || isNaN(precoUnitario) || Number(precoUnitario) < 0) {
      erros.push('Preço unitário deve ser um número maior ou igual a 0.');
    }
  }

  return erros;
}

// Valida uma atualização (PUT) - apenas quantidade e (para serviços) preço/nome podem mudar
function validarAtualizacaoItemOS(dados) {
  const erros = [];
  const { quantidade, nome, precoUnitario } = dados;

  if (quantidade !== undefined && (isNaN(quantidade) || Number(quantidade) <= 0)) {
    erros.push('Quantidade deve ser um número maior que 0.');
  }
  if (nome !== undefined && (typeof nome !== 'string' || nome.trim().length < 2)) {
    erros.push('Nome deve ter pelo menos 2 caracteres.');
  }
  if (precoUnitario !== undefined && (isNaN(precoUnitario) || Number(precoUnitario) < 0)) {
    erros.push('Preço unitário deve ser um número maior ou igual a 0.');
  }

  return erros;
}

module.exports = { validarItemOS, validarAtualizacaoItemOS };
