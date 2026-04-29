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
  const { imageBase64, mimeType = 'image/jpeg' } = req.body;

  if (!imageBase64) {
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
        data: imageBase64,
        mimeType: mimeType,
      },
    };

    // Envia para o Gemini
    const result = await model.generateContent([prompt, imagePart]);
    const responseText = result.response.text();

    // Limpa a resposta (caso a IA ainda envie formatação markdown) e parseia o JSON
    const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    
    const productsArray = JSON.parse(cleanJson);

    res.json(productsArray);
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

  try {
    // Para cada item, prepara o objeto para o Prisma
    const dataToInsert = items.map((item: any) => ({
      userId: req.userId!,
      categoryId: item.category_id, // O App deve enviar o ID da categoria correta
      name: item.name,
      quantity: Number(item.quantity),
      unit: item.unit,
      expiry_date: item.expiry_date ? new Date(item.expiry_date) : null,
      notes: "Importado via Leitor Inteligente"
    }));

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