import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { authMiddleware, AuthRequest } from '../middlewares/authMiddleware';

const router = Router();
const prisma = new PrismaClient();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const CANONICAL_CATEGORIES: Array<{ id: number; name: string }> = [
  { id: 1, name: 'Hortifruti' },
  { id: 2, name: 'Laticínios' },
  { id: 3, name: 'Carnes e Aves' },
  { id: 4, name: 'Peixes e Frutos do Mar' },
  { id: 5, name: 'Cereais e Grãos' },
  { id: 6, name: 'Massas e Farináceos' },
  { id: 7, name: 'Enlatados' },
  { id: 8, name: 'Bebidas' },
  { id: 9, name: 'Condimentos e Temperos' },
  { id: 10, name: 'Congelados' },
  { id: 11, name: 'Pães e Confeitaria' },
  { id: 12, name: 'Ovos' },
  { id: 13, name: 'Biscoitos e Snacks' },
  { id: 14, name: 'Frios e Embutidos' },
  { id: 15, name: 'Doces e Chocolates' },
  { id: 16, name: 'Outros' },
];

function mapToCanonicalCategory(suggested: any, itemName: string) {
  const s = (suggested || '').toString().toLowerCase();
  const n = (itemName || '').toString().toLowerCase();

  // If the suggested text already exactly matches a canonical name, use it
  for (const c of CANONICAL_CATEGORIES) {
    if (s === c.name.toLowerCase()) return c;
  }

  // Heuristics / keyword overrides (order matters: more specific first)
  if (/chocolate|doce|bombom|trufa/.test(s) || /chocolate|doce|bombom|trufa/.test(n)) return { id: 15, name: 'Doces e Chocolates' };
  if (/bisc|biscoito|bolacha|snack|salgadinho|salgadinhos/.test(s) || /bisc|biscoito|bolacha|snack|salgadinho|salgadinhos/.test(n)) return { id: 13, name: 'Biscoitos e Snacks' };
  if (/presunto|fiambre|mortadela|peito|salame|frios|embutido/.test(s) || /presunto|fiambre|mortadela|peito|salame|frios|embutido/.test(n)) return { id: 14, name: 'Frios e Embutidos' };
  if (/refrigerante|refrig|refri|suco|sumo|água|agua|cerveja|bebida|bebidas/.test(s) || /refrigerante|refrig|refri|suco|sumo|água|agua|cerveja|bebida|bebidas/.test(n)) return { id: 8, name: 'Bebidas' };
  if (/leite|queijo|manteiga|iogurt|iogurte|nata/.test(s) || /leite|queijo|manteiga|iogurt|iogurte|nata/.test(n)) return { id: 2, name: 'Laticínios' };
  if (/pão|pao|bolo|croissant|pãozinho|paozinho|confeitaria/.test(s) || /pão|pao|bolo|croissant|pãozinho|paozinho|confeitaria/.test(n)) return { id: 11, name: 'Pães e Confeitaria' };
  if (/ovo|ovos/.test(s) || /ovo|ovos/.test(n)) return { id: 12, name: 'Ovos' };
  if (/fruta|frutas|verdura|verduras|alface|banana|maçã|maca|laranja|tomate|batata/.test(s) || /fruta|frutas|verdura|verduras|alface|banana|maçã|maca|laranja|tomate|batata/.test(n)) return { id: 1, name: 'Hortifruti' };
  if (/carne|frango|bife|costela|porco|picanha/.test(s) || /carne|frango|bife|costela|porco|picanha/.test(n)) return { id: 3, name: 'Carnes e Aves' };
  if (/peixe|salmão|atum|bacalhau|frutos do mar|marisco/.test(s) || /peixe|salmão|atum|bacalhau|frutos do mar|marisco/.test(n)) return { id: 4, name: 'Peixes e Frutos do Mar' };
  if (/arroz|feijão|cereal|granola|aveia|grãos|graos/.test(s) || /arroz|feijão|cereal|granola|aveia|grãos|graos/.test(n)) return { id: 5, name: 'Cereais e Grãos' };
  if (/massa|macarrão|macarrao|farinha|trigo/.test(s) || /massa|macarrão|macarrao|farinha|trigo/.test(n)) return { id: 6, name: 'Massas e Farináceos' };
  if (/enlatado|lata|enlatados/.test(s) || /enlatado|lata|enlatados/.test(n)) return { id: 7, name: 'Enlatados' };
  if (/condiment|tempero|sal|pimenta|alho|cebola|molho/.test(s) || /condiment|tempero|sal|pimenta|alho|cebola|molho/.test(n)) return { id: 9, name: 'Condimentos e Temperos' };
  if (/congelad|surgelad|freezer/.test(s) || /congelad|surgelad|freezer/.test(n)) return { id: 10, name: 'Congelados' };

  // Default
  return { id: 16, name: 'Outros' };
}

router.use(authMiddleware);

// ==========================================
// POST /receipt/scan — A IA lê a imagem
// ==========================================
router.post('/scan', async (req: AuthRequest, res) => {
  // Accept both snake_case and camelCase from different clients
  const { imageBase64, image_base64, mimeType = 'image/jpeg' } = req.body as any;
  const dataBase64 = imageBase64 || image_base64;

  if (!dataBase64) {
    return res.status(400).json({ detail: 'A imagem em Base64 é obrigatória.' });
  }

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: SchemaType.ARRAY,
          description: 'Lista de produtos alimentícios extraídos do cupom fiscal',
          items: {
            type: SchemaType.OBJECT,
            properties: {
              name: {
                type: SchemaType.STRING,
                description: 'Nome legível e claro do produto alimentício (ex: Leite Integral, Arroz Agulhinha)'
              },
              quantity: {
                type: SchemaType.NUMBER,
                description: 'Quantidade comprada'
              },
              unit: {
                type: SchemaType.STRING,
                description: 'Unidade de medida (ex: unidade, kg, g, litro, ml, etc)'
              },
              suggested_category: {
                type: SchemaType.STRING,
                description: 'Categoria do produto (deve ser um dos seguintes valores exatos: Hortifruti, Laticínios, Carnes e Aves, Peixes e Frutos do Mar, Cereais e Grãos, Massas e Farináceos, Enlatados, Bebidas, Condimentos e Temperos, Congelados, Pães e Confeitaria, Ovos, Outros)'
              }
            },
            required: ['name', 'quantity', 'unit', 'suggested_category']
          }
        }
      }
    });

    const prompt = 'Analise esta imagem de um talão ou nota fiscal de supermercado e extraia a lista de produtos alimentícios comprados.';

    const imagePart = {
      inlineData: {
        data: dataBase64,
        mimeType: mimeType,
      },
    };

    // Envia para o Gemini
    const result = await model.generateContent([prompt, imagePart]);
    const responseText = result.response.text();
    console.debug('Gemini structured response:', responseText);

    let productsArray: any;
    try {
      productsArray = JSON.parse(responseText.trim());
    } catch (parseError) {
      console.error('Falha ao parsear JSON estruturado do Gemini:', parseError, '\nresponse:', responseText);
      return res.status(502).json({ detail: 'Resposta inválida da IA ao processar a imagem.', raw_response: responseText?.slice?.(0, 200) });
    }

    const rawItems = Array.isArray(productsArray) ? productsArray : [];

    // Post-process: normalize suggested_category to canonical names/ids
    const processed = rawItems.map((it: any) => {
      const name = it.name?.toString?.().trim?.() ?? '';
      const quantity = Number(it.quantity ?? 1) || 1;
      const unit = it.unit?.toString?.() ?? 'unidade';
      const suggested = it.suggested_category ?? it.suggestedCategory ?? '';
      const mapped = mapToCanonicalCategory(suggested, name);
      return {
        name,
        quantity,
        unit,
        suggested_category: mapped.name,
        category_id: mapped.id,
      };
    });

    // Return the shape expected by the frontend: an object containing
    // `items_parsed` (array of parsed items) and some metadata.
    res.json({
      items_parsed: processed,
      items_created: [],
      raw_count: processed.length,
    });
  } catch (error) {
    console.error('Erro no Gemini:', error);
    res.status(500).json({ detail: 'Erro ao processar a imagem com a Inteligência Artificial.' });
  }
});

// ==========================================
// POST /receipt/import — Salvar os produtos no Banco
// ==========================================
router.post('/import', async (req: AuthRequest, res) => {
  // Espera receber uma lista de produtos já validados pelo utilizador no front-end
  const { items } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ detail: 'Lista de itens vazia ou inválida.' });
  }

  // Validação e normalização dos itens antes de inserir no DB
  const normalized: any[] = [];
  for (const [idx, item] of items.entries()) {
    if (!item || typeof item !== 'object') {
      return res.status(400).json({ detail: `Item na posição ${idx} inválido.` });
    }

    const name = item.name?.toString?.().trim?.();
    if (!name) return res.status(400).json({ detail: `Item na posição ${idx} sem nome.` });

    // category_id pode vir vazio; atribuímos 16 (Outros) como fallback
    const categoryId = Number(item.category_id ?? item.categoryId ?? 16) || 16;

    // quantity: coerce para número, use 1 por defeito
    const quantity = Number(item.quantity ?? 1) || 1;

    const unit = item.unit?.toString?.() ?? 'unidade';

    const expiry_date = item.expiry_date ? new Date(item.expiry_date) : null;

    normalized.push({ name, categoryId, quantity, unit, expiry_date });
  }

  try {
    // Para cada item, prepara o objeto para o Prisma
    // Carrega avg_days das categorias usadas para estimar validade quando ausente
    let categoryIds = Array.from(new Set(normalized.map((n) => n.categoryId)));
    let categories = await prisma.category.findMany({ where: { id: { in: categoryIds } } });
    const avgDaysByCategory = new Map<number, number>();
    for (const c of categories) avgDaysByCategory.set(c.id, c.avg_days ?? 7);

    // Detect missing category IDs (cause of FK errors). Remap missing ones to 'Outros' (16).
    const missingIds = categoryIds.filter((id) => !avgDaysByCategory.has(id));
    if (missingIds.length > 0) {
      console.warn('Categorias não encontradas, remapeando para Outros (16):', missingIds);
      // Remap normalized items using missing IDs to 16
      for (const n of normalized) {
        if (missingIds.includes(n.categoryId)) n.categoryId = 16;
      }

      // Ensure we have avg_days for category 16
      if (!avgDaysByCategory.has(16)) {
        const cat16 = await prisma.category.findUnique({ where: { id: 16 } });
        avgDaysByCategory.set(16, cat16?.avg_days ?? 7);
      }

      // Recompute categoryIds and categories after remap
      categoryIds = Array.from(new Set(normalized.map((n) => n.categoryId)));
      categories = await prisma.category.findMany({ where: { id: { in: categoryIds } } });
      for (const c of categories) avgDaysByCategory.set(c.id, c.avg_days ?? 7);
    }

    const now = new Date();
    const dataToInsert = normalized.map((n) => {
      let expiryDate = n.expiry_date;
      let expiryEstimated = false;

      if (!expiryDate) {
        const avg = avgDaysByCategory.get(n.categoryId) ?? 7;
        const est = new Date(now);
        est.setDate(est.getDate() + Number(avg));
        expiryDate = est;
        expiryEstimated = true;
      }

      return {
        userId: req.userId!,
        categoryId: n.categoryId,
        name: n.name,
        quantity: n.quantity,
        unit: n.unit,
        expiry_date: expiryDate,
        expiry_estimated: expiryEstimated,
        notes: 'Importado via Leitor Inteligente',
      };
    });

    const insertedRecords = await prisma.inventoryItem.createMany({
      data: dataToInsert,
    });

    res.status(201).json({ 
      message: `${insertedRecords.count} produtos importados com sucesso!`,
      count: insertedRecords.count
    });
  } catch (error) {
    console.error('Erro na importação:', error);
    res.status(500).json({ detail: 'Erro ao salvar os itens no inventário.' });
  }
});

export default router;