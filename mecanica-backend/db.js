const fs = require('fs');
const path = require('path');

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

const usuariosCol = criarColecao('banco.json');
const mecanicosCol = criarColecao('mecanicos.json');
const clientesCol = criarColecao('clientes.json');
const veiculosCol = criarColecao('veiculos.json');
const pecasCol = criarColecao('pecas.json');
const itensOSCol = criarColecao('itensOS.json');
const financeiroCol = criarColecao('financeiro.json');
const agendamentosCol = criarColecao('agendamentos.json');

module.exports = {
  carregarUsuarios: usuariosCol.carregar,
  salvarUsuarios: usuariosCol.salvar,
  carregarMecanicos: mecanicosCol.carregar,
  salvarMecanicos: mecanicosCol.salvar,
  carregarClientes: clientesCol.carregar,
  salvarClientes: clientesCol.salvar,
  carregarVeiculos: veiculosCol.carregar,
  salvarVeiculos: veiculosCol.salvar,
  carregarPecas: pecasCol.carregar,
  salvarPecas: pecasCol.salvar,
  carregarItensOS: itensOSCol.carregar,
  salvarItensOS: itensOSCol.salvar,
  carregarFinanceiro: financeiroCol.carregar,
  salvarFinanceiro: financeiroCol.salvar,
  carregarAgendamentos: agendamentosCol.carregar,
  salvarAgendamentos: agendamentosCol.salvar,
};