const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const CATEGORIES = [
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
  { id: 13, name: 'Biscoitos e Snacks', avg_days: 30 },
  { id: 14, name: 'Frios e Embutidos', avg_days: 10 },
  { id: 15, name: 'Doces e Chocolates', avg_days: 60 },
  { id: 16, name: 'Outros', avg_days: 7 },
];

async function main() {
  console.log('Seeding categories...');
  for (const cat of CATEGORIES) {
    await prisma.category.upsert({
      where: { id: cat.id },
      update: { name: cat.name, avg_days: cat.avg_days },
      create: cat,
    });
  }
  console.log('Categories seeded.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
