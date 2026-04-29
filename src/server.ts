import app from './app';
import dotenv from 'dotenv';
import { startCronJobs } from './services/cronService';

dotenv.config();

const PORT = process.env.PORT || 8000;

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);

    startCronJobs();
});