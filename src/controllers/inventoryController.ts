import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middlewares/authMiddleware';

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
  
  // Se expiry_date for null, você pode buscar o avg_days da category_id
  // e somar na data de hoje para salvar estimado.
  
  const item = await prisma.inventoryItem.create({
    data: {
      name, categoryId: category_id, quantity, unit, notes,
      expiry_date: expiry_date ? new Date(expiry_date) : new Date(), 
      userId: req.userId
    }
  });

  res.status(201).json(item);
});

router.delete('/:id', async (req: any, res) => {
  await prisma.inventoryItem.delete({ where: { id: Number(req.params.id) } });
  res.status(204).send();
});

export default router;