import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

const DEFAULT_CATEGORIES: Array<{ id: number; name: string; avg_days: number }> = [
  { id: 1, name: 'Hortifruti', avg_days: 5 },
  { id: 2, name: 'Laticínios', avg_days: 7 },
  { id: 3, name: 'Carnes e Aves', avg_days: 3 },
  { id: 4, name: 'Peixes e Frutos do Mar', avg_days: 2 },
  { id: 5, name: 'Cereais e Grãos', avg_days: 30 },
  { id: 6, name: 'Massas e Farináceos', avg_days: 60 },
  { id: 7, name: 'Enlatados', avg_days: 365 },
  { id: 8, name: 'Bebidas', avg_days: 30 },
  { id: 9, name: 'Condimentos e Temperos', avg_days: 180 },
  { id: 10, name: 'Congelados', avg_days: 90 },
  { id: 11, name: 'Pães e Confeitaria', avg_days: 5 },
  { id: 12, name: 'Ovos', avg_days: 14 },
  { id: 13, name: 'Outros', avg_days: 7 },
];

// Categorias são globais (não dependem de usuário). Mantemos público para o app
// conseguir carregar a lista sem fricção.
router.get('/', async (_req, res) => {
  // O app mobile assume IDs fixos 1..13. Garantimos a existência para evitar FK.
  await Promise.all(
    DEFAULT_CATEGORIES.map((category) =>
      prisma.category.upsert({
        where: { id: category.id },
        update: {},
        create: category,
      })
    )
  );

  const categories = await prisma.category.findMany({
    orderBy: { name: 'asc' },
  });

  res.json(categories);
});

export default router;
