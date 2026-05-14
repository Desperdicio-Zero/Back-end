import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware, AuthRequest } from '../middlewares/authMiddleware';
import { logger } from '../lib/logger';

const router = Router();
const prisma = new PrismaClient();
const log = logger('History');

router.use(authMiddleware);

// ==========================================
// POST /history/ — Registar remoção
// ==========================================
router.post('/', async (req: AuthRequest, res) => {
  const { item_name, category_name, quantity, unit, expiry_date, removal_reason, notes } = req.body;

  try {
    const historyEntry = await prisma.historyItem.create({
      data: {
        userId: req.userId!,
        item_name,
        category_name,
        quantity: Number(quantity),
        unit,
        expiry_date: new Date(expiry_date),
        removal_reason,
        notes,
        removed_at: new Date()
      }
    });
    res.status(201).json(historyEntry);
    log.info(`Item registrado no histórico`, { userId: req.userId, item: item_name, reason: removal_reason });
  } catch (error) {
    log.error('POST /history/ — erro ao registrar', error);
    res.status(500).json({ detail: 'Erro ao registar o item no histórico.' });
  }
});

// ==========================================
// GET /history/stats — Estatísticas
// (Atenção: tem de vir ANTES do GET /:id ou /)
// ==========================================
router.get('/stats', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;

    // 1. Contagens Totais
    const total_removed = await prisma.historyItem.count({ where: { userId } });
    const total_consumed = await prisma.historyItem.count({ where: { userId, removal_reason: 'consumed' } });
    const total_expired = await prisma.historyItem.count({ where: { userId, removal_reason: 'expired' } });

    // 2. Cálculo da Taxa de Desperdício (%)
    const waste_rate_percent = total_removed > 0
      ? Number(((total_expired / total_removed) * 100).toFixed(1))
      : 0;

    // 3. Dados do Mês Atual (para os gráficos mensais)
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const this_month_consumed = await prisma.historyItem.count({
      where: {
        userId,
        removal_reason: 'consumed',
        removed_at: { gte: startOfMonth }
      }
    });

    const this_month_expired = await prisma.historyItem.count({
      where: {
        userId,
        removal_reason: 'expired',
        removed_at: { gte: startOfMonth }
      }
    });

    // 4. Top Categorias Mais Desperdiçadas (Agrupamento via Prisma)
    const expiredCategories = await prisma.historyItem.groupBy({
      by: ['category_name'],
      where: { userId, removal_reason: 'expired' },
      _count: { category_name: true },
      orderBy: { _count: { category_name: 'desc' } },
      take: 5
    });

    const top_wasted_categories = expiredCategories.map(cat => ({
      category_name: cat.category_name,
      total_expired: cat._count.category_name
    }));

    log.debug('GET /history/stats', { userId, total_removed, waste_rate_percent });
    res.json({
      total_removed,
      total_consumed,
      total_expired,
      waste_rate_percent,
      this_month_consumed,
      this_month_expired,
      top_wasted_categories
    });
  } catch (error) {
    log.error('GET /history/stats — erro', error);
    res.status(500).json({ detail: 'Erro ao calcular as estatísticas.' });
  }
});

// ==========================================
// GET /history/ — Listar histórico (Timeline)
// ==========================================
router.get('/', async (req: AuthRequest, res) => {
  const { limit = 100, skip = 0, item_name } = req.query;

  try {
    const history = await prisma.historyItem.findMany({
      where: {
        userId: req.userId,
        // Permite pesquisar no histórico se o front-end enviar o "item_name"
        ...(item_name && { item_name: { contains: String(item_name) } })
      },
      orderBy: { removed_at: 'desc' }, // Os mais recentes primeiro
      take: Number(limit),
      skip: Number(skip)
    });
    log.debug('GET /history/', { userId: req.userId, count: history.length });
    res.json(history);
  } catch (error) {
    log.error('GET /history/ — erro', error);
    res.status(500).json({ detail: 'Erro ao buscar a lista do histórico.' });
  }
});

export default router;