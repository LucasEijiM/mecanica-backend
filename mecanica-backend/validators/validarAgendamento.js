// Status aceitos para um agendamento
const STATUS_VALIDOS = ['agendado', 'confirmado', 'emAndamento', 'concluido', 'cancelado'];

const REGEX_DATA = /^\d{4}-\d{2}-\d{2}$/; // AAAA-MM-DD
const REGEX_HORA = /^([01]\d|2[0-3]):([0-5]\d)$/; // HH:mm (24h)

function dataValida(data) {
  if (!REGEX_DATA.test(data)) return false;
  const [ano, mes, dia] = data.split('-').map(Number);
  const d = new Date(`${data}T00:00:00`);
  return d.getFullYear() === ano && d.getMonth() + 1 === mes && d.getDate() === dia;
}

// Valida os campos do agendamento (POST) - documento agendamentos/{id}
// Campos esperados: clienteId, mecanicoId, veiculoId, data, hora, servicos, status?, observacoes?
function validarAgendamento(dados) {
  const erros = [];
  const { clienteId, mecanicoId, veiculoId, data, hora, servicos, status, observacoes } = dados;

  if (!clienteId || typeof clienteId !== 'string') {
    erros.push('O campo "clienteId" é obrigatório.');
  }
  if (!mecanicoId || typeof mecanicoId !== 'string') {
    erros.push('O campo "mecanicoId" é obrigatório.');
  }
  if (!veiculoId || typeof veiculoId !== 'string') {
    erros.push('O campo "veiculoId" é obrigatório.');
  }
  if (!data || !dataValida(data)) {
    erros.push('Data inválida (use o formato AAAA-MM-DD).');
  }
  if (!hora || !REGEX_HORA.test(hora)) {
    erros.push('Hora inválida (use o formato HH:mm, 24 horas).');
  }
  if (!Array.isArray(servicos) || servicos.length === 0 || !servicos.every((s) => typeof s === 'string' && s.trim().length > 0)) {
    erros.push('O campo "servicos" deve ser uma lista com pelo menos um serviço (texto).');
  }
  if (status !== undefined && status !== null && !STATUS_VALIDOS.includes(status)) {
    erros.push(`Status deve ser um dos seguintes: ${STATUS_VALIDOS.join(', ')}.`);
  }
  if (observacoes !== undefined && observacoes !== null && typeof observacoes !== 'string') {
    erros.push('Observações deve ser um texto.');
  }

  return erros;
}

// Valida uma atualização (PUT) - todos os campos são opcionais,
// mas se forem enviados precisam ser válidos.
function validarAtualizacaoAgendamento(dados) {
  const erros = [];
  const { mecanicoId, veiculoId, data, hora, servicos, status, observacoes } = dados;

  if (mecanicoId !== undefined && (typeof mecanicoId !== 'string' || !mecanicoId)) {
    erros.push('O campo "mecanicoId" deve ser um texto válido.');
  }
  if (veiculoId !== undefined && (typeof veiculoId !== 'string' || !veiculoId)) {
    erros.push('O campo "veiculoId" deve ser um texto válido.');
  }
  if (data !== undefined && !dataValida(data)) {
    erros.push('Data inválida (use o formato AAAA-MM-DD).');
  }
  if (hora !== undefined && !REGEX_HORA.test(hora)) {
    erros.push('Hora inválida (use o formato HH:mm, 24 horas).');
  }
  if (
    servicos !== undefined &&
    (!Array.isArray(servicos) || servicos.length === 0 || !servicos.every((s) => typeof s === 'string' && s.trim().length > 0))
  ) {
    erros.push('O campo "servicos" deve ser uma lista com pelo menos um serviço (texto).');
  }
  if (status !== undefined && !STATUS_VALIDOS.includes(status)) {
    erros.push(`Status deve ser um dos seguintes: ${STATUS_VALIDOS.join(', ')}.`);
  }
  if (observacoes !== undefined && observacoes !== null && typeof observacoes !== 'string') {
    erros.push('Observações deve ser um texto.');
  }

  return erros;
}

module.exports = {
  validarAgendamento,
  validarAtualizacaoAgendamento,
  STATUS_VALIDOS,
};
