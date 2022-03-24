import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { take } from 'rxjs';
import { EthereumTxProcessResult } from 'src/models/ethereumTxProcessResult';
import { DatabaseRepo } from 'src/services/database/db-repo/db.repo';
import { EthereumNodeService } from 'src/services/ethereum/ethereum-node/ethereum-node.service';
import { EthereumTxProcessorService } from 'src/services/ethereum/ethereum-tx-processor/ethereum-tx-processor.service';
import { EtherscanService } from 'src/services/etherscan/etherscan.service';
import { WebScrapingService } from 'src/services/web-scraping/web-scraping.service';

@Injectable()
export class EthereumTranasctionProcessManager implements OnApplicationBootstrap {
    private readonly walletAddress = '0x7cbbba14c573fa52aadad44c7ae8085dc0764ebd';
    // private readonly walletAddress = '0xc556aa79252afb2acb6701b7fb9bccf82777ae66';

    constructor(
        ethNodeService: EthereumNodeService,
        private webScrapingService: WebScrapingService,
        private ethTxProcessor: EthereumTxProcessorService,
        private etherscanService: EtherscanService,
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
        console.log('Starting run.');
        // let txHashesForWallet = await this.webScrapingService.getAllWalletTxHashesSync(); //Temp sync method to prevent need for scraping
        let txsForWallet = await this.etherscanService.getTransactionsForAddress(walletAddress, true);

        let processResults: EthereumTxProcessResult[] = [];

        //More than one swap log
        // 0xe79d1540cd4fbe22d6ee522b2f42ea421183d9e4eab40bdb50ff2008772f7793
        // 0xf33a84f0d72f88903fcd350b661eab1f710a0f8b26494ca23d03ec779ea41433
        // 0x8e7a3b14d8338574b1fa766312d2170e454b111ff282f9c1a2b1aefab32540b3
        // 0xc6e948515f779394ca29d166b3d56b8c1b0666387c92c172db9bd4c02bab2296
        // 0x0d38515b42bc0ced6988b3805b82b8b33d8e13853b1991a9de6b08d993e013a7
        // 0x0d38515b42bc0ced6988b3805b82b8b33d8e13853b1991a9de6b08d993e013a7

        //Weird - 0x24cf38b4dc45b0c006b7fe467e029ea48ff1a14cc4f753209967a2970f00aaaf

        console.log('Total TXs: ' + txsForWallet.length);
        // txsForWallet = txsForWallet.slice(0, 10);
        txsForWallet = [
            txsForWallet.find((x) => x.hash === '0xc6e948515f779394ca29d166b3d56b8c1b0666387c92c172db9bd4c02bab2296'),
        ];

        /*
         *  ETH theory
         *  - Swaps are preceeded and succeeded by transfers as all tokens to be swapped must be transferred to a token pair
         *    before they are swapped and then the output is transferred to wherever it needs to go.
         *  - For WETH -> TOKEN swaps:
         *        1. WETH is transferred from ROUTER to token pair
         *        2. TOKEN is transferred from pair to user wallet
         *  - For TOKEN -> WETH swaps:
         *        1. TOKEN is transferred from user wallet to pair
         *        2. WETH is transferred from pair to ROUTER
         *
         *
         *  For swaps, it's likely that only the token0 amount will be different from the actual swap amount due to tax etc
         *  The output amount will go to the wallet directly and will be untaxed, so the transfer out event should be easily linked
         *  to the swap. The transfer in amount will likely need to be deduced using an increasing tax threshholdw
         *
         *  Build out a connection object of transfer-swap-transfer to better highlight the entire lifetime of the tx
         */

        /*
         * For multiple swaps
         * - Take each swap, traverse the swaps recursively to find the point where no more swaps exist and take the final token amount
         * - Check the end result (final token amount) to check if there is a transfer to the wallet in question, if so parse the details
         * - Multiple unrelated swaps may exist, analyser needs to return more than one analysis result
         *
         *  If a swap's topics contain the wallet address then the swap is known to transfer the result into the wallet and does not need to be processed further
         *  If a swap's topics do not contain the wallet address, then the swap may lead into a second (or third, etc) swap that will then terminate in the
         *  specified wallet
         *  e.g. of this - 0x389e437cb30f8de3c6dac78ccc01b9ce0e4bdf76eec91c1008602a685c338fff
         *
         * - If there is no transfer event that corresponds to the output of a swap, the final amount may have been split up into two smaller
         *   amounts as part of the contract's tax system
         *   e.g. of this - 0x79c8e65310685b56e44de7858fa4cba2c2e49db6b9097f558728a1c4db179830
         *   For these, find any data values that are smaller than the output amount and try to find the combination of data values that adds up to them.
         *   If a combination is found, one of those values will be the output amoutn
         *       - This might be easier by taking the ouptut amount and minusing one of the data values to see if the other data value corresponds, if it does
         *         search for the specified wallet and return using the details of that transfer
         */

        for (const tx of txsForWallet) {
            console.log('\nProcessing transaction - ' + tx.hash);
            let res = await this.ethTxProcessor.processTxHash(tx.hash, walletAddress);
            processResults.push(res);
        }

        // for (const tx of txsForWallet) {
        //     try {
        //         console.log('\nProcessing transaction - ' + tx.hash);
        //         let res = await this.ethTxProcessor.processTxHash(tx.hash, walletAddress);
        //         processResults.push(res);
        //     } catch (error) {
        //         console.log('Failed - ' + error.message);
        //         erroredResults.push({
        //             txHash: tx.hash,
        //             errorReason: error.message,
        //         });
        //     }
        // }

        let allSuccesses = processResults.filter((x) => x.success);
        let allFailures = processResults.filter((x) => !x.success);
        let properFailures = processResults.filter((x) => !x.success && !x.unprocessable);
        let numFailures = allFailures.length;
        let numSuccesses = allSuccesses.length;

        let successesWithMoreThanOneAction = processResults.filter(
            (x) => x.transactionAnalysisDetails.transactionActions.length > 1,
        );
        let successesOneAction = processResults.filter(
            (x) => x.transactionAnalysisDetails.transactionActions.length === 1,
        );

        console.log('\n');
        for (let x of allSuccesses) {
            let outStrs = this.ethTxProcessor.getPrintStringFromTransactionResult(x);
            outStrs.forEach((x) => console.log(x));
        }

        // let properFailures = allFailures.filter((x) => {
        //     return x.analysisResults !== 'migration' && x.analysisResults !== 'oneTransferEvent';
        // });

        console.log('\nFinished.');
        // console.log(properFailures.map((x) => x.analysisResults));
    }
}
