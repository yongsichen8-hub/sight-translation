/**
 * 飞书用户迁移脚本（纯 Node.js，无需 ts-node）
 * 
 * 用法：
 *   node migrate.js --list                          # 查看现有飞书用户
 *   node migrate.js <username> <password>            # 迁移第一个未迁移的用户
 *   node migrate.js <username> <password> <feishuId> # 迁移指定飞书用户
 */

const fs = require('fs').promises;
const path = require('path');
const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 10;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const INDEX_PATH = path.join(DATA_DIR, 'users-index.json');

async function readIndex() {
  try {
    const content = await fs.readFile(INDEX_PATH, 'utf-8');
    return JSON.parse(content);
  } catch {
    return {};
  }
}

async function writeIndex(index) {
  await fs.mkdir(path.dirname(INDEX_PATH), { recursive: true });
  await fs.writeFile(INDEX_PATH, JSON.stringify(index, null, 2), 'utf-8');
}

async function findUserDirs() {
  const entries = await fs.readdir(DATA_DIR, { withFileTypes: true });
  const users = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const userJsonPath = path.join(DATA_DIR, entry.name, 'user.json');
    try {
      const content = await fs.readFile(userJsonPath, 'utf-8');
      const user = JSON.parse(content);
      users.push({ dir: entry.name, user });
    } catch {
      // not a user dir
    }
  }
  return users;
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('用法:');
    console.log('  node migrate.js --list                          # 查看现有飞书用户');
    console.log('  node migrate.js <username> <password>            # 迁移用户');
    console.log('  node migrate.js <username> <password> <feishuId> # 迁移指定用户');
    process.exit(1);
  }

  // 列出模式
  if (args[0] === '--list') {
    console.log(`数据目录: ${DATA_DIR}\n`);
    const users = await findUserDirs();
    if (users.length === 0) {
      console.log('未找到任何用户数据目录');
      return;
    }
    const index = await readIndex();
    const migratedDirs = new Set(Object.values(index));

    for (const { dir, user } of users) {
      const migrated = migratedDirs.has(dir);
      console.log(`  目录: ${dir}`);
      console.log(`    名称: ${user.name}`);
      console.log(`    飞书ID: ${user.feishuUserId || dir}`);
      console.log(`    创建时间: ${user.createdAt}`);
      console.log(`    状态: ${migrated ? '✓ 已迁移' : '✗ 未迁移'}`);
      if (migrated) {
        const username = Object.keys(index).find(k => index[k] === dir);
        console.log(`    用户名: ${username}`);
      }
      console.log('');
    }
    return;
  }

  // 迁移模式
  const username = args[0];
  const password = args[1];
  const targetFeishuId = args[2];

  if (!username || !password) {
    console.error('错误: 请提供用户名和密码');
    process.exit(1);
  }

  if (username.length < 2 || username.length > 30) {
    console.error('错误: 用户名长度必须为 2-30 个字符');
    process.exit(1);
  }

  if (password.length < 6) {
    console.error('错误: 密码长度至少 6 个字符');
    process.exit(1);
  }

  const index = await readIndex();

  if (index[username]) {
    console.error(`错误: 用户名 "${username}" 已存在`);
    process.exit(1);
  }

  const users = await findUserDirs();
  const migratedDirs = new Set(Object.values(index));
  let target = null;

  for (const { dir, user } of users) {
    if (targetFeishuId) {
      if (user.feishuUserId === targetFeishuId || dir === targetFeishuId) {
        target = { dir, user };
        break;
      }
    } else {
      if (!migratedDirs.has(dir)) {
        target = { dir, user };
        break;
      }
    }
  }

  if (!target) {
    console.error('未找到可迁移的飞书用户');
    process.exit(1);
  }

  console.log(`找到飞书用户: ${target.user.name} (${target.user.feishuUserId || target.dir})`);
  console.log(`数据目录: ${target.dir}`);
  console.log(`将关联到用户名: ${username}`);
  console.log('');

  // 生成密码哈希
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  // 更新 user.json
  const updatedUser = {
    ...target.user,
    username,
    passwordHash,
    updatedAt: new Date().toISOString(),
  };

  const userJsonPath = path.join(DATA_DIR, target.dir, 'user.json');
  await fs.writeFile(userJsonPath, JSON.stringify(updatedUser, null, 2), 'utf-8');

  // 更新索引
  index[username] = target.dir;
  await writeIndex(index);

  console.log('✓ 迁移完成！');
  console.log(`  用户名: ${username}`);
  console.log(`  数据目录: ${target.dir}`);
  console.log('  所有原有数据已保留');
}

main().catch(err => {
  console.error('迁移失败:', err.message);
  process.exit(1);
});
