import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();
const prisma = new PrismaClient();

router.use(authMiddleware);

const mapToAppFormat = (dbProduct: any) => {
  return {
    ean: dbProduct.barcode,
    name: dbProduct.nome_produto || 'Produto sem nome',
    quantity_normalized: dbProduct.quantidade || null,
    brand: {
      id: 0,
      name: dbProduct.marcas || 'Marca desconhecida'
    },
    category: {
      id: 0,
      name: dbProduct.categoria || 'Sem categoria'
    },
    // Convertendo Decimal do MySQL para Number do JavaScript
    energy_kcal_100g: dbProduct.qtd_caloria ? Number(dbProduct.qtd_caloria) : 0,
    fat_100g: dbProduct.qtd_gordura ? Number(dbProduct.qtd_gordura) : 0,
    carbohydrates_100g: dbProduct.qtd_carbo ? Number(dbProduct.qtd_carbo) : 0,
    sugars_100g: dbProduct.qtd_acucar ? Number(dbProduct.qtd_acucar) : 0,
    proteins_100g: dbProduct.qtd_proteina ? Number(dbProduct.qtd_proteina) : 0,
    
    nutriscore_grade: dbProduct.graduacao_nutricional || null,
    nova_group: dbProduct.nova_group || null
  };
};

// ==========================================
// GET /catalog/search — Buscar no banco (autocomplete)
// ==========================================
router.get('/search', async (req, res) => {
  const { q, limit = 20 } = req.query;

  if (!q) {
    return res.status(400).json({ detail: 'O parâmetro de busca (q) é obrigatório.' });
  }

  try {
    const productsDb = await prisma.catalogoProduto.findMany({
      where: {
        nome_produto: {
          contains: String(q)
          // Nota: No MySQL, o "contains" já é case-insensitive por padrão (ignorando maiúsculas/minúsculas)
          // devido ao Collation (ex: utf8mb4_unicode_ci), então não precisa do "mode: insensitive" aqui.
        },
      },
      take: Number(limit),
    });

    // Mapeia a lista do banco para o formato do app
    const formattedProducts = productsDb.map(mapToAppFormat);
    res.json(formattedProducts);
  } catch (error) {
    console.error('Erro na busca local do catálogo:', error);
    res.status(500).json({ detail: 'Erro ao consultar o catálogo de produtos.' });
  }
});

// ==========================================
// GET /catalog/:ean — Buscar por EAN no banco (Scanner)
// ==========================================
router.get('/:ean', async (req, res) => {
  const { ean } = req.params;

  try {
    const productDb = await prisma.catalogoProduto.findUnique({
      where: { barcode: ean },
    });

    if (!productDb) {
      return res.status(404).json({ detail: 'Produto não encontrado na base de dados.' });
    }

    res.json(mapToAppFormat(productDb));
  } catch (error) {
    console.error('Erro na busca por EAN local:', error);
    res.status(500).json({ detail: 'Erro ao consultar o código de barras.' });
  }
});

export default router;