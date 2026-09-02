# Backend de Cadastro - App de Mecânica

Backend simples em JavaScript (Node.js + Express) para a tela de cadastro,
onde o usuário escolhe entre **Cliente** ou **Mecânico** e preenche:
nome, email, senha, data de nascimento, telefone e CPF.

## Como rodar

```bash
npm install
node server.js
```

O servidor sobe em `http://localhost:3000`.

## Endpoint

### POST /api/cadastro

**Body (JSON):**
```json
{
  "tipo": "cliente",
  "nome": "Joao Silva",
  "email": "joao@teste.com",
  "senha": "123456",
  "dataNascimento": "1990-05-10",
  "telefone": "11987654321",
  "cpf": "111.444.777-35"
}
```

- `tipo`: `"cliente"` ou `"mecanico"` (mesmos campos para os dois)
- Retorna `201` com os dados do usuário (sem a senha) em caso de sucesso
- Retorna `400` se algum campo for inválido
- Retorna `409` se email ou CPF já estiverem cadastrados

## O que o backend valida
- Nome com pelo menos 3 caracteres
- Email em formato válido
- Senha com pelo menos 6 caracteres
- Data de nascimento válida (idade entre 16 e 100 anos)
- Telefone com 10 ou 11 dígitos
- CPF válido (algoritmo oficial de dígito verificador)
- Email e CPF únicos (não permite cadastro duplicado)

## Armazenamento
Os dados são salvos em `banco.json` (criado automaticamente na primeira
execução). É um "banco" simples baseado em arquivo — ótimo para prototipar,
mas para produção o ideal é trocar por um banco de verdade (PostgreSQL,
SQLite, MongoDB etc.).

## Estrutura de pastas
```
mecanica-backend/
├── server.js              # ponto de entrada
├── db.js                  # leitura/escrita do banco.json
├── routes/
│   └── cadastro.js        # rota POST /api/cadastro
├── validators/
│   └── validarCadastro.js # validações de cada campo
└── banco.json              # criado automaticamente
```

## Segurança
A senha nunca é salva em texto puro — é criptografada com `bcryptjs`
antes de ser gravada, e nunca é devolvida nas respostas da API.
