import { Router } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

router.use(authMiddleware);

router.post('/', async (req, res) => {
  const { products } = req.body;

  if (!products || products.length === 0) {
    return res.status(400).json({ detail: 'Nenhum produto fornecido.' });
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `
      Sou um usuário do app "Desperdício Zero". 
      Tenho os seguintes ingredientes que estão próximos do vencimento: ${products.join(', ')}.
      
      Faça o seguinte em formato Markdown (usando os emojis compatíveis com o app):
      1. Crie uma receita rápida, fácil e saborosa focada nestes ingredientes para evitar o desperdício.
      2. Abaixo da receita, crie uma seção "💡 Doação Sustentável" sugerindo que, se o usuário tiver muito volume desses itens, ele pode doar. Sugira tipos de ONGs (bancos de alimentos, cozinhas solidárias) ou cite o "Mesa Brasil SESC" como exemplo real no Brasil.
    `;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    res.json({
      recipe: responseText,
      products_used: products
    });

  } catch (error) {
    console.error('Erro no Gemini:', error);
    res.status(500).json({ detail: 'Falha ao gerar receita com IA.' });
  }
});

export default router;