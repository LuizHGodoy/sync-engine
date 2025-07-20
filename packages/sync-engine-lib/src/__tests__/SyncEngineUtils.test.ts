import { SyncEngineUtils } from '../index';

describe('SyncEngineUtils', () => {
  it('should create a default config with a server URL', () => {
    const config = SyncEngineUtils.createDefaultConfig('http://localhost');
    expect(config.serverUrl).toBe('http://localhost');
  });

  it('should create an optimized config', () => {
    const config = SyncEngineUtils.createOptimizedConfig('http://localhost', 'balanced');
    expect(config.serverUrl).toBe('http://localhost');
    expect(config).toHaveProperty('batchSize');
  });

  it('should generate a unique ID', () => {
    const id1 = SyncEngineUtils.generateId();
    const id2 = SyncEngineUtils.generateId();
    expect(id1).not.toBe(id2);
  });

  it('should validate a correct config', () => {
    const config = SyncEngineUtils.createDefaultConfig('http://localhost');
    const validation = SyncEngineUtils.validateConfig(config);
    expect(validation.valid).toBe(true);
    expect(validation.errors.length).toBe(0);
  });
});
