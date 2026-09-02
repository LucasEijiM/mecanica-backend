const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const {
  carregarUsuarios,
  salvarUsuarios,
  carregarMecanicos,
  salvarMecanicos,
  carregarClientes,
  salvarClientes,
} = require('../db');
const {
  validarUsuarioComum,
  validarCliente,
  validarMecanico,
} = require('../validators/validarCadastro');

const router = express.Router();

// Junta o documento usuarios/{uid} com o documento extra (mecanicos/{uid}
// ou clientes/{uid}) e remove a senha da resposta.
function montarPerfilCompleto(usuario) {
  const { senha, ...usuarioSemSenha } = usuario;

  if (usuario.tipo === 'mecanico') {
    const mecanico = carregarMecanicos().find((m) => m.uid === usuario.uid);
    return { ...usuarioSemSenha, ...(mecanico || {}) };
  }

  if (usuario.tipo === 'cliente') {
    const cliente = carregarClientes().find((c) => c.uid === usuario.uid);
    return { ...usuarioSemSenha, ...(cliente || {}) };
  }

  return usuarioSemSenha;
}

// POST /api/cadastro
// Body esperado (comum): { tipo, nome, email, senha, dataNascimento, telefone, cpf }
// tipo "cliente"  -> exige também: { endereco, complemento? }
// tipo "mecanico" -> exige também: { especialidade, comissao, dataContratacao? }
router.post('/cadastro', async (req, res) => {
  const { tipo, nome, email, senha, dataNascimento, telefone, cpf } = req.body;

  // 1. Validar campos comuns (documento usuarios/{uid})
  const erros = validarUsuarioComum({ tipo, nome, email, senha, dataNascimento, telefone, cpf });

  // 2. Validar campos específicos do tipo
  if (tipo === 'cliente') {
    erros.push(...validarCliente(req.body));
  } else if (tipo === 'mecanico') {
    erros.push(...validarMecanico(req.body));
  }

  if (erros.length > 0) {
    return res.status(400).json({ sucesso: false, erros });
  }

  const usuarios = carregarUsuarios();

  // 3. Verificar duplicidade de email
  const emailExiste = usuarios.some(
    (u) => u.email.toLowerCase() === email.toLowerCase()
  );
  if (emailExiste) {
    return res.status(409).json({ sucesso: false, erros: ['Este email já está cadastrado.'] });
  }

  // 4. Verificar duplicidade de CPF
  const cpfLimpo = cpf.replace(/[^\d]/g, '');
  const cpfExiste = usuarios.some((u) => u.cpf === cpfLimpo);
  if (cpfExiste) {
    return res.status(409).json({ sucesso: false, erros: ['Este CPF já está cadastrado.'] });
  }

  // 5. Criptografar a senha antes de salvar
  // Observação: o schema de usuarios/{uid} não lista "senha" porque, em um
  // Firestore real, a autenticação ficaria no Firebase Authentication, fora
  // do documento. Como este projeto não usa Firebase Auth, mantemos o hash
  // aqui para permitir login — mas ele nunca é devolvido nas respostas.
  const senhaHash = await bcrypt.hash(senha, 10);
  const uid = crypto.randomUUID();

  // 6. Montar o documento usuarios/{uid}
  const novoUsuario = {
    uid,
    nome: nome.trim(),
    email: email.toLowerCase().trim(),
    cpf: cpfLimpo,
    telefone: telefone.replace(/[^\d]/g, ''),
    dataNascimento,
    tipo, // "cliente" ou "mecanico"
    criadoEm: new Date().toISOString(),
    ativo: true,
    senha: senhaHash,
  };

  usuarios.push(novoUsuario);
  salvarUsuarios(usuarios);

  // 7. Montar o documento extra (mecanicos/{uid} ou clientes/{uid})
  let dadosExtra;

  if (tipo === 'mecanico') {
    const { especialidade, comissao, dataContratacao } = req.body;
    const mecanicos = carregarMecanicos();

    dadosExtra = {
      uid,
      especialidade: especialidade.trim(),
      comissao: Number(comissao),
      dataContratacao: dataContratacao ? new Date(dataContratacao).toISOString() : new Date().toISOString(),
      ativo: true,
    };

    mecanicos.push(dadosExtra);
    salvarMecanicos(mecanicos);
  } else {
    const { endereco, complemento } = req.body;
    const clientes = carregarClientes();

    dadosExtra = {
      uid,
      endereco: endereco.trim(),
      complemento: complemento ? complemento.trim() : null,
      ativo: true,
    };

    clientes.push(dadosExtra);
    salvarClientes(clientes);
  }

  // 8. Nunca retornar a senha (nem o hash) na resposta
  const { senha: _senha, ...usuarioSemSenha } = novoUsuario;

  return res.status(201).json({
    sucesso: true,
    mensagem: `${tipo === 'cliente' ? 'Cliente' : 'Mecânico'} cadastrado com sucesso!`,
    usuario: { ...usuarioSemSenha, ...dadosExtra },
  });
});

// GET /api/usuarios
// Lista usuários (perfil completo, sem senha). Aceita ?tipo=cliente|mecanico e ?ativo=true|false
router.get('/usuarios', (req, res) => {
  const { tipo, ativo } = req.query;
  let usuarios = carregarUsuarios();

  if (tipo) {
    usuarios = usuarios.filter((u) => u.tipo === tipo);
  }
  if (ativo !== undefined) {
    usuarios = usuarios.filter((u) => u.ativo === (ativo === 'true'));
  }

  const perfis = usuarios.map(montarPerfilCompleto);
  return res.json({ sucesso: true, usuarios: perfis });
});

// GET /api/usuarios/:uid
// Retorna o perfil completo (usuarios/{uid} + mecanicos/{uid} ou clientes/{uid})
router.get('/usuarios/:uid', (req, res) => {
  const usuario = carregarUsuarios().find((u) => u.uid === req.params.uid);

  if (!usuario) {
    return res.status(404).json({ sucesso: false, erros: ['Usuário não encontrado.'] });
  }

  return res.json({ sucesso: true, usuario: montarPerfilCompleto(usuario) });
});

// Ativa/desativa um usuário e o documento extra correspondente (soft delete)
function alterarStatusUsuario(req, res, ativo) {
  const usuarios = carregarUsuarios();
  const indice = usuarios.findIndex((u) => u.uid === req.params.uid);

  if (indice === -1) {
    return res.status(404).json({ sucesso: false, erros: ['Usuário não encontrado.'] });
  }

  usuarios[indice].ativo = ativo;
  salvarUsuarios(usuarios);

  const usuario = usuarios[indice];
  if (usuario.tipo === 'mecanico') {
    const mecanicos = carregarMecanicos();
    const i = mecanicos.findIndex((m) => m.uid === usuario.uid);
    if (i !== -1) {
      mecanicos[i].ativo = ativo;
      salvarMecanicos(mecanicos);
    }
  } else if (usuario.tipo === 'cliente') {
    const clientes = carregarClientes();
    const i = clientes.findIndex((c) => c.uid === usuario.uid);
    if (i !== -1) {
      clientes[i].ativo = ativo;
      salvarClientes(clientes);
    }
  }

  return res.json({
    sucesso: true,
    mensagem: `Usuário ${ativo ? 'ativado' : 'desativado'} com sucesso!`,
    usuario: montarPerfilCompleto(usuario),
  });
}

// PATCH /api/usuarios/:uid/desativar
router.patch('/usuarios/:uid/desativar', (req, res) => alterarStatusUsuario(req, res, false));

// PATCH /api/usuarios/:uid/ativar
router.patch('/usuarios/:uid/ativar', (req, res) => alterarStatusUsuario(req, res, true));

module.exports = router;
