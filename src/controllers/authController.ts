import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'chave-super-secreta';

router.post('/register', async (req, res) => {
  if (!req.body || !req.body.email || !req.body.password) {
    return res.status(400).json({ detail: 'E-mail ou senha ausentes.' });
  }

  const { email, password } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, password: hashedPassword }
    });
    res.status(201).json({ message: 'Usuário criado', userId: user.id });
  } catch (error) {
    res.status(400).json({ detail: 'E-mail já cadastrado.' });
  }
});

router.post('/login', async (req, res) => {
  // Proteção: Garante que os dados chegaram e que se chamam username e password
  if (!req.body || !req.body.username || !req.body.password) {
    return res.status(400).json({ 
      detail: 'Dados ausentes. Certifique-se de enviar username e password via form-urlencoded.' 
    });
  }

  const { username, password } = req.body; 
  
  const user = await prisma.user.findUnique({ where: { email: username } });
  if (!user) return res.status(401).json({ detail: 'Credenciais inválidas' });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(401).json({ detail: 'Credenciais inválidas' });

  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
  
  res.json({ access_token: token, token_type: 'bearer' });
});

export default router;