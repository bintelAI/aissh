import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseService } from '../database/database.service';
import { CredentialService } from './credential.service';

describe('CredentialService', () => {
  it('persists the OpenAI API key in local SQLite and can read it back', async () => {
    const database = new DatabaseService(mkdtempSync(join(tmpdir(), 'aissh-ai-key-')));
    const service = new (CredentialService as unknown as new (database: DatabaseService) => CredentialService)(database);

    await service.setApiKey('sqlite-api-key');

    // API Key 落库时为密文（非明文），getApiKey 往返解密为原文
    const stored = database.getPreference<string>('aiApiKey');
    expect(stored).not.toBe('sqlite-api-key');
    expect(typeof stored === 'string' && stored.startsWith('enc:v1:')).toBe(true);
    expect(await service.getApiKey()).toBe('sqlite-api-key');
    database.close();
  });
});
