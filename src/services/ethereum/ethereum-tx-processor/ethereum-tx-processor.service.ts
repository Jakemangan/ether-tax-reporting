import { Injectable } from '@nestjs/common';
import { AnalysisResults } from 'src/models/AnalysisErrors';
import { TransactionAction } from 'src/models/DetailedTransactionInfo';
import { EthereumTxProcessResult } from 'src/models/ethereumTxProcessResult';
import { AnalysisResultMessages, AnalysisResultType } from 'src/models/ProcessTxErrors';
import { TokenService } from 'src/services/token/token.service';
import { EthereumNodeService } from '../ethereum-node/ethereum-node.service';
import { IBaseAnalyser } from '../tx-analysers/IBaseAnalyser';
import TxMultiSwapAnalyser from '../tx-analysers/TxMultiSwapAnalyser';
import TxPreAnalyser from '../tx-analysers/TxPreAnalyser';
import TxSingleSwapAnalyser from '../tx-analysers/TxSingleSwapAnalyser';
import TxTransferAnalyser from '../tx-analysers/TxTransferAnalyser';
import TxTransferApprovalAnalyser from '../tx-analysers/TxTransferApprovalAnalyser';

@Injectable()
export class EthereumTxProcessorService {
    debug: boolean = true;

    constructor(private ethNodeService: EthereumNodeService, private tokenService: TokenService) {}

    public async processTxHash(txHash: string, walletAddress: string, count: number): Promise<EthereumTxProcessResult> {
        let analysers = this.getAnalysers();
        let transactionActions: TransactionAction[] = [];
        let analysisResults: AnalysisResults = {};

        let isSuccess = false;
        let isProcessable = true;
        let overallResultType: AnalysisResultType | string;

        const txDetails = await this.ethNodeService.getTransactionDetails(txHash);
        const numLogEvents = txDetails.txReceipt.logs.length;

        let transferEvents = this.ethNodeService.getAllTransferLogEventsFromTxReceipt(txDetails.txReceipt);
        let swapEvents = this.ethNodeService.getAllSwapLogEventsFromTxReceipt(txDetails.txReceipt);

        console.log(`\nProcessing transaction (${count}) - ` + txHash);

        for (const analyser of analysers) {
            this.debugLog('[Processor] Trying to process using ' + analyser.name);
            let result = await analyser.run(
                transferEvents,
                swapEvents,
                txDetails.txReceipt.logs,
                walletAddress,
                txDetails,
            );
            analysisResults[analyser.name] = {
                analysisResultType: result.resultType,
                analysisMessage: this.getAnalysisMessage(result.resultType as string, result.message),
            };

            if (analyser.name === 'PRE_ANALYSIS' && result.success) {
                //TX passed pre-analyse checks, continue to the proper analysers
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
                    overallResultType = result.resultType;
                    this.debugLog('[Processor] Cannot continue with transaction.');
                    isProcessable = false;
                    break;
                }
                overallResultType = AnalysisResultType[AnalysisResultType.failure];
                continue;
            }
            transactionActions = result.transactionActions;
            isSuccess = true;
            overallResultType = AnalysisResultType[AnalysisResultType.success];
            if (!result.other) {
                this.debugLog(`[Processor] ${analyser.name} analysis was successful.`);
            } else {
                this.debugLog(`[Processor] ${analyser.name} analysis was successful with conditions:`);
                this.debugLog(`[Processor]     Able to find exact match: ` + result.other.foundExactValueMatch);
                this.debugLog(`[Processor]     Percentage range was used: ` + result.other.percentageRangeWasUsed);
                this.debugLog(`[Processor]     Percentage range value: ` + result.other.percentageRangeValue);
            }
            break;
        }

        let nearest5minTimestampRange = this.getNearest5minTimestampRange(txDetails.timestamp);

    

        return {
            success: isSuccess,
            isProcessable: isProcessable,
            analysisResults: analysisResults,
            overallResultType: overallResultType,
            transactionAnalysisDetails: {
                txHash: txHash,
                timestamp: txDetails.timestamp,
                numberOfLogEvents: numLogEvents,
                nearest5minTimestampRange: nearest5minTimestampRange,
                transactionActions: transactionActions,
            },
        };
    }

    getAnalysisMessage(type: string, errorMessage: string) {
        let message = AnalysisResultMessages[type];
        if (!message) {
            if (errorMessage) {
                return errorMessage;
            }
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
            let tokenOutDetails = action.tokenOutDetails;
            let tokenInDetails = action.tokenInDetails;

            outStr.push(
                `Swapped ${action.tokenOutAmount} ${tokenOutDetails.symbol} for ${action.tokenInAmount} ${tokenInDetails.symbol}`,
            );
        }

        return outStr;
    }

    /*
     *   PRIVATE METHODS
     */

    private getNearest5minTimestampRange(timestamp: number) {
        let upper = Math.ceil(timestamp / 300) * 300;
        let lower = Math.floor(timestamp / 300) * 300;
        let nearest = Math.round(timestamp / 300) * 300;
        return {
            upper: upper,
            base: timestamp,
            nearest: nearest,
            lower: lower,
        };
    }

    private getAnalysers(): IBaseAnalyser[] {
        let singleSwapAnalyser = new TxSingleSwapAnalyser(this.ethNodeService, this.tokenService);
        let transferAnalyser = new TxTransferAnalyser(this.ethNodeService, this.tokenService);
        let multiSwapAnalyser = new TxMultiSwapAnalyser(this.ethNodeService, this.tokenService);
        let preAnalyser = new TxPreAnalyser();
        let transferApprovalAnalyser = new TxTransferApprovalAnalyser(this.ethNodeService, this.tokenService);
        return [preAnalyser, transferApprovalAnalyser, multiSwapAnalyser, singleSwapAnalyser, transferAnalyser];
    }

    private debugLog(message: string) {
        if (this.debug) {
            console.log(message);
        }
    }
}
