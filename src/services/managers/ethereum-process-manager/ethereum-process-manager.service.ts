import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { take } from 'rxjs';
import {
    EthereumTxProcessError as EthereumTxProcessErrorResult,
    EthereumTxProcessResult,
    EthereumTxProcessResultType,
} from 'src/models/ethereumTxProcessResult';
import { DatabaseRepo } from 'src/services/db-repo/db.repo';
import { WebScrapingService } from 'src/services/web-scraping/web-scraping.service';
import { EthereumNodeService } from '../../ethereum/ethereum-node/ethereum-node.service';
import { EthereumTxProcessorService } from '../../ethereum/ethereum-tx-processor/ethereum-tx-processor.service';

@Injectable()
export class EthereumTranasctionProcessManager implements OnApplicationBootstrap {
    private readonly walletAddress = '0x7cbbba14c573fa52aadad44c7ae8085dc0764ebd';

    constructor(
        ethNodeService: EthereumNodeService,
        private webScrapingService: WebScrapingService,
        private ethTxProcessor: EthereumTxProcessorService,
        private dbRepo: DatabaseRepo,
    ) {
        ethNodeService.onReadySubject.pipe(take(1)).subscribe(() => {
            console.log('Ethereum manager ready.');
        });
    }

    onApplicationBootstrap() {
        // this.run(this.walletAddress);
    }

    private initManager() {}

    private async run(walletAddress: string) {
        console.log('Count: ', await this.dbRepo.getCount());

        console.log('Starting run.');
        let txHashesForWallet = await this.webScrapingService.getAllWalletTxHashesSync(); //Temp sync method to prevent need for scraping

        let processResults: EthereumTxProcessResult[] = [];
        let erroredResults: EthereumTxProcessErrorResult[] = [];

        // let promises: Promise<EthereumTxProcessResult>[] = [];
        // for(const txHash of txHashesForWallet){
        //     promises.push(new Promise((resolve) => this.ethTxProcessor.processTxHash(txHash, walletAddress)));
        // }

        // await Promise.allSettled(promises).then(res => processResults.push(res))

        for (const txHash of txHashesForWallet) {
            try {
                console.log('Processing transaction - ' + txHash);
                let res = await this.ethTxProcessor.processTxHash(txHash, walletAddress);
                processResults.push(res);
            } catch (error) {
                console.log('Failed.');
                erroredResults.push({
                    txHash,
                    errorReason: error.message,
                });
            }
        }

        console.log(processResults);
        console.log(processResults.map((x) => x.numberOfLogEvents));
        // console.log(erroredResults);
        // console.log(JSON.stringify(erroredResults));

        processResults.forEach((res) => {
            let outStr;
            if (res.processResult === EthereumTxProcessResultType.simpleTransfer) {
                console.log('Simple transfer.');
                return;
            }
            if (res.type === 'BUY') {
                outStr = `${res.type} - Bought ${res.tokenAmountDecimal} ${res.tokenName} for ${res.wethAmountDecimal} WETH.`;
            } else {
                outStr = `${res.type} - Sold ${res.tokenAmountDecimal} ${res.tokenName} for ${res.wethAmountDecimal} WETH.`;
            }
            // console.log(outStr);
            console.log(outStr);
        });

        console.log('Finished.');
    }
}
