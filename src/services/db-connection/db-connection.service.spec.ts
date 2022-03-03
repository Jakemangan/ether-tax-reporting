import { Test, TestingModule } from '@nestjs/testing';
import { DbConnectionService } from './db-connection.service';

describe('DbConnectionService', () => {
  let service: DbConnectionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DbConnectionService],
    }).compile();

    service = module.get<DbConnectionService>(DbConnectionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
