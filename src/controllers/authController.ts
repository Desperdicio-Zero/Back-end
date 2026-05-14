import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { logger } from '../lib/logger';

const router = Router();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'chave-super-secreta';
const log = logger('Auth');

// ---------------------------------------------------------------------------
// Middleware de autenticação JWT
// ---------------------------------------------------------------------------
function authMiddleware(req: Request & { userId?: number }, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ detail: 'Token ausente.' });
  }
  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number };
    req.userId = decoded.userId;
    next();
  } catch {
    return res.status(401).json({ detail: 'Token inválido ou expirado.' });
  }
}

router.post('/register', async (req, res) => {
  if (!req.body || !req.body.email || !req.body.password) {
    log.warn('Tentativa de registro sem campos obrigatórios');
    return res.status(400).json({ detail: 'E-mail ou senha ausentes.' });
  }

  const { email, password } = req.body;
  log.info(`Registrando novo usuário`, { email });

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, password: hashedPassword }
    });
    log.info(`Usuário criado com sucesso`, { userId: user.id, email });
    res.status(201).json({ message: 'Usuário criado', userId: user.id });
  } catch (error) {
    log.warn(`Tentativa de registro com e-mail já existente`, { email });
    res.status(400).json({ detail: 'E-mail já cadastrado.' });
  }
});

router.post('/login', async (req, res) => {
  if (!req.body || !req.body.username || !req.body.password) {
    log.warn('Tentativa de login sem dados');
    return res.status(400).json({ 
      detail: 'Dados ausentes. Certifique-se de enviar username e password via form-urlencoded.' 
    });
  }

  const { username, password } = req.body;
  log.info(`Tentativa de login`, { email: username });

  const user = await prisma.user.findUnique({ where: { email: username } });
  if (!user) {
    log.warn(`Login falhou — usuário não encontrado`, { email: username });
    return res.status(401).json({ detail: 'Credenciais inválidas' });
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    log.warn(`Login falhou — senha incorreta`, { email: username });
    return res.status(401).json({ detail: 'Credenciais inválidas' });
  }

  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
  log.info(`Login bem-sucedido`, { userId: user.id, email: username });
  res.json({ access_token: token, token_type: 'bearer' });
});

// ---------------------------------------------------------------------------
// GET /auth/me — retorna dados do perfil do usuário autenticado
// ---------------------------------------------------------------------------
router.get('/me', authMiddleware, async (req: any, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, email: true, createdAt: true },
    });
    if (!user) {
      log.warn('GET /me — usuário não encontrado', { userId: req.userId });
      return res.status(404).json({ detail: 'Usuário não encontrado.' });
    }
    log.debug('GET /me — perfil retornado', { userId: req.userId });
    res.json(user);
  } catch (err) {
    log.error('GET /me — erro interno', err);
    res.status(500).json({ detail: 'Erro interno.' });
  }
});

// ---------------------------------------------------------------------------
// PUT /auth/me — atualiza e-mail e/ou senha do usuário autenticado
// ---------------------------------------------------------------------------
router.put('/me', authMiddleware, async (req: any, res) => {
  const { currentPassword, newEmail, newPassword } = req.body;
  log.info('PUT /me — tentativa de atualização de perfil', { userId: req.userId, hasNewEmail: !!newEmail, hasNewPassword: !!newPassword });

  if (!currentPassword) {
    log.warn('PUT /me — senha atual ausente', { userId: req.userId });
    return res.status(400).json({ detail: 'A senha atual é obrigatória.' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) {
      log.warn('PUT /me — usuário não encontrado', { userId: req.userId });
      return res.status(404).json({ detail: 'Usuário não encontrado.' });
    }

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) {
      log.warn('PUT /me — senha atual incorreta', { userId: req.userId });
      return res.status(401).json({ detail: 'Senha atual incorreta.' });
    }

    const updateData: { email?: string; password?: string } = {};

    if (newEmail && newEmail !== user.email) {
      const exists = await prisma.user.findUnique({ where: { email: newEmail } });
      if (exists) {
        log.warn('PUT /me — e-mail já em uso', { userId: req.userId, newEmail });
        return res.status(400).json({ detail: 'Este e-mail já está em uso.' });
      }
      updateData.email = newEmail;
    }

    if (newPassword) {
      if (newPassword.length < 8) {
        log.warn('PUT /me — nova senha muito curta', { userId: req.userId });
        return res.status(400).json({ detail: 'A nova senha precisa ter pelo menos 8 caracteres.' });
      }
      updateData.password = await bcrypt.hash(newPassword, 10);
    }

    if (Object.keys(updateData).length === 0) {
      log.warn('PUT /me — nenhuma alteração informada', { userId: req.userId });
      return res.status(400).json({ detail: 'Nenhuma alteração informada.' });
    }

    const updated = await prisma.user.update({
      where: { id: req.userId },
      data: updateData,
      select: { id: true, email: true, createdAt: true },
    });

    log.info('PUT /me — perfil atualizado com sucesso', { userId: req.userId, campos: Object.keys(updateData) });
    res.json(updated);
  } catch (err) {
    log.error('PUT /me — erro interno', err);
    res.status(500).json({ detail: 'Erro interno.' });
  }
});

export default router;