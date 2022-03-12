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
                resultType: AnalysisResultType[AnalysisResultType.moreThanOneSwapLog],
                transactionInfo: null,
            };
        }
        if (swapEvents.length === 0) {
            return {
                success: false,
                resultType: AnalysisResultType[AnalysisResultType.noSwapLogs],
                transactionInfo: null,
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
                resultType: AnalysisResultType[AnalysisResultType.couldNotDetermineSwapIndexes],
                transactionInfo: null,
            };
        }

        tokenOutAmountHex = swapEventDataElements[swapIndexesToUse.OutIndex];
        tokenInAmountHex = swapEventDataElements[swapIndexesToUse.InIndex];

        let tokenOutTransferEvent = transferEvents.find((x) => x.data.includes(tokenOutAmountHex));
        if (!tokenOutTransferEvent) {
            return {
                success: false,
                resultType: AnalysisResultType[AnalysisResultType.couldNotDetermineTokenOutTransferEvent],
                transactionInfo: null,
            };
        }
        let tokenOutContractAddress = tokenOutTransferEvent.address;
        let tokenOutDetails = await this.tokenService.getTokenDetails(tokenOutContractAddress);
        let tokenOutAmountDecimal = this.ethNodeService.formatUnits('0x' + tokenOutAmountHex, tokenOutDetails.decimals);

        let tokenInTransferEvent = transferEvents.find((x) => x.data.includes(tokenInAmountHex));
        if (!tokenInTransferEvent) {
            return {
                success: false,
                resultType: AnalysisResultType[AnalysisResultType.couldNotDetermineTokenInTransferEvent],
                transactionInfo: null,
            };
        }
        let tokenInContractAddress = tokenInTransferEvent.address;
        let tokenInDetails = await this.tokenService.getTokenDetails(tokenInContractAddress);
        let tokenInAmountDecimal = this.ethNodeService.formatUnits('0x' + tokenInAmountHex, tokenInDetails.decimals);

        //If the swap uses the inner data arguments then we need to reverse the output of the method so things make sense
        if (swapIndexesToUse.reverseTokenOutIn) {
            return {
                success: true,
                resultType: AnalysisResultType[AnalysisResultType.success],
                transactionInfo: [
                    {
                        tokenEntryAmount: parseFloat(tokenOutAmountDecimal),
                        tokenEntryDetails: tokenOutDetails,
                        tokenExitAmount: parseFloat(tokenInAmountDecimal),
                        tokenExitDetails: tokenInDetails,
                        destinationAddress: swapEvents[0].address,
                    },
                ],
            };
        } else {
            return {
                success: true,
                resultType: AnalysisResultType[AnalysisResultType.success],
                transactionInfo: [
                    {
                        tokenExitAmount: parseFloat(tokenOutAmountDecimal),
                        tokenExitDetails: tokenOutDetails,
                        tokenEntryAmount: parseFloat(tokenInAmountDecimal),
                        tokenEntryDetails: tokenInDetails,
                        destinationAddress: swapEvents[0].address,
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
