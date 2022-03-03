import { Test, TestingModule } from '@nestjs/testing';
import { EthereumTranasctionProcessManager } from './ethereum-process-manager.service';

describe('EthereumProcessManagerService', () => {
  let service: EthereumTranasctionProcessManager;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EthereumTranasctionProcessManager],
    }).compile();

    service = module.get<EthereumTranasctionProcessManager>(EthereumTranasctionProcessManager);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
