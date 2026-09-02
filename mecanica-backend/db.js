const fs = require('fs');
const path = require('path');

// Cria um "repositório" de arquivo JSON simples, usado como coleção.
// Cada coleção é um array de registros salvo em um arquivo próprio,
// imitando o modelo de coleções do Firestore (usuarios/, mecanicos/, etc).
function criarColecao(nomeArquivo) {
  const DB_PATH = path.join(__dirname, nomeArquivo);

  function garantirArquivoExiste() {
    if (!fs.existsSync(DB_PATH)) {
      fs.writeFileSync(DB_PATH, JSON.stringify([], null, 2));
    }
  }

  function carregar() {
    garantirArquivoExiste();
    const dados = fs.readFileSync(DB_PATH, 'utf-8');
    return JSON.parse(dados);
  }

  function salvar(registros) {
    fs.writeFileSync(DB_PATH, JSON.stringify(registros, null, 2));
  }

  return { carregar, salvar };
}

// usuarios/{uid} -> dados comuns a todo usuário (nome, email, cpf, telefone,
// dataNascimento, tipo, criadoEm, ativo)
const usuariosCol = criarColecao('banco.json');

// mecanicos/{uid} -> dados extras de quem tem tipo "mecanico"
// (mesmo uid do documento em usuarios/)
const mecanicosCol = criarColecao('mecanicos.json');

// clientes/{uid} -> dados extras de quem tem tipo "cliente"
// (mesmo uid do documento em usuarios/)
const clientesCol = criarColecao('clientes.json');

// veiculos/{id} -> veículos vinculados a um cliente (campo clienteId)
const veiculosCol = criarColecao('veiculos.json');

// pecas/{id} -> itens do estoque de peças
const pecasCol = criarColecao('pecas.json');

// itensOS/{id} -> itens (peças ou serviços) lançados em uma ordem de serviço
const itensOSCol = criarColecao('itensOS.json');

// financeiro/{id} -> lançamentos financeiros (pagamentos) vinculados a uma
// ordem de serviço (campo ordemServicoId) e a um cliente (campo clienteId)
const financeiroCol = criarColecao('financeiro.json');

// agendamentos/{id} -> agendamentos de serviço vinculados a um cliente
// (clienteId), um mecânico (mecanicoId) e um veículo (veiculoId)
const agendamentosCol = criarColecao('agendamentos.json');

module.exports = {
  // usuarios/
  carregarUsuarios: usuariosCol.carregar,
  salvarUsuarios: usuariosCol.salvar,

  // mecanicos/
  carregarMecanicos: mecanicosCol.carregar,
  salvarMecanicos: mecanicosCol.salvar,

  // clientes/
  carregarClientes: clientesCol.carregar,
  salvarClientes: clientesCol.salvar,

  // veiculos/
  carregarVeiculos: veiculosCol.carregar,
  salvarVeiculos: veiculosCol.salvar,

  // pecas/
  carregarPecas: pecasCol.carregar,
  salvarPecas: pecasCol.salvar,

  // itensOS/
  carregarItensOS: itensOSCol.carregar,
  salvarItensOS: itensOSCol.salvar,

  // financeiro/
  carregarFinanceiro: financeiroCol.carregar,
  salvarFinanceiro: financeiroCol.salvar,

  // agendamentos/
  carregarAgendamentos: agendamentosCol.carregar,
  salvarAgendamentos: agendamentosCol.salvar,
};
