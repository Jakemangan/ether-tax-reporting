import { Test, TestingModule } from '@nestjs/testing';
import { EthereumWalletTrackingManager } from './ethereum-wallet-tracking-manager.service';

describe('EthereumWalletTrackingManagerService', () => {
  let service: EthereumWalletTrackingManager;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EthereumWalletTrackingManager],
    }).compile();

    service = module.get<EthereumWalletTrackingManager>(EthereumWalletTrackingManager);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
