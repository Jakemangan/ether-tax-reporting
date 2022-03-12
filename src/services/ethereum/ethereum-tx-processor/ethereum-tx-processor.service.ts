import { ConsoleLogger, Injectable } from '@nestjs/common';
import { last } from 'cheerio/lib/api/traversing';
import { reverse } from 'dns';
import { first } from 'rxjs';
import { AnalysisResults } from 'src/models/AnalysisErrors';
import { TransactionAction } from 'src/models/DetailedTransactionInfo';
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

        const txDetails = await this.ethNodeService.getTransactionDetails(txHash);
        const numLogEvents = txDetails.txReceipt.logs.length;

        //todo :: Move this logic into its own analyser
        if (numLogEvents > 20) {
            analysisResults['PRE_ANALYSIS'] = {
                analysisResultType: AnalysisResultType[AnalysisResultType.potentialMigrationOrAirdrop],
            };
            this.debugLog('[Processor] Pre-analysis failed with reason: Potentially migration or airdrop.');
            return this.returnNonProcessableResult(txDetails, numLogEvents, analysisResults);
        }

        let transferEvents = this.ethNodeService.getAllTransferLogEventsFromTxReceipt(txDetails.txReceipt);
        let swapEvents = this.ethNodeService.getAllSwapLogEventsFromTxReceipt(txDetails.txReceipt);

        let uniqueAddresesOfTransferEvents = [...new Set(transferEvents.map((x) => x.address))];
        //Migration scripts or airdrops will have all transfer events having the same address
        if (numLogEvents > 1 && uniqueAddresesOfTransferEvents.length === 1) {
            //TODO :: Add this
        }

        //Pre-processing here to determine whether the transaction can be processed

        // let detailedTransactionInfo: DetailedTransactionInfo;

        for (const analyser of analysers) {
            this.debugLog('[Processor] Trying to process using ' + analyser.name);
            let result = await analyser.run(transferEvents, swapEvents, walletAddress);
            analysisResults[analyser.name] = {
                analysisResultType: result.resultType,
                analysisMessage: this.getAnalysisMessage(result.resultType as string),
            };
            if (!result.success) {
                this.debugLog(
                    `[Processor] ${analyser.name} was not successful with reason: ${
                        analysisResults[analyser.name].analysisMessage
                    }`,
                );
                continue;
            }
            transactionAction = result.transactionInfo;
            isSuccess = true;
            this.debugLog(`[Processor] ${analyser.name} analysis was successful.`);
            break;
        }

        // try {
        //     if (!detailedTransactionInfo) {
        //         //Couldn't use swap, try transfers
        //         console.log("[Process] Couldn't process TX using swap event, using transfer events instead.");
        //         detailedTransactionInfo = await this.getTransactionInformationUsingTransferEvents(
        //             transferEvents,
        //             swapEvents,
        //         );
        //         console.log('[Process] Process using transfer was OK.');
        //     } else {
        //         console.log('[Process] Process using swap was OK.');
        //     }
        //     processResultType = ProcessResultTypeEnum.success;
        // } catch (error) {
        //     hasFailed = true;
        //     switch (error.message) {
        //         case ProcessTxResultTypes.simpleTransfer.toString():
        //             failureMessage =
        //                 'TX only has one transfer event, likely a simple transfer between wallets. Nothing to process.';
        //             console.log('[Result] ' + ProcessTxResultTypes[ProcessTxResultTypes.simpleTransfer]);
        //             processResultType = ProcessResultTypeEnum.oneTransferEvent;
        //             break;
        //         case ProcessTxResultTypes.moreThanOneWethEvent.toString():
        //             failureMessage = 'More than 1 WETH event - Unsure how to proceed.';
        //             processResultType = ProcessResultTypeEnum.moreThanOneWethEvent;
        //             console.log('[Result] ' + ProcessTxResultTypes[ProcessTxResultTypes.moreThanOneWethEvent]);
        //             break;
        //         case ProcessTxResultTypes.noWethEvents.toString():
        //             failureMessage = 'No WETH events, cannot proceed.';
        //             processResultType = ProcessResultTypeEnum.noWethEvents;
        //             console.log('[Result] ' + ProcessTxResultTypes[ProcessTxResultTypes.noWethEvents]);
        //             break;
        //         case ProcessTxResultTypes.allLogEventsDoNotHaveIdenticalContractAddress.toString():
        //             failureMessage = 'All log events do not have the same contract address after removing WETH events.';
        //             processResultType = ProcessResultTypeEnum.allLogEventsDoNotHaveIdenticalContractAddress;
        //             console.log(
        //                 '[Result] ' +
        //                     ProcessTxResultTypes[ProcessTxResultTypes.allLogEventsDoNotHaveIdenticalContractAddress],
        //             );
        //             break;
        //         case ProcessTxResultTypes.unableToFindContractAddressForToken.toString():
        //             failureMessage = 'Unable to find token details for contract address, cannot process tx - ' + txHash;
        //             processResultType = ProcessResultTypeEnum.unableToFindContractAddressForToken;
        //             console.log(
        //                 '[Result] ' + ProcessTxResultTypes[ProcessTxResultTypes.unableToFindContractAddressForToken],
        //             );
        //             break;
        //         case ProcessTxResultTypes.noSwapLogs.toString():
        //             failureMessage = 'No swap events are present in logs.';
        //             processResultType = ProcessResultTypeEnum.noSwapEvents;
        //             console.log('[Result] ' + ProcessTxResultTypes[ProcessTxResultTypes.noSwapLogs]);
        //             break;
        //         default:
        //             failureMessage = 'No handler for process result error - ' + error.message;
        //             processResultType = ProcessResultTypeEnum.failure;
        //     }
        // }

        return {
            success: isSuccess,
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
        return AnalysisResultMessages[type];
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
            let tokenOutDetails = action.tokenExitDetails;
            let tokenInDetails = action.tokenEntryDetails;

            outStr.push(
                `Swapped ${action.tokenExitAmount} ${tokenOutDetails.symbol} for ${action.tokenEntryAmount} ${tokenInDetails.symbol}`,
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

    private returnNonProcessableResult(
        txDetails: any,
        numberOfLogEvents: number,
        analysisErrors: AnalysisResults,
    ): EthereumTxProcessResult {
        return {
            success: false,
            analysisResults: analysisErrors,
            transactionAnalysisDetails: {
                txHash: txDetails.txReceipt.transactionHash,
                timestamp: txDetails.timestamp,
                numberOfLogEvents: numberOfLogEvents,
                nearest5minTimestamp: this.getNearest5minTimestamp(txDetails.timestamp),
                transactionActions: null,
            },
        };
    }

    private getAnalysers(): IBaseAnalyser[] {
        let singleSwapAnalyser = new TxSingleSwapAnalyser(this.ethNodeService, this.tokenService);
        let transferAnalyser = new TxTransferAnalyser(this.ethNodeService, this.tokenService);
        let multiSwapAnalyser = new TxMultiSwapAnalyser(this.ethNodeService, this.tokenService);
        // return [multiSwapAnalyser, singleSwapAnalyser, transferAnalyser];
        return [multiSwapAnalyser];
    }

    private debugLog(message: string) {
        if (this.debug) {
            console.log(message);
        }
    }
}
