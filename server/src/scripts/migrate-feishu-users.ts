/**
 * 飞书用户迁移脚本
 * 
 * 扫描 data 目录下所有用户目录，读取 user.json，
 * 为每个飞书用户创建 users-index.json 条目。
 * 
 * 用法：
 *   npx ts-node src/scripts/migrate-feishu-users.ts <username> <password>
 * 
 * 这会将找到的第一个飞书用户关联到指定的用户名和密码。
 * 如果有多个用户，需要多次运行并指定不同的 feishuUserId。
 * 
 * 高级用法（指定飞书用户ID）：
 *   npx ts-node src/scripts/migrate-feishu-users.ts <username> <password> <feishuUserId>
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as bcrypt from 'bcryptjs';
import { config } from '../config';

interface OldUser {
  id: string;
  feishuUserId: string;
  name: string;
  avatar?: string;
  createdAt: string;
  updatedAt: string;
}

interface UsersIndex {
  [username: string]: string;
}

const SALT_ROUNDS = 10;

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log('用法: npx ts-node src/scripts/migrate-feishu-users.ts <username> <password> [feishuUserId]');
    console.log('');
    console.log('先运行不带参数查看现有用户:');
    console.log('  npx ts-node src/scripts/migrate-feishu-users.ts --list');
    process.exit(1);
  }

  const dataDir = config.dataDir;
  const indexPath = path.join(dataDir, 'users-index.json');

  // 列出模式
  if (args[0] === '--list') {
    console.log(`扫描数据目录: ${dataDir}`);
    const entries = await fs.readdir(dataDir, { withFileTypes: true });
    
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const userJsonPath = path.join(dataDir, entry.name, 'user.json');
      try {
        const content = await fs.readFile(userJsonPath, 'utf-8');
        const user = JSON.parse(content) as OldUser;
        console.log(`  目录: ${entry.name}`);
        console.log(`    名称: ${user.name}`);
        console.log(`    飞书ID: ${user.feishuUserId}`);
        console.log(`    创建时间: ${user.createdAt}`);
        console.log('');
      } catch {
        // 不是用户目录，跳过
      }
    }
    return;
  }

  const username = args[0]!;
  const password = args[1]!;
  const targetFeishuId = args[2];

  // 读取现有索引
  let index: UsersIndex = {};
  try {
    const content = await fs.readFile(indexPath, 'utf-8');
    index = JSON.parse(content);
  } catch {
    // 索引不存在
  }

  if (index[username]) {
    console.error(`错误: 用户名 "${username}" 已存在于索引中`);
    process.exit(1);
  }

  // 查找飞书用户
  const entries = await fs.readdir(dataDir, { withFileTypes: true });
  let foundUser: OldUser | null = null;
  let foundDir = '';

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const userJsonPath = path.join(dataDir, entry.name, 'user.json');
    try {
      const content = await fs.readFile(userJsonPath, 'utf-8');
      const user = JSON.parse(content) as OldUser;
      
      if (targetFeishuId) {
        if (user.feishuUserId === targetFeishuId || entry.name === targetFeishuId) {
          foundUser = user;
          foundDir = entry.name;
          break;
        }
      } else {
        // 没指定 feishuUserId，取第一个未迁移的
        const alreadyMigrated = Object.values(index).includes(entry.name);
        if (!alreadyMigrated) {
          foundUser = user;
          foundDir = entry.name;
          break;
        }
      }
    } catch {
      // 跳过
    }
  }

  if (!foundUser || !foundDir) {
    console.error('未找到可迁移的飞书用户');
    process.exit(1);
  }

  console.log(`找到飞书用户: ${foundUser.name} (${foundUser.feishuUserId})`);
  console.log(`数据目录: ${foundDir}`);
  console.log(`将关联到用户名: ${username}`);

  // 生成密码哈希
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  // 更新 user.json
  const updatedUser = {
    ...foundUser,
    username,
    passwordHash,
    updatedAt: new Date().toISOString(),
  };

  const userJsonPath = path.join(dataDir, foundDir, 'user.json');
  await fs.writeFile(userJsonPath, JSON.stringify(updatedUser, null, 2), 'utf-8');

  // 更新索引
  index[username] = foundDir;
  await fs.writeFile(indexPath, JSON.stringify(index, null, 2), 'utf-8');

  console.log('✓ 迁移完成！');
  console.log(`  用户名: ${username}`);
  console.log(`  数据目录: ${foundDir}`);
  console.log('  所有原有数据已保留');
}

main().catch(err => {
  console.error('迁移失败:', err);
  process.exit(1);
});
