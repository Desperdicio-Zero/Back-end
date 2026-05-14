import app from './app';
import dotenv from 'dotenv';
import { startCronJobs } from './services/cronService';
import { rootLogger } from './lib/logger';

dotenv.config();

const PORT = process.env.PORT || 8000;
const ENV  = process.env.NODE_ENV || 'development';

app.listen(PORT, () => {
  rootLogger.info(`🚀 Servidor iniciado`, { porta: PORT, ambiente: ENV });
  rootLogger.info(`🌐 URL: http://localhost:${PORT}`);
  rootLogger.info(`🗄️  Banco: ${process.env.DATABASE_URL?.split('@')[1]?.split('/')[1] ?? 'desperdicio_zero'}`);
  startCronJobs();
  rootLogger.info('⏰ Cron jobs iniciados');
});