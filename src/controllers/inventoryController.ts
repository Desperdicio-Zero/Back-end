import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware, AuthRequest } from '../middlewares/authMiddleware';

const router = Router();
const prisma = new PrismaClient();

// Aplica o middleware de autenticação (precisa criar o arquivo checando o JWT)
router.use(authMiddleware); 

router.get('/', async (req: any, res) => {
  const items = await prisma.inventoryItem.findMany({
    where: { userId: req.userId },
    include: { category: true }
  });

  // Calcula a urgência em tempo de execução para o front
  const today = new Date();
  today.setHours(0,0,0,0);

  const formattedItems = items.map(item => {
    let days_until_expiry = 999;
    if (item.expiry_date) {
      const diffTime = new Date(item.expiry_date).getTime() - today.getTime();
      days_until_expiry = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    let status_urgencia = 'Verde';
    if (days_until_expiry <= 2) status_urgencia = 'Vermelho';
    else if (days_until_expiry <= 5) status_urgencia = 'Amarelo';

    return {
      ...item,
      days_until_expiry,
      status_urgencia
    };
  });

  res.json(formattedItems);
});

router.post('/', async (req: any, res) => {
  const { name, category_id, quantity, unit, expiry_date, notes } = req.body;
  
  const item = await prisma.inventoryItem.create({
    data: {
      name, categoryId: category_id, quantity, unit, notes,
      expiry_date: expiry_date ? new Date(expiry_date) : new Date(), 
      userId: req.userId
    }
  });

  res.status(201).json(item);
});

// GET /inventory/:id — Buscar item por ID
router.get('/:id', async (req: AuthRequest, res) => {
  const { id } = req.params;
  try {
    const item = await prisma.inventoryItem.findFirst({
      where: { 
        id: Number(id),
        userId: req.userId 
      },
      include: { category: true }
    });

    if (!item) return res.status(404).json({ detail: 'Item não encontrado.' });
    res.json(item);
  } catch (error) {
    res.status(500).json({ detail: 'Erro ao buscar item.' });
  }
});

// PATCH /inventory/:id — Atualizar item (parcial)
router.patch('/:id', async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { name, category_id, quantity, unit, expiry_date, notes } = req.body;

  try {
    const updatedItem = await prisma.inventoryItem.updateMany({
      where: { 
        id: Number(id),
        userId: req.userId 
      },
      data: {
        ...(name && { name }),
        ...(category_id && { categoryId: category_id }),
        ...(quantity !== undefined && { quantity }),
        ...(unit && { unit }),
        ...(expiry_date && { expiry_date: new Date(expiry_date) }),
        ...(notes !== undefined && { notes })
      }
    });

    if (updatedItem.count === 0) return res.status(404).json({ detail: 'Item não encontrado ou sem permissão.' });
    
    res.json({ message: 'Item atualizado com sucesso.' });
  } catch (error) {
    res.status(400).json({ detail: 'Erro ao atualizar item.' });
  }
});

router.delete('/:id', async (req: any, res) => {
  await prisma.inventoryItem.delete({ where: { id: Number(req.params.id) } });
  res.status(204).send();
});

export default router;