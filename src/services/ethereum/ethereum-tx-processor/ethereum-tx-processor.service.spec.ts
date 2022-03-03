import { Test, TestingModule } from '@nestjs/testing';
import { EthereumTxProcessorService } from './ethereum-tx-processor.service';

describe('EthereumTxProcessorService', () => {
  let service: EthereumTxProcessorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EthereumTxProcessorService],
    }).compile();

    service = module.get<EthereumTxProcessorService>(EthereumTxProcessorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
