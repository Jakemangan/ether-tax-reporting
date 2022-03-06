import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { WebSocketServer } from '@nestjs/websockets';
import { TransactionDescription } from 'ethers/lib/utils';
import { throwIfEmpty } from 'rxjs';
import { AppGateway } from 'src/app.gateway';
import { EthereumTxProcessResult } from 'src/models/ethereumTxProcessResult';
import { EtherscanTransaction } from 'src/models/etherscanTransaction';
import { InfluencerTx } from 'src/models/influencerTx';
import { RemoveDuplicates } from 'src/other/util';
import { DatabaseRepo } from 'src/services/database/db-repo/db.repo';
import { EthereumTxProcessorService } from 'src/services/ethereum/ethereum-tx-processor/ethereum-tx-processor.service';
import { EtherscanService } from 'src/services/etherscan/etherscan.service';
import { WebScrapingService } from 'src/services/web-scraping/web-scraping.service';
import * as uuid from 'uuid';

@Injectable()
export class EthereumWalletTrackingManager implements OnApplicationBootstrap {
    @WebSocketServer() server;

    constructor(
        private etherscanService: EtherscanService,
        private webScrapingService: WebScrapingService,
        private ethTxProcessor: EthereumTxProcessorService,
        private dbRepo: DatabaseRepo,
        private gateway: AppGateway,
    ) {}

    onApplicationBootstrap() {
        this.run();
    }

    public async run() {
        let walletAddress = '0x7cbbba14c573fa52aadad44c7ae8085dc0764ebd';
        this.processWalletAddress(walletAddress);
    }

    private async processWalletAddress(walletAddress: string) {
        let hasHistoricTransactions = await this.checkIfAddressHasHistoricTransactions(walletAddress);
        if (!hasHistoricTransactions) {
            console.log('No historic transactions available for ' + walletAddress);
            await this.storeLatestTransaction(walletAddress);
            //Return early as we now have the wallet's latest transaction stored and need to wait for a new tx to process
            return;
        }

        let transactionsForWallet = await this.etherscanService.getTransactionsForAddress(walletAddress, true);
        transactionsForWallet = transactionsForWallet.sort((a, b) => parseInt(b.timeStamp) - parseInt(a.timeStamp));

        let latestStoredTransaction = await this.dbRepo.getLatestStoredInfluencerTransaction(walletAddress);
        let unseenTransactions = this.removeSeenTransactions(transactionsForWallet, latestStoredTransaction.timestamp);

        unseenTransactions = RemoveDuplicates(unseenTransactions, 'hash');

        let processTxResults: EthereumTxProcessResult[] = [];
        if (!unseenTransactions.length) {
            console.log('No new transactions to process.');
            return;
        }
        for (const tx of unseenTransactions) {
            try {
                console.log('Processing tx - ' + tx.hash);
                let res = await this.ethTxProcessor.processTxHash(tx.hash, walletAddress);
                processTxResults.push(res);
            } catch (error) {
                console.log('Could not process tx - ' + error.message);
            }
        }

        let printStrings = processTxResults.map((x) => this.ethTxProcessor.getPrintStringFromTransactionResult(x));
        this.gateway.server.emit('outStrings', printStrings);

        for (const res of processTxResults) {
            await this.dbRepo.insertTxReport(res, walletAddress);
            // await this.dbRepo.insertInfluencerTransaction({
            //     timestamp: res.timestamp,
            //     txHash: res.txHash,
            //     txToAddress: res.tokenContractAddress,
            //     walletAddress: walletAddress,
            // });
        }
    }

    private async checkIfAddressHasHistoricTransactions(walletAddress: string) {
        let latestInfluencerTx = await this.dbRepo.getLatestStoredInfluencerTransaction(walletAddress);
        if (latestInfluencerTx) {
            return true;
        } else {
            return false;
        }
    }

    private async storeLatestTransaction(walletAddress: string) {
        let transactionsForWallet = await this.etherscanService.getTransactionsForAddress(walletAddress, false);
        transactionsForWallet = transactionsForWallet.sort((a, b) => parseInt(b.timeStamp) - parseInt(a.timeStamp));

        let lastTransaction = transactionsForWallet[0];

        await this.dbRepo.insertEmptyReport({
            timestamp: parseInt(lastTransaction.timeStamp),
            txHash: lastTransaction.hash,
            txToAddress: '',
            walletAddress: walletAddress,
        });
    }

    private removeSeenTransactions(influencerTxs: EtherscanTransaction[], latestTransactionTimestamp: number) {
        return influencerTxs.filter((x) => parseInt(x.timeStamp) > latestTransactionTimestamp);
    }
}
