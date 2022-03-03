import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { TransactionDescription } from 'ethers/lib/utils';
import { throwIfEmpty } from 'rxjs';
import { InfluencerTx } from 'src/models/influencerTx';
import { DatabaseRepo } from 'src/services/db-repo/db.repo';
import { EtherscanService } from 'src/services/etherscan/etherscan.service';
import * as uuid from 'uuid';

@Injectable()
export class EthereumWalletTrackingManager implements OnApplicationBootstrap {
    constructor(private etherscanService: EtherscanService, private dbRepo: DatabaseRepo) {}

    onApplicationBootstrap() {
        this.run();
    }

    public async run() {
        let walletAddress = '0x7cbbba14c573fa52aadad44c7ae8085dc0764ebd';
        this.storeInitialTransactionsForWallet(walletAddress);
    }

    private async storeInitialTransactionsForWallet(address: string) {
        let tranasctionsForWallet = await this.etherscanService.getTransactionsForAddress(address);
        // for (const tx of tranasctionsForWallet) {
        //     let influencerTx: InfluencerTx = {
        //         txHash: tx.hash,
        //         influencerId: uuid.v4(),
        //         timestamp: parseInt(tx.timeStamp),
        //     };
        //
        // }

        let transactionsForInfluencer = await this.dbRepo.getLast100TransactionsByInfluencerId(
            '31d24fff-9fb6-4190-b343-d737f5ac8854',
        );

        const newTxList = [];
        for (const tx of tranasctionsForWallet) {
            let influencerTx: InfluencerTx = {
                txHash: tx.hash,
                influencerId: uuid.v4(),
                timestamp: parseInt(tx.timeStamp),
            };
            if (this.checkIfTransactionIsNew(influencerTx, transactionsForInfluencer)) {
                newTxList.push(influencerTx);
            }
        }

        for (const tx of newTxList) {
            await this.dbRepo.insertInfluencerTransaction(tx);
        }
    }

    private async checkIfTransactionIsNew(influencerTx: InfluencerTx, last100Transactions: InfluencerTx[]) {
        let match = last100Transactions.find((x) => x.txHash === influencerTx.txHash);
        if (match) return false;
        let latestTx = last100Transactions[0];
        if (latestTx.timestamp < influencerTx.timestamp) {
            return true;
        } else {
            return false;
        }
    }
}
