import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
// expo-server-sdk é ESM puro — usamos dynamic import() para compatibilidade com CommonJS
import type { Expo as ExpoType, ExpoPushMessage } from 'expo-server-sdk';

const prisma = new PrismaClient();

export const startCronJobs = () => {
  console.log('⏰ Motor de notificações agendado.');

  // Configurado para rodar todos os dias às 08:00 da manhã ('0 8 * * *')
  cron.schedule('0 8 * * *', async () => {
    console.log('Executando varredura diária de validades...');

    try {
      // Dynamic import do ESM expo-server-sdk (compatível com CommonJS)
      const { Expo } = await import('expo-server-sdk') as { Expo: typeof ExpoType & { isExpoPushToken: (token: string) => boolean } };
      const expo = new Expo();

      // 1. Pegar a data global e forçar o horário do Brasil (UTC-3)
      const now = new Date();
      now.setUTCHours(now.getUTCHours() - 3); 
      
      // Calcular a data daqui a 3 dias baseada no horário corrigido
      const targetDate = new Date(now);
      targetDate.setUTCDate(targetDate.getUTCDate() + 3);
      
      // Definir o início (00:00:00) e o fim (23:59:59) desse dia alvo
      const inThreeDaysStart = new Date(targetDate);
      inThreeDaysStart.setUTCHours(0, 0, 0, 0);

      const inThreeDaysEnd = new Date(targetDate);
      inThreeDaysEnd.setUTCHours(23, 59, 59, 999);

      // 2. Busca no banco
      const expiringItems = await prisma.inventoryItem.findMany({
        where: {
          expiry_date: {
            gte: inThreeDaysStart,
            lte: inThreeDaysEnd,
          },
        },
        include: {
          user: {
            include: { devices: true }
          }
        }
      });

      if (expiringItems.length === 0) {
        console.log('Nenhum item a expirar em 3 dias. Nada a notificar.');
        return;
      }

      // 3. Montar as mensagens
      const messages: ExpoPushMessage[] = [];

      for (const item of expiringItems) {
        const devices = item.user.devices;
        
        for (const device of devices) {
          // Verifica se o token é válido para o Expo
          if (!(Expo as any).isExpoPushToken(device.token)) continue;

          messages.push({
            to: device.token,
            sound: 'default',
            title: '⚠️ Atenção à Validade!',
            body: `O seu ${item.name} vence em 3 dias. Que tal planear uma receita?`,
            data: { itemId: item.id },
          });
        }
      }

      // 4. Disparar as mensagens em lote (chunks)
      const chunks = expo.chunkPushNotifications(messages);
      for (const chunk of chunks) {
        await expo.sendPushNotificationsAsync(chunk);
      }

      console.log(`✅ ${messages.length} notificações enviadas com sucesso!`);

    } catch (error) {
      console.error('Erro na rotina de notificações:', error);
    }
  });
};