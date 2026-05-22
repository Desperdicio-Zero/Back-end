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
      
      // Início do dia de hoje (0 dias)
      const todayStart = new Date(now);
      todayStart.setUTCHours(0, 0, 0, 0);
      
      // Fim do dia daqui a 3 dias (3 dias)
      const threeDaysEnd = new Date(now);
      threeDaysEnd.setUTCDate(threeDaysEnd.getUTCDate() + 3);
      threeDaysEnd.setUTCHours(23, 59, 59, 999);
      
      // 2. Busca no banco
      const expiringItems = await prisma.inventoryItem.findMany({
        where: {
          expiry_date: {
            gte: todayStart,
            lte: threeDaysEnd,
          },
        },
        include: {
          user: {
            include: { devices: true }
          }
        }
      });

      if (expiringItems.length === 0) {
        console.log('Nenhum item a expirar no intervalo de 0 a 3 dias. Nada a notificar.');
        return;
      }

      // 3. Montar as mensagens
      const messages: ExpoPushMessage[] = [];

      for (const item of expiringItems) {
        const devices = item.user.devices;
        if (devices.length === 0) continue;

        // Calcular a diferença em dias
        if (!item.expiry_date) continue;
        const diffTime = item.expiry_date.getTime() - todayStart.getTime();
        const remainingDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

        let title = '';
        let body = '';

        if (remainingDays === 0) {
          title = '🚨 Validade Vence Hoje!';
          body = `Atenção: o seu ${item.name} vence hoje! Use ou doe agora mesmo.`;
        } else if (remainingDays === 1) {
          title = '⚠️ Vence Amanhã!';
          body = `O seu ${item.name} vence amanhã. Que tal prepará-lo hoje?`;
        } else if (remainingDays === 3) {
          title = '💡 Atenção à Validade!';
          body = `O seu ${item.name} vence em 3 dias. Que tal planejar uma receita?`;
        } else {
          // Ignorar se for 2 dias ou outro valor fora dos limites desejados
          continue;
        }

        for (const device of devices) {
          // Verifica se o token é válido para o Expo
          if (!(Expo as any).isExpoPushToken(device.token)) continue;

          messages.push({
            to: device.token,
            sound: 'default',
            title,
            body,
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