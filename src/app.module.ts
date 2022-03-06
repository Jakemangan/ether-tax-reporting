import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DbConnectionService } from './services/database/db-connection/db-connection.service';
import { DatabaseRepo } from './services/database/db-repo/db.repo';
import { EthereumNodeService } from './services/ethereum/ethereum-node/ethereum-node.service';
import { EthereumTxProcessorService } from './services/ethereum/ethereum-tx-processor/ethereum-tx-processor.service';
import { WebScrapingService } from './services/web-scraping/web-scraping.service';
import { EtherscanService } from './services/etherscan/etherscan.service';
import { EthereumTranasctionProcessManager } from './managers/ethereum-process-manager/ethereum-wallet-reporting.manager';
import { EthereumWalletTrackingManager } from './managers/ethereum-wallet-tracking-manager/ethereum-wallet-tracking.manager';
import { AppGateway } from './app.gateway';

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
        AppGateway,
    ],
})
export class AppModule {}
