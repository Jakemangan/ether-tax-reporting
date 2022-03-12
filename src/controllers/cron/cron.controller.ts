import { Controller, Get, Post } from '@nestjs/common';
import { EthereumWalletTrackingManager } from 'src/managers/ethereum-wallet-tracking-manager/ethereum-wallet-tracking.manager';

@Controller('cron')
export class CronController {
    constructor(private trackingManager: EthereumWalletTrackingManager) {}

    @Post('run')
    public async triggerCron() {
        this.trackingManager.run();
    }
}
