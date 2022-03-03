import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DbConnectionService } from './services/db-connection/db-connection.service';
import { DatabaseRepo } from './services/db-repo/db.repo';
import { EthereumNodeService } from './services/ethereum/ethereum-node/ethereum-node.service';
import { EthereumTranasctionProcessManager } from './services/managers/ethereum-process-manager/ethereum-process-manager.service';
import { EthereumTxProcessorService } from './services/ethereum/ethereum-tx-processor/ethereum-tx-processor.service';
import { WebScrapingService } from './services/web-scraping/web-scraping.service';
import { EthereumWalletTrackingManager } from './services/managers/ethereum-wallet-tracking-manager/ethereum-wallet-tracking-manager.service';
import { EtherscanService } from './services/etherscan/etherscan.service';

@Module({
    imports: [],
    controllers: [AppController],
    providers: [
        AppService,
        EthereumNodeService,
        WebScrapingService,
        EthereumTranasctionProcessManager,
        EthereumWalletTrackingManager,
        EthereumTxProcessorService,
        EtherscanService,
        DbConnectionService,
        DatabaseRepo,
    ],
})
export class AppModule {}
