const express = require('express');
const cadastroRoutes = require('./routes/cadastro');
const veiculosRoutes = require('./routes/veiculos');
const pecasRoutes = require('./routes/pecas');
const itensOSRoutes = require('./routes/itensOS');
const financeiroRoutes = require('./routes/financeiro');
const agendamentosRoutes = require('./routes/agendamentos');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Todas as rotas de cadastro (usuarios/mecanicos/clientes) ficam em /api/cadastro e /api/usuarios
app.use('/api', cadastroRoutes);

// Todas as rotas de veículos ficam em /api/veiculos
app.use('/api', veiculosRoutes);

// Todas as rotas de peças (estoque) ficam em /api/pecas
app.use('/api', pecasRoutes);

// Todas as rotas de itens de ordem de serviço ficam em /api/itensOS
app.use('/api', itensOSRoutes);

// Todas as rotas financeiras ficam em /api/financeiro
app.use('/api', financeiroRoutes);

// Todas as rotas de agendamentos ficam em /api/agendamentos
app.use('/api', agendamentosRoutes);

app.get('/', (req, res) => {
  res.json({ status: 'API de cadastro da oficina rodando' });
});

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});

//======================TESTE CADASTRO===============
//POST /api/cadastro (cliente):
//{ "tipo": "cliente", "nome": "Joao Silva", "email": "joao@teste.com", "senha": "123456", "dataNascimento": "1990-05-10", "telefone": "11987654321", "cpf": "111.444.777-35", "endereco": "Rua das Flores, 123", "complemento": "Apto 45" }
//POST /api/cadastro (mecanico):
//{ "tipo": "mecanico", "nome": "Carlos Souza", "email": "carlos@teste.com", "senha": "123456", "dataNascimento": "1988-02-20", "telefone": "11912345678", "cpf": "529.982.247-25", "especialidade": "Motor", "comissao": 15 }
//GET /api/usuarios?tipo=cliente&ativo=true
//GET /api/usuarios/:uid
//PATCH /api/usuarios/:uid/desativar  |  PATCH /api/usuarios/:uid/ativar

//======================TESTE VEICULOS===============
//POST /api/veiculos: { "clienteId": "<uid do cliente>", "placa": "ABC1D23", "marca": "Fiat", "modelo": "Uno", "ano": 2015, "cor": "Prata", "quilometragem": 52000 }
//GET /api/veiculos?clienteId=<uid>
//PUT /api/veiculos/:id: { "quilometragem": 53500 }
//PATCH /api/veiculos/:id/desativar  |  PATCH /api/veiculos/:id/ativar
//DELETE /api/veiculos/:id

//======================TESTE PECAS (ESTOQUE)===============
//POST /api/pecas: { "codigo": "FLT-001", "nome": "Filtro de óleo", "marca": "Bosch", "precoCusto": 15, "precoVenda": 25.5, "estoqueAtual": 10, "estoqueMinimo": 3 }
//GET /api/pecas?busca=filtro&abaixoMinimo=true
//PUT /api/pecas/:id: { "precoVenda": 27.9 }
//PATCH /api/pecas/:id/adicionar: { "quantidade": 5 }
//PATCH /api/pecas/:id/retirar: { "quantidade": 3 }
//PATCH /api/pecas/:id/desativar  |  PATCH /api/pecas/:id/ativar
//DELETE /api/pecas/:id

//======================TESTE ITENS DE OS===============
//POST /api/itensOS (peça, dá baixa automática no estoque):
//{ "ordemServicoId": "os-001", "tipo": "peca", "itemId": "<id da peça>", "quantidade": 2 }
//POST /api/itensOS (serviço, sem vínculo com estoque):
//{ "ordemServicoId": "os-001", "tipo": "servico", "nome": "Troca de óleo", "quantidade": 1, "precoUnitario": 80 }
//GET /api/itensOS?ordemServicoId=os-001
//PUT /api/itensOS/:id: { "quantidade": 3 }
//DELETE /api/itensOS/:id (estorna a quantidade ao estoque, se for peça)

//======================TESTE FINANCEIRO===============
//POST /api/financeiro:
//{ "ordemServicoId": "os-001", "clienteId": "<uid do cliente>", "valor": 250.5, "formaPagamento": "pix", "parcelas": 1 }
//GET /api/financeiro?clienteId=<uid>&status=pendente
//GET /api/financeiro/:id
//PUT /api/financeiro/:id: { "formaPagamento": "cartaoCredito", "parcelas": 3 }
//PATCH /api/financeiro/:id/pagar   | marca status "pago" e preenche dataPagamento
//PATCH /api/financeiro/:id/cancelar
//PATCH /api/financeiro/:id/estornar
//DELETE /api/financeiro/:id

//======================TESTE AGENDAMENTOS===============
//POST /api/agendamentos:
//{ "clienteId": "<uid do cliente>", "mecanicoId": "<uid do mecanico>", "veiculoId": "<id do veiculo>", "data": "2026-09-10", "hora": "14:30", "servicos": ["Troca de óleo", "Alinhamento"], "observacoes": "Cliente pediu revisão completa" }
//GET /api/agendamentos?mecanicoId=<uid>&data=2026-09-10
//GET /api/agendamentos/:id
//PUT /api/agendamentos/:id: { "hora": "15:00", "status": "confirmado" }
//PATCH /api/agendamentos/:id/confirmar
//PATCH /api/agendamentos/:id/iniciar
//PATCH /api/agendamentos/:id/concluir
//PATCH /api/agendamentos/:id/cancelar
//DELETE /api/agendamentos/:id
