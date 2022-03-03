import { Test, TestingModule } from '@nestjs/testing';
import { EthereumNodeService } from './ethereum-node.service';

describe('EthereumNodeService', () => {
  let service: EthereumNodeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EthereumNodeService],
    }).compile();

    service = module.get<EthereumNodeService>(EthereumNodeService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
