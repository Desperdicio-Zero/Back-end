import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
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