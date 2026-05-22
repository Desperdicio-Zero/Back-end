import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import { authMiddleware } from '../middlewares/authMiddleware';
import { logger } from '../lib/logger';

const router = Router();
const prisma = new PrismaClient();
const log = logger('Catalog');

router.use(authMiddleware);

const KEYWORD_TO_CATEGORY: Array<[string, number]> = [
  // 1: Hortifruti
  ['hortalica', 1], ['hortalicas', 1], ['fruta', 1], ['frutas', 1], ['legume', 1], ['legumes', 1], ['verdura', 1], ['verduras', 1], ['hortifruti', 1],
  // 2: Laticínios
  ['laticinio', 2], ['laticinios', 2], ['leite', 2], ['leites', 2], ['queijo', 2], ['queijos', 2], ['requeijao', 2], ['creme de leite', 2], ['iogurte', 2], ['iogurtes', 2], ['manteiga', 2], ['milk', 2], ['dairy', 2], ['dairies', 2], ['cheese', 2], ['cheeses', 2], ['yogurt', 2],
  // 3: Carnes e Aves
  ['carne', 3], ['carnes', 3], ['frango', 3], ['ave', 3], ['aves', 3], ['bovino', 3], ['suino', 3], ['salsicha', 3], ['linguica', 3], ['presunto', 3], ['meat', 3], ['meats', 3], ['chicken', 3], ['beef', 3], ['pork', 3],
  // 4: Peixes e Frutos do Mar
  ['peixe', 4], ['peixes', 4], ['fruto do mar', 4], ['frutos do mar', 4], ['atum', 4], ['sardinha', 4], ['shrimp', 4], ['fish', 4], ['seafood', 4],
  // 5: Cereais e Grãos
  ['cereal', 5], ['cereals', 5], ['grao', 5], ['graos', 5], ['arroz', 5], ['feijao', 5], ['feijoes', 5], ['lentilha', 5], ['milho', 5], ['soja', 5], ['grain', 5], ['grains', 5], ['rice', 5], ['bean', 5], ['beans', 5],
  // 6: Massas e Farináceos
  ['massa', 6], ['massas', 6], ['macarrao', 6], ['macarroes', 6], ['farinha', 6], ['fuba', 6], ['tapioca', 6], ['pasta', 6], ['flour', 6],
  // 7: Enlatados
  ['conserva', 7], ['conservas', 7], ['enlatado', 7], ['enlatados', 7], ['lata', 7], ['sardinha em lata', 7], ['canned', 7],
  // 8: Bebidas
  ['bebida', 8], ['bebidas', 8], ['suco', 8], ['sucos', 8], ['refrigerante', 8], ['agua', 8], ['cha', 8], ['cafe', 8], ['cerveja', 8], ['vinho', 8], ['liquido', 8], ['achocolatado', 8], ['beverage', 8], ['beverages', 8], ['drink', 8], ['drinks', 8], ['juice', 8], ['juices', 8], ['soda', 8],
  // 9: Condimentos e Temperos
  ['condimento', 9], ['condimentos', 9], ['tempero', 9], ['temperos', 9], ['molho', 9], ['molhos', 9], ['sal', 9], ['pimenta', 9], ['azeite', 9], ['oleo', 9], ['vinagre', 9], ['spice', 9], ['spices', 9], ['condiment', 9], ['condiments', 9], ['sauce', 9], ['sauces', 9],
  // 10: Congelados
  ['congelado', 10], ['congelados', 10], ['sorvete', 10], ['sorvetes', 10], ['frozen', 10],
  // 11: Pães e Confeitaria
  ['pao', 11], ['paes', 11], ['bolo', 11], ['bolos', 11], ['biscoito', 11], ['biscoitos', 11], ['bolacha', 11], ['bolachas', 11], ['doce', 11], ['doces', 11], ['confeitaria', 11], ['sobremesa', 11], ['sobremesas', 11], ['chocolate', 11], ['bread', 11], ['breads', 11], ['cake', 11], ['cakes', 11],
  // 12: Ovos
  ['ovo', 12], ['ovos', 12], ['egg', 12], ['eggs', 12],
];

function normalizeText(input: string): string {
  return input
    .toLowerCase()
    // remove acentos comuns
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function guessCategoryFromText(text: string | null | undefined): number {
  const normalized = normalizeText(text ?? '');
  if (!normalized) return 16;

  for (const [keyword, id] of KEYWORD_TO_CATEGORY) {
    if (normalized.includes(normalizeText(keyword))) return id;
  }

  return 16;
}

function parseQuantityNormalized(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const text = raw.toLowerCase().replace(',', '.').trim();

  // Captura números do tipo: "500", "0.5", "1.5"
  const match = text.match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const value = Number(match[1]);
  if (!Number.isFinite(value) || value <= 0) return null;

  // Normalização simples: kg → g, l → ml (mantém apenas a escala)
  if (/(\bkg\b)/.test(text)) return value * 1000;
  if (/(\bg\b)/.test(text)) return value;
  if (/(\bl\b)/.test(text)) return value * 1000;
  if (/(\bml\b)/.test(text)) return value;

  return value;
}

router.get('/search', async (req, res) => {
  const q = String(req.query.q ?? '').trim();
  const limitRaw = Number(req.query.limit ?? 10);
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(50, Math.floor(limitRaw))) : 10;

  if (q.length < 2) {
    return res.json([]);
  }

  const rows = await prisma.catalogoProduto.findMany({
    where: {
      nome_produto: {
        contains: q,
      },
    },
    take: limit,
  });

  const out = rows.map((row) => {
    const categoriaText = row.categoria ?? '';
    return {
      ean: row.barcode,
      name: row.nome_produto ?? '',
      quantity_normalized: parseQuantityNormalized(row.quantidade),
      brand: { id: 0, name: row.marcas ?? '' },
      category: { id: guessCategoryFromText(categoriaText), name: categoriaText },
      energy_kcal_100g: row.qtd_caloria ? Number(row.qtd_caloria) : 0,
      fat_100g: row.qtd_gordura ? Number(row.qtd_gordura) : 0,
      carbohydrates_100g: row.qtd_carbo ? Number(row.qtd_carbo) : 0,
      sugars_100g: row.qtd_acucar ? Number(row.qtd_acucar) : 0,
      proteins_100g: row.qtd_proteina ? Number(row.qtd_proteina) : 0,
      nutriscore_grade: row.graduacao_nutricional ?? null,
      nova_group: row.nova_group ?? null,
    };
  });

  res.json(out);
});

async function fetchFromOpenFoodFacts(ean: string) {
  try {
    const url = `https://world.openfoodfacts.org/api/v0/product/${ean}.json`;
    const response = await axios.get(url, {
      headers: { 'User-Agent': 'DesperdicioZero - WebApp - Version 1.0' },
      timeout: 5000,
    });

    if (response.data && response.data.status === 1 && response.data.product) {
      const p = response.data.product;
      const nutriments = p.nutriments || {};

      return {
        barcode: ean,
        nome_produto: p.product_name_pt || p.product_name || p.product_name_en || 'Produto Desconhecido',
        marcas: p.brands || null,
        categoria: p.categories || null,
        quantidade: p.quantity || null,
        porcao: null,
        graduacao_nutricional: p.nutrition_grades ? String(p.nutrition_grades).toUpperCase().slice(0, 1) : null,
        nova_group: p.nova_group !== undefined && p.nova_group !== null ? Number(p.nova_group) : null,
        qtd_caloria: nutriments['energy-kcal_100g'] !== undefined ? Number(nutriments['energy-kcal_100g']) : null,
        qtd_gordura: nutriments['fat_100g'] !== undefined ? Number(nutriments['fat_100g']) : null,
        qtd_gordura_saturada: nutriments['saturated-fat_100g'] !== undefined ? Number(nutriments['saturated-fat_100g']) : null,
        qtd_carbo: nutriments['carbohydrates_100g'] !== undefined ? Number(nutriments['carbohydrates_100g']) : null,
        qtd_acucar: nutriments['sugars_100g'] !== undefined ? Number(nutriments['sugars_100g']) : null,
        qtd_proteina: nutriments['proteins_100g'] !== undefined ? Number(nutriments['proteins_100g']) : null,
        qtd_sodio: nutriments['sodium_100g'] !== undefined ? Number(nutriments['sodium_100g']) : null,
        qtd_fibra: nutriments['fiber_100g'] !== undefined ? Number(nutriments['fiber_100g']) : null,
        data_isercao_prod: new Date()
      };
    }
  } catch (error) {
    console.error(`Erro ao buscar no Open Food Facts para o EAN ${ean}:`, error);
  }
  return null;
}

router.get('/:ean', async (req, res) => {
  const ean = String(req.params.ean ?? '').trim();
  if (!ean) {
    return res.status(400).json({ detail: 'EAN inválido.' });
  }

  let row = await prisma.catalogoProduto.findUnique({
    where: { barcode: ean },
  });

  if (!row) {
    log.info(`EAN ${ean} não encontrado no catálogo local. Buscando no Open Food Facts...`);
    const offData = await fetchFromOpenFoodFacts(ean);
    if (offData) {
      try {
        row = await prisma.catalogoProduto.create({
          data: offData
        });
        log.info(`EAN ${ean} importado com sucesso do Open Food Facts e salvo no banco local.`);
      } catch (dbError) {
        log.error('Erro ao salvar produto do Open Food Facts no banco local:', dbError);
        row = offData as any; // Fallback para retornar sem falhar a requisição
      }
    }
  }

  if (!row) {
    return res.status(404).json({ detail: 'Produto não encontrado no catálogo local ou externo.' });
  }

  const categoriaText = row.categoria ?? '';

  return res.json({
    ean: row.barcode,
    name: row.nome_produto ?? '',
    quantity_normalized: parseQuantityNormalized(row.quantidade),
    brand: { id: 0, name: row.marcas ?? '' },
    category: { id: guessCategoryFromText(categoriaText), name: categoriaText },
    energy_kcal_100g: row.qtd_caloria ? Number(row.qtd_caloria) : 0,
    fat_100g: row.qtd_gordura ? Number(row.qtd_gordura) : 0,
    carbohydrates_100g: row.qtd_carbo ? Number(row.qtd_carbo) : 0,
    sugars_100g: row.qtd_acucar ? Number(row.qtd_acucar) : 0,
    proteins_100g: row.qtd_proteina ? Number(row.qtd_proteina) : 0,
    nutriscore_grade: row.graduacao_nutricional ?? null,
    nova_group: row.nova_group ?? null,
  });
});

export default router;
