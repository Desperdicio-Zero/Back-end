import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { authMiddleware, AuthRequest } from '../middlewares/authMiddleware';

const router = Router();
const prisma = new PrismaClient();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

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
    const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });

    const prompt = `
      Analise esta imagem de um talão/nota fiscal de supermercado.
      Extraia os produtos alimentícios e devolva EXCLUSIVAMENTE um array JSON válido.
      Não adicione formatação markdown (como \`\`\`json).
      O formato de cada objeto deve ser:
      {
        "name": "Nome do Produto",
        "quantity": 1,
        "unit": "unidade" (ou "kg", "litro", "grama", etc),
        "suggested_category": "Laticínios" (tente classificar o produto)
      }
    `;

    const imagePart = {
      inlineData: {
        data: dataBase64,
        mimeType: mimeType,
      },
    };

    // Envia para o Gemini
    const result = await model.generateContent([prompt, imagePart]);
    const responseText = result.response.text();
    console.debug('Gemini raw response:', responseText);

    // Limpa a resposta (caso a IA ainda envie formatação markdown) e parseia o JSON
    const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();

    let productsArray: any;
    try {
      productsArray = JSON.parse(cleanJson);
    } catch (parseError) {
      console.error('Falha ao parsear JSON do Gemini:', parseError, '\nresponse:', responseText);
      return res.status(502).json({ detail: 'Resposta inválida da IA ao processar a imagem.', raw_response: responseText?.slice?.(0, 200) });
    }

    const rawItems = Array.isArray(productsArray) ? productsArray : [];

    // Return the shape expected by the frontend: an object containing
    // `items_parsed` (array of parsed items) and some metadata.
    res.json({
      items_parsed: rawItems,
      items_created: [],
      raw_count: rawItems.length,
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

    // category_id pode vir vazio; atribuímos 13 (Outros) como fallback
    const categoryId = Number(item.category_id ?? item.categoryId ?? 13) || 13;

    // quantity: coerce para número, use 1 por defeito
    const quantity = Number(item.quantity ?? 1) || 1;

    const unit = item.unit?.toString?.() ?? 'unidade';

    const expiry_date = item.expiry_date ? new Date(item.expiry_date) : null;

    normalized.push({ name, categoryId, quantity, unit, expiry_date });
  }

  try {
    // Para cada item, prepara o objeto para o Prisma
    // Carrega avg_days das categorias usadas para estimar validade quando ausente
    const categoryIds = Array.from(new Set(normalized.map((n) => n.categoryId)));
    const categories = await prisma.category.findMany({ where: { id: { in: categoryIds } } });
    const avgDaysByCategory = new Map<number, number>();
    for (const c of categories) avgDaysByCategory.set(c.id, c.avg_days ?? 7);

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