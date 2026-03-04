import app from './app';
import { config } from './config';

const PORT = config.port;

app.listen(PORT, () => {
  console.log(`🚀 服务器运行在 http://localhost:${PORT}`);
  console.log(`📁 数据目录: ${config.dataDir}`);
  console.log(`🔐 环境: ${config.nodeEnv}`);
});
