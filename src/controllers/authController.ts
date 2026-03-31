import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'chave-super-secreta';

router.post('/register', async (req, res) => {
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
  // Seu front manda "username" ao invés de email devido ao padrão OAuth2
  const { username, password } = req.body; 
  
  const user = await prisma.user.findUnique({ where: { email: username } });
  if (!user) return res.status(401).json({ detail: 'Credenciais inválidas' });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(401).json({ detail: 'Credenciais inválidas' });

  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
  
  // Front espera isso: { access_token: string, token_type: string }
  res.json({ access_token: token, token_type: 'bearer' });
});

export default router;