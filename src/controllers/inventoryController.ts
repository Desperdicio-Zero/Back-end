import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middlewares/authMiddleware';

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

function toIsoDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function todayAtMidnight(): Date {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}

function addDays(date: Date, days: number): Date {
  const out = new Date(date);
  out.setDate(out.getDate() + days);
  return out;
}

async function ensureCategoryExists(categoryId: number) {
  const existing = await prisma.category.findUnique({ where: { id: categoryId } });
  if (existing) return existing;

  const fallback = DEFAULT_CATEGORIES.find((c) => c.id === categoryId) ?? {
    id: categoryId,
    name: `Categoria ${categoryId}`,
    avg_days: 7,
  };

  // Nota: mesmo sendo autoincrement, MySQL permite inserir explicitamente o id.
  return prisma.category.create({
    data: {
      id: fallback.id,
      name: fallback.name,
      avg_days: fallback.avg_days,
    },
  });
}

function computeUrgency(expiryDate: Date | null) {
  const today = todayAtMidnight();

  let days_until_expiry = 999;
  if (expiryDate) {
    const diffTime = expiryDate.getTime() - today.getTime();
    days_until_expiry = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  let status_urgencia: 'Verde' | 'Amarelo' | 'Vermelho' = 'Verde';
  if (days_until_expiry <= 2) status_urgencia = 'Vermelho';
  else if (days_until_expiry <= 5) status_urgencia = 'Amarelo';

  return { days_until_expiry, status_urgencia };
}

function toPantryItemOut(item: any) {
  const { days_until_expiry, status_urgencia } = computeUrgency(item.expiry_date ?? null);

  return {
    id: item.id,
    name: item.name,
    category_id: item.categoryId,
    category: item.category,
    expiry_date: item.expiry_date ? toIsoDateOnly(item.expiry_date) : null,
    quantity: item.quantity,
    unit: item.unit,
    expiry_estimated: item.expiry_estimated,
    notes: item.notes ?? null,
    days_until_expiry,
    status_urgencia,
  };
}

// Aplica o middleware de autenticação (precisa criar o arquivo checando o JWT)
router.use(authMiddleware); 

router.get('/', async (req: any, res) => {
  const items = await prisma.inventoryItem.findMany({
    where: { userId: req.userId },
    include: { category: true }
  });

  res.json(items.map(toPantryItemOut));
});

router.post('/', async (req: any, res) => {
  const { name, category_id, quantity, unit, expiry_date, notes } = req.body;

  if (typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ detail: 'Nome do produto é obrigatório.' });
  }

  const categoryId = Number(category_id);
  if (!Number.isInteger(categoryId) || categoryId <= 0) {
    return res.status(400).json({ detail: 'Categoria inválida.' });
  }

  const qty = Number(quantity);
  if (!Number.isFinite(qty) || qty <= 0) {
    return res.status(400).json({ detail: 'Quantidade inválida.' });
  }

  const safeUnit = typeof unit === 'string' && unit.trim() ? unit.trim() : 'unidade';
  const safeNotes = typeof notes === 'string' && notes.trim() ? notes.trim() : null;

  // Garante que a categoria exista para não violar FK (o app usa ids fixos 1..13).
  const category = await ensureCategoryExists(categoryId);

  let computedExpiryDate: Date | null;
  let expiryEstimated: boolean;

  // Quando o app está em "auto expiry", ele envia `expiry_date: null`.
  if (expiry_date) {
    const parsed = new Date(expiry_date);
    if (Number.isNaN(parsed.getTime())) {
      return res.status(400).json({ detail: 'Data de validade inválida.' });
    }
    computedExpiryDate = parsed;
    expiryEstimated = false;
  } else {
    computedExpiryDate = addDays(todayAtMidnight(), category.avg_days ?? 7);
    expiryEstimated = true;
  }

  const item = await prisma.inventoryItem.create({
    data: {
      name: name.trim(),
      categoryId,
      quantity: qty,
      unit: safeUnit,
      notes: safeNotes,
      expiry_date: computedExpiryDate,
      expiry_estimated: expiryEstimated,
      userId: req.userId,
    },
    include: { category: true },
  });

  res.status(201).json(toPantryItemOut(item));
});

router.delete('/:id', async (req: any, res) => {
  await prisma.inventoryItem.delete({ where: { id: Number(req.params.id) } });
  res.status(204).send();
});

export default router;