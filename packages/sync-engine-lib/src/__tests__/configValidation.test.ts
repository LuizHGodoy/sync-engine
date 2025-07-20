import { SyncEngineUtils } from '../index';

describe('Config Validation', () => {
  it('should fail validation with empty serverUrl', () => {
    const config = SyncEngineUtils.createDefaultConfig('');
    const validation = SyncEngineUtils.validateConfig(config);
    expect(validation.valid).toBe(false);
    expect(validation.errors).toContain('serverUrl is required');
  });

  it('should fail validation with invalid URL', () => {
    const config = SyncEngineUtils.createDefaultConfig('not-a-url');
    const validation = SyncEngineUtils.validateConfig(config);
    expect(validation.valid).toBe(false);
    expect(validation.errors).toContain('serverUrl must be a valid URL');
  });

  it('should fail validation with negative batchSize', () => {
    const config = SyncEngineUtils.createDefaultConfig('http://localhost');
    config.batchSize = -1;
    const validation = SyncEngineUtils.validateConfig(config);
    expect(validation.valid).toBe(false);
    expect(validation.errors).toContain('batchSize must be greater than 0');
  });

  it('should fail validation with invalid backoffMultiplier', () => {
    const config = SyncEngineUtils.createDefaultConfig('http://localhost');
    config.backoffMultiplier = 0.5;
    const validation = SyncEngineUtils.validateConfig(config);
    expect(validation.valid).toBe(false);
    expect(validation.errors).toContain('backoffMultiplier must be greater than 1');
  });

  it('should pass validation with valid HTTPS URL', () => {
    const config = SyncEngineUtils.createDefaultConfig('https://api.example.com');
    const validation = SyncEngineUtils.validateConfig(config);
    expect(validation.valid).toBe(true);
    expect(validation.errors.length).toBe(0);
  });
});
