import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class CredentialService {
  private readonly preferenceKey = 'aiApiKey';

  constructor(private readonly databaseService: DatabaseService) {}

  async setApiKey(value: unknown): Promise<void> {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new BadRequestException('AI API key is required');
    }
    this.databaseService.setPreference(this.preferenceKey, this.databaseService.encryptPassword(value.trim()));
  }

  async getApiKey(): Promise<string | null> {
    const raw = this.databaseService.getPreference<string>(this.preferenceKey);
    return raw ? this.databaseService.decryptPassword(raw) : null;
  }

  async clearApiKey(): Promise<void> {
    this.databaseService.deletePreference(this.preferenceKey);
  }
}
