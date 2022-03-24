import { TransactionAction } from 'src/models/DetailedTransactionInfo';
import { EventLog } from 'src/models/EventLog';
import { AnalysisResultMessages, AnalysisResultType } from 'src/models/ProcessTxErrors';
import { TxAnalyserResult } from 'src/models/TxAnalyserResult';
import { TokenService } from 'src/services/token/token.service';
import { EthereumNodeService } from '../ethereum-node/ethereum-node.service';
import { IBaseAnalyser } from './IBaseAnalyser';

// TODO :: Could probably combine this functionality into one swap analyser that does both single and multiple swaps
export default class TxSingleSwapAnalyser implements IBaseAnalyser {
    name: string = 'SINGLE_SWAP';

    constructor(private ethNodeService: EthereumNodeService, private tokenService: TokenService) {}

    //TODO :: Logic needs changed around to be able to determine exit from swap events with mismatch of data values
    async run(transferEvents: EventLog[], swapEvents: EventLog[]): Promise<TxAnalyserResult> {
        if (swapEvents.length > 1) {
            return {
                success: false,
                shouldContinue: true,
                resultType: AnalysisResultType[AnalysisResultType.moreThanOneSwapLog],
                transactionActions: null,
            };
        }
        if (swapEvents.length === 0) {
            return {
                success: false,
                shouldContinue: true,
                resultType: AnalysisResultType[AnalysisResultType.noSwapLogs],
                transactionActions: null,
            };
        }

        let swapEventData = swapEvents[0].data;
        swapEventData = swapEventData.replace('0x', '');
        let swapEventDataElements = [];
        //Split data string into 4 64 length hex strings
        for (var i = 0, charsLength = swapEventData.length; i < charsLength; i += 64) {
            swapEventDataElements.push(swapEventData.substring(i, i + 64));
        }

        let tokenOutAmountHex;
        let tokenInAmountHex;
        //Swap uses either amount0In and amount1Out OR amount1In and amount0Out
        let swapIndexesToUse = this.determineSwapDataElementsToUse(swapEventDataElements);
        if (!swapIndexesToUse) {
            return {
                success: false,
                shouldContinue: true,
                resultType: AnalysisResultType[AnalysisResultType.couldNotDetermineSwapIndexes],
                transactionActions: null,
            };
        }

        tokenOutAmountHex = swapEventDataElements[swapIndexesToUse.OutIndex];
        tokenInAmountHex = swapEventDataElements[swapIndexesToUse.InIndex];

        let tokenOutTransferEvent = transferEvents.find((x) => x.data.includes(tokenOutAmountHex));
        if (!tokenOutTransferEvent) {
            return {
                success: false,
                shouldContinue: true,
                resultType: AnalysisResultType[AnalysisResultType.couldNotDetermineTokenOutTransferEvent],
                transactionActions: null,
            };
        }
        let tokenOutContractAddress = tokenOutTransferEvent.address;
        let tokenOutDetails = await this.tokenService.getTokenDetails(tokenOutContractAddress);
        let tokenOutAmountDecimal = this.ethNodeService.formatUnits('0x' + tokenOutAmountHex, tokenOutDetails.decimals);

        let tokenInTransferEvent = transferEvents.find((x) => x.data.includes(tokenInAmountHex));
        if (!tokenInTransferEvent) {
            return {
                success: false,
                shouldContinue: true,
                resultType: AnalysisResultType[AnalysisResultType.couldNotDetermineTokenInTransferEvent],
                transactionActions: null,
            };
        }
        let tokenInContractAddress = tokenInTransferEvent.address;
        let tokenInDetails = await this.tokenService.getTokenDetails(tokenInContractAddress);
        let tokenInAmountDecimal = this.ethNodeService.formatUnits('0x' + tokenInAmountHex, tokenInDetails.decimals);

        //If the swap uses the inner data arguments then we need to reverse the output of the method so things make sense
        if (swapIndexesToUse.reverseTokenOutIn) {
            return {
                success: true,
                shouldContinue: false,
                resultType: AnalysisResultType[AnalysisResultType.success],
                transactionActions: [
                    {
                        tokenOutAmount: parseFloat(tokenOutAmountDecimal),
                        tokenOutDetails: tokenOutDetails,
                        tokenInAmount: parseFloat(tokenInAmountDecimal),
                        tokenInDetails: tokenInDetails,
                        destinationAddress: swapEvents[0].topics[2],
                    },
                ],
            };
        } else {
            return {
                success: true,
                shouldContinue: false,
                resultType: AnalysisResultType[AnalysisResultType.success],
                transactionActions: [
                    {
                        tokenInAmount: parseFloat(tokenOutAmountDecimal),
                        tokenInDetails: tokenOutDetails,
                        tokenOutAmount: parseFloat(tokenInAmountDecimal),
                        tokenOutDetails: tokenInDetails,
                        destinationAddress: swapEvents[0].topics[2],
                    },
                ],
            };
        }
    }

    private determineSwapDataElementsToUse(swapEventDataElements: string[]) {
        swapEventDataElements = swapEventDataElements.map((x) => x.replace(/0/g, ''));

        let countOfEmptyElements = swapEventDataElements.filter((x) => x !== '').length;

        if (countOfEmptyElements === 2) {
            //If there are 2 swap arguments, then we can determine which to use easily
            if (
                swapEventDataElements[0].replace(/0/g, '') === '' &&
                swapEventDataElements[3].replace(/0/g, '') === ''
            ) {
                return {
                    InIndex: 1,
                    OutIndex: 2,
                    reverseTokenOutIn: true,
                };
            } else {
                return {
                    InIndex: 3,
                    OutIndex: 0,
                    reverseTokenOutIn: false,
                };
            }
        } else {
            return null;
        }
    }
}
