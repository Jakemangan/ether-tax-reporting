import { ConsoleLogger, Injectable } from '@nestjs/common';
import { last } from 'cheerio/lib/api/traversing';
import { reverse } from 'dns';
import { first } from 'rxjs';
import { AnalysisResults } from 'src/models/AnalysisErrors';
import { TransactionAction } from 'src/models/DetailedTransactionInfo';
import { EthereumTransactionDetails } from 'src/models/EthereumTransactionDetails';
import { EthereumTxProcessResult, TransactionAnalysisDetails } from 'src/models/ethereumTxProcessResult';
import { AnalysisResultMessages, AnalysisResultType } from 'src/models/ProcessTxErrors';
import { RelevantTransferEvents } from 'src/models/relevantTransferEvents';
import { TokenDetails } from 'src/models/tokenDetails';
import { TxAnalyserResult } from 'src/models/TxAnalyserResult';
import { DatabaseRepo } from 'src/services/database/db-repo/db.repo';
import { TokenService } from 'src/services/token/token.service';
import { WebScrapingService } from 'src/services/web-scraping/web-scraping.service';
import { EthereumNodeService } from '../ethereum-node/ethereum-node.service';
import { IBaseAnalyser } from '../tx-analysers/IBaseAnalyser';
import TxMultiSwapAnalyser from '../tx-analysers/TxMultiSwapAnalyser';
import TxPreAnalyser from '../tx-analysers/TxPreAnalyser';
import TxSingleSwapAnalyser from '../tx-analysers/TxSingleSwapAnalyser';
import TxTransferAnalyser from '../tx-analysers/TxTransferAnalyser';
import tokenDetails from './tokenDetails';
import weth from './wethDetails';

@Injectable()
export class EthereumTxProcessorService {
    debug: boolean = true;

    constructor(private ethNodeService: EthereumNodeService, private tokenService: TokenService) {}

    public async processTxHash(txHash: string, walletAddress: string): Promise<EthereumTxProcessResult> {
        let analysers = this.getAnalysers();
        let transactionAction: TransactionAction[] = [];
        let analysisResults: AnalysisResults = {};

        let isSuccess = false;
        let unprocessable = false;

        const txDetails = await this.ethNodeService.getTransactionDetails(txHash);
        const numLogEvents = txDetails.txReceipt.logs.length;

        let transferEvents = this.ethNodeService.getAllTransferLogEventsFromTxReceipt(txDetails.txReceipt);
        let swapEvents = this.ethNodeService.getAllSwapLogEventsFromTxReceipt(txDetails.txReceipt);

        for (const analyser of analysers) {
            this.debugLog('[Processor] Trying to process using ' + analyser.name);
            let result = await analyser.run(transferEvents, swapEvents, walletAddress, txDetails);
            analysisResults[analyser.name] = {
                analysisResultType: result.resultType,
                analysisMessage: this.getAnalysisMessage(result.resultType as string),
            };

            //TX passed pre-analyse checks, continue to the proper analysers
            if (analyser.name === 'PRE_ANALYSIS' && result.success) {
                this.debugLog('[Processor] Pre-analyse was successful, running analysers.');
                continue;
            }

            if (!result.success) {
                this.debugLog(
                    `[Processor] ${analyser.name} was not successful with reason: ${
                        analysisResults[analyser.name].analysisMessage
                    }`,
                );
                if (!result.shouldContinue) {
                    this.debugLog('[Processor] Cannot continue with transaction.');
                    unprocessable = true;
                    break;
                }
                continue;
            }
            transactionAction = result.transactionInfo;
            isSuccess = true;
            this.debugLog(`[Processor] ${analyser.name} analysis was successful.`);
            break;
        }

        return {
            success: isSuccess,
            unprocessable: unprocessable,
            analysisResults: analysisResults,
            transactionAnalysisDetails: {
                txHash: txHash,
                timestamp: txDetails.timestamp,
                numberOfLogEvents: numLogEvents,
                nearest5minTimestamp: this.getNearest5minTimestamp(txDetails.timestamp),
                transactionActions: transactionAction,
            },
        };
    }

    getAnalysisMessage(type: string) {
        let message = AnalysisResultMessages[type];
        if (!message) {
            return 'No message set for result type.';
        }
        return message;
    }

    getPrintStringFromTransactionResult(input: EthereumTxProcessResult): string[] {
        let outStr = [];

        // if (
        //     input.analysisResults['PRE_ANALYSIS']?.analysisResultType === AnalysisResultType.potentialMigrationOrAirdrop
        // )
        //     return (outStr = 'Likely a migration/airdrop.');
        // if (input.analysisResults['PRE_ANALYSIS']?.analysisResultType === AnalysisResultType.simpleTransfer)
        //     return (outStr = 'Likely a simple transfer.');

        for (const action of input.transactionAnalysisDetails.transactionActions) {
            let tokenOutDetails = action.tokenEntryDetails;
            let tokenInDetails = action.tokenExitDetails;

            outStr.push(
                `Swapped ${action.tokenEntryAmount} ${tokenOutDetails.symbol} for ${action.tokenExitAmount} ${tokenInDetails.symbol}`,
            );
        }

        return outStr;
    }

    /*
     *   PRIVATE METHODS
     */

    private getNearest5minTimestamp(timestamp: number) {
        return Math.round(timestamp / 300) * 300;
    }

    private getAnalysers(): IBaseAnalyser[] {
        let singleSwapAnalyser = new TxSingleSwapAnalyser(this.ethNodeService, this.tokenService);
        let transferAnalyser = new TxTransferAnalyser(this.ethNodeService, this.tokenService);
        let multiSwapAnalyser = new TxMultiSwapAnalyser(this.ethNodeService, this.tokenService);
        let preAnalyser = new TxPreAnalyser();
        return [preAnalyser, multiSwapAnalyser, singleSwapAnalyser, transferAnalyser];
    }

    private debugLog(message: string) {
        if (this.debug) {
            console.log(message);
        }
    }
}
