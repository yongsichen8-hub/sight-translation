import app from './app';
import { config } from './config';

const PORT = config.port;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 服务器运行在 http://0.0.0.0:${PORT}`);
  console.log(`📁 数据目录: ${config.dataDir}`);
  console.log(`🔐 环境: ${config.nodeEnv}`);
});
