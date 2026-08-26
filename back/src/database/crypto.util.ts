import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { join } from 'node:path';

/**
 * 凭据静态加密（at-rest）。
 *
 * 设计要点：
 * - 算法：AES-256-GCM（带完整性校验）。
 * - 密钥：优先环境变量 `AISSH_DB_KEY`（hex 或 base64，32 字节）；
 *   否则在 app data 目录生成随机 32 字节密钥文件 `.dbkey`（权限 0600）。
 * - `back` 是独立 Node 子进程（无 Electron API），故采用密钥文件方案；
 *   较明文有本质提升，安全性受限于宿主机文件权限（已用 0600）。
 * - 密文带 `enc:v1:` 前缀，可识别历史明文（前缀缺失即视为遗留明文，原样返回以兼容）。
 * - 解密失败返回 null（如密钥变更），由调用方触发重新输入，避免发送乱码到 SSH。
 */

const PREFIX = 'enc:v1:';
const KEY_FILE = '.dbkey';

function loadKey(appDataDir: string): Buffer {
  const envKey = process.env.AISSH_DB_KEY;
  if (envKey) {
    const fromHex = Buffer.from(envKey, 'hex');
    if (fromHex.length === 32) return fromHex;
    const fromB64 = Buffer.from(envKey, 'base64');
    if (fromB64.length === 32) return fromB64;
  }

  mkdirSync(appDataDir, { recursive: true });
  const keyPath = join(appDataDir, KEY_FILE);

  if (!existsSync(keyPath)) {
    return createKeyFile(keyPath);
  }

  const hex = readFileSync(keyPath, 'utf8').trim();
  const key = Buffer.from(hex, 'hex');
  if (key.length === 32) return key;

  // 密钥文件损坏/格式不符，重新生成（历史密文将无法解密，用户需重输密码）
  return createKeyFile(keyPath);
}

function createKeyFile(keyPath: string): Buffer {
  const key = randomBytes(32);
  writeFileSync(keyPath, key.toString('hex'), { encoding: 'utf8', mode: 0o600 });
  try {
    chmodSync(keyPath, 0o600);
  } catch {
    // 非 POSIX 或无权限，忽略
  }
  return key;
}

export interface SecretStore {
  encrypt(plain: string): string;
  decrypt(stored: string): string | null;
  isEncrypted(stored: string): boolean;
}

export function createSecretStore(appDataDir: string): SecretStore {
  const key = loadKey(appDataDir);

  const encrypt = (plain: string): string => {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    const payload = Buffer.concat([iv, tag, enc]).toString('base64');
    return PREFIX + payload;
  };

  const decrypt = (stored: string): string | null => {
    if (!stored) return null;
    if (!stored.startsWith(PREFIX)) return stored; // 遗留明文：原样返回以兼容
    try {
      const buf = Buffer.from(stored.slice(PREFIX.length), 'base64');
      const iv = buf.subarray(0, 12);
      const tag = buf.subarray(12, 28);
      const enc = buf.subarray(28);
      const decipher = createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(tag);
      const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
      return dec.toString('utf8');
    } catch {
      return null;
    }
  };

  const isEncrypted = (stored: string): boolean => stored.startsWith(PREFIX);

  return { encrypt, decrypt, isEncrypted };
}
