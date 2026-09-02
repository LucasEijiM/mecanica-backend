// Formas de pagamento e status aceitos para um lançamento financeiro
const FORMAS_PAGAMENTO_VALIDAS = [
  'dinheiro',
  'pix',
  'cartaoCredito',
  'cartaoDebito',
  'boleto',
  'transferencia',
];

const STATUS_VALIDOS = ['pendente', 'pago', 'cancelado', 'estornado'];

// Valida os campos do lançamento financeiro (POST) - documento financeiro/{id}
// Campos esperados: ordemServicoId, clienteId, valor, formaPagamento, parcelas?, status?
function validarFinanceiro(dados) {
  const erros = [];
  const { ordemServicoId, clienteId, valor, formaPagamento, parcelas, status } = dados;

  if (!ordemServicoId || typeof ordemServicoId !== 'string') {
    erros.push('O campo "ordemServicoId" é obrigatório.');
  }
  if (!clienteId || typeof clienteId !== 'string') {
    erros.push('O campo "clienteId" é obrigatório.');
  }
  if (valor === undefined || valor === null || isNaN(valor) || Number(valor) <= 0) {
    erros.push('Valor deve ser um número maior que 0.');
  }
  if (!formaPagamento || !FORMAS_PAGAMENTO_VALIDAS.includes(formaPagamento)) {
    erros.push(`Forma de pagamento deve ser uma das opções: ${FORMAS_PAGAMENTO_VALIDAS.join(', ')}.`);
  }
  if (
    parcelas !== undefined &&
    parcelas !== null &&
    (isNaN(parcelas) || !Number.isInteger(Number(parcelas)) || Number(parcelas) < 1)
  ) {
    erros.push('Parcelas deve ser um número inteiro maior ou igual a 1.');
  }
  if (status !== undefined && status !== null && !STATUS_VALIDOS.includes(status)) {
    erros.push(`Status deve ser um dos seguintes: ${STATUS_VALIDOS.join(', ')}.`);
  }

  return erros;
}

// Valida uma atualização (PUT) - todos os campos são opcionais,
// mas se forem enviados precisam ser válidos. clienteId e ordemServicoId
// não podem ser alterados após a criação.
function validarAtualizacaoFinanceiro(dados) {
  const erros = [];
  const { valor, formaPagamento, parcelas, status } = dados;

  if (valor !== undefined && (isNaN(valor) || Number(valor) <= 0)) {
    erros.push('Valor deve ser um número maior que 0.');
  }
  if (formaPagamento !== undefined && !FORMAS_PAGAMENTO_VALIDAS.includes(formaPagamento)) {
    erros.push(`Forma de pagamento deve ser uma das opções: ${FORMAS_PAGAMENTO_VALIDAS.join(', ')}.`);
  }
  if (
    parcelas !== undefined &&
    (isNaN(parcelas) || !Number.isInteger(Number(parcelas)) || Number(parcelas) < 1)
  ) {
    erros.push('Parcelas deve ser um número inteiro maior ou igual a 1.');
  }
  if (status !== undefined && !STATUS_VALIDOS.includes(status)) {
    erros.push(`Status deve ser um dos seguintes: ${STATUS_VALIDOS.join(', ')}.`);
  }

  return erros;
}

module.exports = {
  validarFinanceiro,
  validarAtualizacaoFinanceiro,
  FORMAS_PAGAMENTO_VALIDAS,
  STATUS_VALIDOS,
};
