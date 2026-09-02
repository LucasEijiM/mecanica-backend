// Aceita placa no formato antigo (AAA9999) ou Mercosul (AAA9A99)
function validarPlaca(placaOriginal) {
  const placa = placaOriginal.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const formatoAntigo = /^[A-Z]{3}[0-9]{4}$/;
  const formatoMercosul = /^[A-Z]{3}[0-9][A-Z][0-9]{2}$/;
  return formatoAntigo.test(placa) || formatoMercosul.test(placa);
}

function normalizarPlaca(placa) {
  return placa.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

// Valida os campos do cadastro de veículo (POST) - documento veiculos/{id}
// Campos esperados: clienteId, placa, marca, modelo, ano, cor, quilometragem, foto (opcional)
function validarVeiculo(dados) {
  const erros = [];
  const { clienteId, placa, marca, modelo, ano, cor, quilometragem, foto } = dados;

  if (!clienteId || typeof clienteId !== 'string') {
    erros.push('O campo "clienteId" é obrigatório.');
  }
  if (!placa || !validarPlaca(placa)) {
    erros.push('Placa inválida (use o formato ABC1234 ou o padrão Mercosul ABC1D23).');
  }
  if (!marca || typeof marca !== 'string' || marca.trim().length < 2) {
    erros.push('Marca deve ter pelo menos 2 caracteres.');
  }
  if (!modelo || typeof modelo !== 'string' || modelo.trim().length < 1) {
    erros.push('Modelo é obrigatório.');
  }
  const anoAtual = new Date().getFullYear();
  if (
    ano === undefined ||
    ano === null ||
    isNaN(ano) ||
    !Number.isInteger(Number(ano)) ||
    Number(ano) < 1950 ||
    Number(ano) > anoAtual + 1
  ) {
    erros.push(`Ano deve ser um número inteiro entre 1950 e ${anoAtual + 1}.`);
  }
  if (!cor || typeof cor !== 'string' || cor.trim().length < 2) {
    erros.push('Cor deve ter pelo menos 2 caracteres.');
  }
  if (
    quilometragem === undefined ||
    quilometragem === null ||
    isNaN(quilometragem) ||
    Number(quilometragem) < 0
  ) {
    erros.push('Quilometragem deve ser um número maior ou igual a 0.');
  }
  if (foto !== undefined && foto !== null && typeof foto !== 'string') {
    erros.push('Foto inválida (deve ser um texto com a URL/caminho da imagem).');
  }

  return erros;
}

// Valida uma atualização (PUT) - todos os campos são opcionais,
// mas se forem enviados precisam ser válidos
function validarAtualizacaoVeiculo(dados) {
  const erros = [];
  const { placa, marca, modelo, ano, cor, quilometragem, foto } = dados;

  if (placa !== undefined && !validarPlaca(placa)) {
    erros.push('Placa inválida (use o formato ABC1234 ou o padrão Mercosul ABC1D23).');
  }
  if (marca !== undefined && (typeof marca !== 'string' || marca.trim().length < 2)) {
    erros.push('Marca deve ter pelo menos 2 caracteres.');
  }
  if (modelo !== undefined && (typeof modelo !== 'string' || modelo.trim().length < 1)) {
    erros.push('Modelo é obrigatório.');
  }
  const anoAtual = new Date().getFullYear();
  if (
    ano !== undefined &&
    (isNaN(ano) || !Number.isInteger(Number(ano)) || Number(ano) < 1950 || Number(ano) > anoAtual + 1)
  ) {
    erros.push(`Ano deve ser um número inteiro entre 1950 e ${anoAtual + 1}.`);
  }
  if (cor !== undefined && (typeof cor !== 'string' || cor.trim().length < 2)) {
    erros.push('Cor deve ter pelo menos 2 caracteres.');
  }
  if (quilometragem !== undefined && (isNaN(quilometragem) || Number(quilometragem) < 0)) {
    erros.push('Quilometragem deve ser um número maior ou igual a 0.');
  }
  if (foto !== undefined && foto !== null && typeof foto !== 'string') {
    erros.push('Foto inválida (deve ser um texto com a URL/caminho da imagem).');
  }

  return erros;
}

module.exports = { validarVeiculo, validarAtualizacaoVeiculo, normalizarPlaca };
