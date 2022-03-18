import { TransactionAction, IntermediateSwap } from 'src/models/DetailedTransactionInfo';
import { EventLog } from 'src/models/EventLog';
import { AnalysisResultType } from 'src/models/ProcessTxErrors';
import { SwapDataElements } from 'src/models/SwapDataElements';
import { TokenDetails } from 'src/models/tokenDetails';
import { TxAnalyserResult } from 'src/models/TxAnalyserResult';
import { TokenService } from 'src/services/token/token.service';
import { EthereumNodeService } from '../ethereum-node/ethereum-node.service';
import tokenDetails from '../ethereum-tx-processor/tokenDetails';
import { IBaseAnalyser } from './IBaseAnalyser';

export default class TxMultiSwapAnalyser implements IBaseAnalyser {
    name: string = 'MULTI_SWAP';
    private walletAddress: string;
    private swapEvents: EventLog[] = [];

    constructor(private ethNodeService: EthereumNodeService, private tokenService: TokenService) {}

    async run(transferEvents: EventLog[], swapEvents: EventLog[], walletAddress: string): Promise<TxAnalyserResult> {
        this.walletAddress = walletAddress;
        this.swapEvents = swapEvents;

        if (this.swapEvents.length < 1) {
            return {
                success: false,
                shouldContinue: true,
                resultType: AnalysisResultType[AnalysisResultType.tooFewSwapEventsForMultiSwapAnalyser],
                transactionInfo: null,
            };
        }

        //TODO :: Improve this with proper error returns
        try {
            let analyserResults: TransactionAction[] = [];
            for (const swapEvent of this.swapEvents) {
                let res = await this.traverseSwaps(swapEvent, this.swapEvents, transferEvents, [swapEvent]);
                if (res) {
                    analyserResults.push(res);
                }
            }

            return {
                success: true,
                shouldContinue: false,
                resultType: AnalysisResultType[AnalysisResultType.success],
                transactionInfo: analyserResults,
            };
        } catch (error) {
            return {
                success: false,
                shouldContinue: true,
                resultType: AnalysisResultType[AnalysisResultType.multiSwapAnalyserFailure],
                transactionInfo: null,
            };
        }
    }

    private async traverseSwaps(
        rootSwap: EventLog,
        swapEvents: EventLog[],
        transferEvents: EventLog[],
        swapChain: EventLog[],
    ): Promise<TransactionAction> {
        let rootSwapData = this.getSwapDataElements(rootSwap);

        for (const leafSwap of swapEvents) {
            let leafSwapData = this.getSwapDataElements(leafSwap);

            if (rootSwapData.inAmount === leafSwapData.outAmount) {
                //We don't want to return any actions that includes swaps that don't involve the user's wallet.
                // this.markAsIntermediateIfRequired(rootSwap);
                swapChain.push(leafSwap);
                await this.traverseSwaps(leafSwap, swapEvents, transferEvents, swapChain);
            } else {
                continue;
            }
        }

        //Reverse swapChain as we recurse backwards to build the connections between swaps
        let temp = [];
        let swapChainLength = swapChain.length;
        for (let i = 0; i < swapChainLength; i++) {
            temp.push(swapChain.pop());
        }
        swapChain = [].concat(temp);

        //Exit point is provided wallet, build the swap chain details and return
        let intermediateSwaps: IntermediateSwap[] = [];
        for (let i = 0; i < swapChain.length; i++) {
            let intSwap = swapChain[i];
            let intermediateSwapData = this.getSwapDataElements(intSwap);

            //Token details
            let intermediateSwapTokenInDetails = await this.getTokenDetailsUsingSwapDataValue(
                intermediateSwapData.inAmount,
                transferEvents,
            );
            let intermediateSwapTokenOutDetails = await this.getTokenDetailsUsingSwapDataValue(
                intermediateSwapData.outAmount,
                transferEvents,
            );

            //Token amounts
            let intermediateSwapTokenInAmountDecimal = this.getDecimalTokenAmountFromHex(
                intermediateSwapData.inAmount,
                intermediateSwapTokenInDetails,
                transferEvents,
            );
            let intermediateSwapTokenOutAmountDecimal = this.getDecimalTokenAmountFromHex(
                intermediateSwapData.outAmount,
                intermediateSwapTokenOutDetails,
                transferEvents,
            );

            intermediateSwaps.push({
                index: i,
                logIndex: intSwap.logIndex,
                destinationAddress: intSwap.topics[2],
                tokenInAmount: parseFloat(intermediateSwapTokenInAmountDecimal),
                tokenInDetails: intermediateSwapTokenInDetails,
                tokenOutAmount: parseFloat(intermediateSwapTokenOutAmountDecimal),
                tokenOutDetails: intermediateSwapTokenOutDetails,
            });
        }

        /*
         * Since we include all of the swaps into the intermediateSwap array, the entry and exit token information should be
         * present regardless if there was a single swap or 100. It's the first swap's IN that represents the ENTRY token and the
         * last swap's OUT that repersents the EXIT token.
         */

        //Not sure this is needed
        // let firstSwap = intermediateSwaps[0];
        // tokenInDetails = await this.getTokenDetailsUsingSwapDataValue(firstSwap.tokenInAmount, transferEvents);
        // tokenInAmountDecimal = this.getDecimalTokenAmountFromHex(firstSwap.inAmount, tokenInDetails);

        // let lastSwap = intermediateSwaps[intermediateSwaps.length - 1];
        // tokenOutAmountDecimal = lastSwap.tokenOutAmount; //Token out amount here is already a float, so no need to parse
        // tokenOutDetails = lastSwap.tokenOutDetails;

        // //If there are any intermediate swaps, use them to determine the token out details
        // if (intermediateSwaps.length) {
        //     let firstSwap = intermediateSwaps[0];
        //     let tokenInDetails = await this.getTokenDetailsUsingSwapDataValue(firstSwap., transferEvents);
        //     let tokenInAmountDecimal = this.getDecimalTokenAmountFromHex(firstSwap.inAmount, tokenInDetails);
        //     //At this point, the last swap detail object in the IntermediateSwaps array is the exit swap so we can use that.
        //     let lastSwap = intermediateSwaps[intermediateSwaps.length - 1];
        //     tokenOutAmountDecimal = lastSwap.tokenOutAmount; //Token out amount here is already a float, so no need to parse
        //     tokenOutDetails = lastSwap.tokenOutDetails;
        // } else {
        //     //Else, use the details in the rootSwap
        //     tokenOutDetails = await this.getTokenDetailsUsingSwapDataValue(rootSwapData.outAmount, transferEvents);
        //     tokenOutAmountDecimal = this.getDecimalTokenAmountFromHex(rootSwapData.outAmount, tokenOutDetails);
        // }

        let firstSwap = intermediateSwaps[0];
        let lastSwap = intermediateSwaps[intermediateSwaps.length - 1];

        return {
            tokenEntryAmount: firstSwap.tokenInAmount,
            tokenEntryDetails: firstSwap.tokenInDetails,
            tokenExitAmount: lastSwap.tokenOutAmount,
            tokenExitDetails: lastSwap.tokenOutDetails,
            destinationAddress: lastSwap.destinationAddress,
            intermediateSwaps: intermediateSwaps,
        };
    }

    //TODO :: If the proper transfer log needs to deduced by adding values then the actual value
    //        returned to the user will be different to what returned currently. The EXIT amount
    //        should be adjusted to this actual amount returned.
    private async getTokenDetailsUsingSwapDataValue(
        amountToFind: string,
        transferEvents: EventLog[],
    ): Promise<TokenDetails> {
        let tokenTransferLog = transferEvents.find((x) => this.nonHex(x.data) === amountToFind);
        if (!tokenTransferLog) {
            //Simple match of data for transfer-swap has failed, value may have been split into tax by contract.
            tokenTransferLog = this.deduceActualTransferLog(amountToFind, transferEvents);
            if (!tokenTransferLog) {
                throw new Error('Could not deduce correct transfer log');
            }
        }
        return await this.tokenService.getTokenDetails(tokenTransferLog.address);
    }

    private deduceActualTransferLog(amountToFindHex: string, transferEvents: EventLog[]): EventLog {
        let actualTransferLog = this.deduceActualTransferLogThroughSum(amountToFindHex, transferEvents);
        if (actualTransferLog) {
            return actualTransferLog;
        }
        return null;
        // actualTransferLog = this.deduceActualTransferLogThroughTaxThreshold(amountToFindHex, transferEvents);
        // if (actualTransferLog) {
        //     return actualTransferLog;
        // }
    }

    private deduceActualTransferLogThroughSum(amountToFindHex: string, transferEvents: EventLog[]): EventLog {
        for (let event of transferEvents) {
            for (let event2 of transferEvents) {
                let decimal1 = parseInt(event.data);
                let decimal2 = parseInt(event2.data);
                let total = decimal1 + decimal2;
                let totalAsHex = total.toString(16).padStart(64, '0');
                if (totalAsHex === amountToFindHex) {
                    //Found combination of transfer event values that equal the swap output
                    //Use the greater of the two (the one that hasn't been siphoned for tax, as the proper value)
                    if (decimal1 > decimal2) {
                        return event;
                    } else {
                        return event2;
                    }
                }
            }
        }
    }

    /*
     *   Attempt to deduce the correct transfer log by finding a transfer log that has a data value within a certain
     *   tax threshold.
     */
    // private async deduceActualTransferLogThroughTaxThreshold(
    //     amountToFindHex: string,
    //     transferEvents: EventLog[],
    // ): Promise<EventLog> {
    //     let taxThresholds = [10, 20, 30];
    //     if (!amountToFindHex.startsWith('0x')) {
    //         amountToFindHex = '0x' + amountToFindHex;
    //     }
    //     let amountToFindDecimal = parseInt(amountToFindHex);

    //     for (let threshold of taxThresholds) {
    //         let percentageOf = 100 - threshold;
    //         let amountToFindReduced = (amountToFindDecimal / 100) * percentageOf;
    //         for (let event of transferEvents) {
    //             let tokenDetails = await this.tokenService.getTokenDetails(event.address);
    //             if (!tokenDetails) {
    //                 continue;
    //             }
    //             let eventAmountDecimal = this.ethNodeService.formatUnits(event.data, tokenDetails.decimals);

    //             if (eventAmountDecimal >= amountToFindReduced) {
    //                 return event;
    //             }
    //         }
    //     }
    // }

    /*
     *   For the returned amount to be valid it needs to be present in a transfer log highlighting the return of the
     *   swapped amount to the user's wallet. If a transfer log with the specified amount isn't present then the total
     *   amount may have split up for contract tax. In which case we need to find the proper amount.
     */
    private getDecimalTokenAmountFromHex(hexAmount: string, tokenDetails: TokenDetails, transferEvents: EventLog[]) {
        let matchTransferEvent = transferEvents.find((x) => this.nonHex(x.data) === hexAmount);
        if (!matchTransferEvent) {
            //The value provided doesn't match any transfer logs, so we need to find the proper log for the amount
            //and replace the provided value with the amount in the actual transfer log
            matchTransferEvent = this.deduceActualTransferLogThroughSum(hexAmount, transferEvents);
            hexAmount = matchTransferEvent.data;
        }

        return this.ethNodeService.formatUnits(hexAmount, tokenDetails.decimals);
    }

    /*
     *   First element in list is always IN amount, second element is always OUT amount
     *
     *   To do this, we take the big hex data string and split it into its 4 parts, 2 of these parts
     *   should be hex 0, so they are removed. The other two which contain useful data are returned.
     *
     *   The 4 individual hex strings are 64 characters long, ignoring the '0x' at the start of the string.
     */
    private getSwapDataElements(swap: EventLog): SwapDataElements {
        let swapData = swap.data;
        swapData = swapData.replace('0x', '');
        let swapEventDataElements = [];
        for (var i = 0, charsLength = swapData.length; i < charsLength; i += 64) {
            let element = swapData.substring(i, i + 64);
            element = element.replace(/0/g, '');
            if (element !== '' && element !== '1') {
                swapEventDataElements.push(swapData.substring(i, i + 64));
            }
        }
        if (swapEventDataElements.length > 2) {
            throw new Error('3 swap data elements');
        }
        return {
            inAmount: swapEventDataElements[0],
            outAmount: swapEventDataElements[1],
        };
    }

    private nonHex(hexString: string) {
        return hexString.replace('0x', '');
    }
}
