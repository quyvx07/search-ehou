import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32;
  private readonly ivLength = 16;
  private readonly saltLength = 64;
  private readonly tagLength = 16;

  constructor(private configService: ConfigService) {}

  /**
   * Encrypt sensitive data using AES-256-GCM
   */
  async encrypt(data: string): Promise<string> {
    try {
      const salt = crypto.randomBytes(this.saltLength);
      const iv = crypto.randomBytes(this.ivLength);
      
      // Derive key from environment variable and salt
      const masterKey = this.configService.get<string>('ENCRYPTION_MASTER_KEY');
      if (!masterKey) {
        throw new Error('ENCRYPTION_MASTER_KEY not configured');
      }
      
      const key = crypto.pbkdf2Sync(masterKey, salt, 100000, this.keyLength, 'sha256');
      
      // Create cipher
      const cipher = crypto.createCipher(this.algorithm, key);
      cipher.setAAD(Buffer.from('search-ehou', 'utf8'));
      
      // Encrypt data
      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // Get auth tag
      const tag = cipher.getAuthTag();
      
      // Combine all components: salt + iv + tag + encrypted
      const result = Buffer.concat([salt, iv, tag, Buffer.from(encrypted, 'hex')]);
      
      return result.toString('base64');
    } catch (error) {
      throw new Error(`Encryption failed: ${error.message}`);
    }
  }

  /**
   * Decrypt encrypted data
   */
  async decrypt(encryptedData: string): Promise<string> {
    try {
      const data = Buffer.from(encryptedData, 'base64');
      
      // Extract components
      const salt = data.subarray(0, this.saltLength);
      const iv = data.subarray(this.saltLength, this.saltLength + this.ivLength);
      const tag = data.subarray(this.saltLength + this.ivLength, this.saltLength + this.ivLength + this.tagLength);
      const encrypted = data.subarray(this.saltLength + this.ivLength + this.tagLength);
      
      // Derive key
      const masterKey = this.configService.get<string>('ENCRYPTION_MASTER_KEY');
      if (!masterKey) {
        throw new Error('ENCRYPTION_MASTER_KEY not configured');
      }
      
      const key = crypto.pbkdf2Sync(masterKey, salt, 100000, this.keyLength, 'sha256');
      
      // Create decipher
      const decipher = crypto.createDecipher(this.algorithm, key);
      decipher.setAAD(Buffer.from('search-ehou', 'utf8'));
      decipher.setAuthTag(tag);
      
      // Decrypt data
      let decrypted = decipher.update(encrypted, undefined, 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      throw new Error(`Decryption failed: ${error.message}`);
    }
  }

  /**
   * Hash data for integrity checking
   */
  async hash(data: string): Promise<string> {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Generate secure random string
   */
  generateSecureRandom(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Encrypt object by encrypting sensitive fields
   */
  async encryptObject(obj: any, sensitiveFields: string[]): Promise<any> {
    const encrypted = { ...obj };
    
    for (const field of sensitiveFields) {
      if (obj[field] && typeof obj[field] === 'string') {
        encrypted[field] = await this.encrypt(obj[field]);
      }
    }
    
    return encrypted;
  }

  /**
   * Decrypt object by decrypting sensitive fields
   */
  async decryptObject(obj: any, sensitiveFields: string[]): Promise<any> {
    const decrypted = { ...obj };
    
    for (const field of sensitiveFields) {
      if (obj[field] && typeof obj[field] === 'string') {
        try {
          decrypted[field] = await this.decrypt(obj[field]);
        } catch (error) {
          // If decryption fails, keep original value
          console.warn(`Failed to decrypt field ${field}:`, error.message);
        }
      }
    }
    
    return decrypted;
  }
}
