import { Test, TestingModule } from '@nestjs/testing';
import { WaitinglistController } from './waitinglist.controller';

describe('WaitinglistController', () => {
  let controller: WaitinglistController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WaitinglistController],
    }).compile();

    controller = module.get<WaitinglistController>(WaitinglistController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
