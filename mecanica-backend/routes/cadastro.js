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

// 🔥 FIREBASE
const { db, admin } = require('../firebase-db');

const router = express.Router();

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

// ROTA ORIGINAL - JSON DB
router.post('/cadastro', async (req, res) => {
  const { tipo, nome, email, senha, dataNascimento, telefone, cpf } = req.body;

  const erros = validarUsuarioComum({ tipo, nome, email, senha, dataNascimento, telefone, cpf });

  if (tipo === 'cliente') {
    erros.push(...validarCliente(req.body));
  } else if (tipo === 'mecanico') {
    erros.push(...validarMecanico(req.body));
  }

  if (erros.length > 0) {
    return res.status(400).json({ sucesso: false, erros });
  }

  const usuarios = carregarUsuarios();

  const emailExiste = usuarios.some(
    (u) => u.email.toLowerCase() === email.toLowerCase()
  );
  if (emailExiste) {
    return res.status(409).json({ sucesso: false, erros: ['Este email já está cadastrado.'] });
  }

  const cpfLimpo = cpf.replace(/[^\d]/g, '');
  const cpfExiste = usuarios.some((u) => u.cpf === cpfLimpo);
  if (cpfExiste) {
    return res.status(409).json({ sucesso: false, erros: ['Este CPF já está cadastrado.'] });
  }

  const senhaHash = await bcrypt.hash(senha, 10);
  const uid = crypto.randomUUID();

  const novoUsuario = {
    uid,
    nome: nome.trim(),
    email: email.toLowerCase().trim(),
    cpf: cpfLimpo,
    telefone: telefone.replace(/[^\d]/g, ''),
    dataNascimento,
    tipo,
    criadoEm: new Date().toISOString(),
    ativo: true,
    senha: senhaHash,
  };

  usuarios.push(novoUsuario);
  salvarUsuarios(usuarios);

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

  const { senha: _senha, ...usuarioSemSenha } = novoUsuario;

  return res.status(201).json({
    sucesso: true,
    mensagem: `${tipo === 'cliente' ? 'Cliente' : 'Mecânico'} cadastrado com sucesso!`,
    usuario: { ...usuarioSemSenha, ...dadosExtra },
  });
});

// 🔥 NOVA ROTA - SALVA NO FIREBASE
router.post('/cadastro-firebase', async (req, res) => {
  const { tipo, nome, email, senha, dataNascimento, telefone, cpf } = req.body;

  const erros = validarUsuarioComum({ tipo, nome, email, senha, dataNascimento, telefone, cpf });

  if (tipo === 'cliente') {
    erros.push(...validarCliente(req.body));
  } else if (tipo === 'mecanico') {
    erros.push(...validarMecanico(req.body));
  }

  if (erros.length > 0) {
    return res.status(400).json({ sucesso: false, erros });
  }

  const usuarios = carregarUsuarios();
  const emailExiste = usuarios.some(
    (u) => u.email.toLowerCase() === email.toLowerCase()
  );
  if (emailExiste) {
    return res.status(409).json({ sucesso: false, erros: ['Este email já está cadastrado.'] });
  }

  const cpfLimpo = cpf.replace(/[^\d]/g, '');
  const cpfExiste = usuarios.some((u) => u.cpf === cpfLimpo);
  if (cpfExiste) {
    return res.status(409).json({ sucesso: false, erros: ['Este CPF já está cadastrado.'] });
  }

  try {
    // 1. SALVAR NO FIRESTORE - USUARIOS
    const firebaseData = {
      nome: nome.trim(),
      email: email.toLowerCase().trim(),
      cpf: cpfLimpo,
      telefone: telefone.replace(/[^\d]/g, ''),
      dataNascimento,
      tipo,
      criadoEm: admin.firestore.FieldValue.serverTimestamp(),
      ativo: true,
    };

    const docRef = await db.collection('usuarios').add(firebaseData);
    const firebaseId = docRef.id;

    // 🔥 2. SALVAR NO FIRESTORE - CLIENTES OU MECANICOS
    if (tipo === 'mecanico') {
      await db.collection('mecanicos').doc(firebaseId).set({
        especialidade: req.body.especialidade || '',
        comissao: req.body.comissao || 0,
        dataContratacao: admin.firestore.FieldValue.serverTimestamp(),
        ativo: true
      });
    } else {
      await db.collection('clientes').doc(firebaseId).set({
        endereco: req.body.endereco || '',
        complemento: req.body.complemento || '',
        ativo: true
      });
    }

    // 3. SALVAR NO JSON DB
    const senhaHash = await bcrypt.hash(senha, 10);
    const novoUsuario = {
      uid: firebaseId,
      nome: nome.trim(),
      email: email.toLowerCase().trim(),
      cpf: cpfLimpo,
      telefone: telefone.replace(/[^\d]/g, ''),
      dataNascimento,
      tipo,
      criadoEm: new Date().toISOString(),
      ativo: true,
      senha: senhaHash,
      firebaseId,
    };

    usuarios.push(novoUsuario);
    salvarUsuarios(usuarios);

    let dadosExtra;
    if (tipo === 'mecanico') {
      const { especialidade, comissao, dataContratacao } = req.body;
      const mecanicos = carregarMecanicos();
      dadosExtra = {
        uid: firebaseId,
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
        uid: firebaseId,
        endereco: endereco.trim(),
        complemento: complemento ? complemento.trim() : null,
        ativo: true,
      };
      clientes.push(dadosExtra);
      salvarClientes(clientes);
    }

    const { senha: _senha, ...usuarioSemSenha } = novoUsuario;
    return res.status(201).json({
      sucesso: true,
      mensagem: 'Usuário salvo no Firebase e no JSON!',
      firebaseId,
      usuario: { ...usuarioSemSenha, ...dadosExtra },
    });

  } catch (error) {
    console.error('Erro ao salvar no Firebase:', error);
    return res.status(500).json({
      sucesso: false,
      erros: ['Erro ao salvar no Firebase: ' + error.message]
    });
  }
});

// GET /api/usuarios
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

// 🔥 NOVA ROTA - LISTAR USUÁRIOS DO FIREBASE
router.get('/usuarios-firebase', async (req, res) => {
  try {
    const snapshot = await db.collection('usuarios').get();
    const usuarios = [];
    snapshot.forEach(doc => {
      usuarios.push({ id: doc.id, ...doc.data() });
    });
    return res.json({ sucesso: true, usuarios });
  } catch (error) {
    console.error('Erro ao listar usuários do Firebase:', error);
    return res.status(500).json({
      sucesso: false,
      erros: ['Erro ao listar usuários do Firebase: ' + error.message]
    });
  }
});

// GET /api/usuarios/:uid
router.get('/usuarios/:uid', (req, res) => {
  const usuario = carregarUsuarios().find((u) => u.uid === req.params.uid);

  if (!usuario) {
    return res.status(404).json({ sucesso: false, erros: ['Usuário não encontrado.'] });
  }

  return res.json({ sucesso: true, usuario: montarPerfilCompleto(usuario) });
});

// PATCH /api/usuarios/:uid/desativar
router.patch('/usuarios/:uid/desativar', (req, res) => alterarStatusUsuario(req, res, false));

// PATCH /api/usuarios/:uid/ativar
router.patch('/usuarios/:uid/ativar', (req, res) => alterarStatusUsuario(req, res, true));

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

module.exports = router;