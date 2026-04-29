import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware, AuthRequest } from '../middlewares/authMiddleware';

const router = Router();
const prisma = new PrismaClient();

router.use(authMiddleware);

// ==========================================
// POST /devices/register — Guardar o Token
// ==========================================
router.post('/register', async (req: AuthRequest, res) => {
  const { pushToken } = req.body;

  if (!pushToken) {
    return res.status(400).json({ detail: 'O pushToken é obrigatório.' });
  }

  try {
    // "upsert": se o token já existir, atualiza o dono. Se não, cria um novo.
    // Isso evita tokens duplicados se o utilizador desinstalar e instalar a app.
    await prisma.device.upsert({
      where: { token: pushToken },
      update: { userId: req.userId! },
      create: { token: pushToken, userId: req.userId! },
    });

    res.status(200).json({ message: 'Dispositivo registado para notificações.' });
  } catch (error) {
    console.error('Erro ao registar dispositivo:', error);
    res.status(500).json({ detail: 'Erro interno ao salvar o token.' });
  }
});

export default router;