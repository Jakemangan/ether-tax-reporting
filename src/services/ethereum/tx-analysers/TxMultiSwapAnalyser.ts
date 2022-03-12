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

        if (this.swapEvents.length < 2) {
            return {
                success: false,
                resultType: AnalysisResultType[AnalysisResultType.tooFewSwapEventsForMultiSwapAnalyser],
                transactionInfo: null,
            };
        }

        let analyserResults: TransactionAction[] = [];
        for (const swapEvent of this.swapEvents) {
            let res = await this.traverseSwaps(swapEvent, this.swapEvents, transferEvents, [swapEvent]);
            analyserResults.push(res);
        }

        //If any of the actions contain a destination address that does not match the user's wallet address then
        //remove the action from the results array.
        for (const action of analyserResults) {
            if (!action.destinationAddress.includes(this.nonHex(this.walletAddress))) {
                analyserResults.slice(analyserResults.indexOf(action), analyserResults.indexOf(action) + 1);
            }
        }

        return {
            success: true,
            resultType: AnalysisResultType[AnalysisResultType.success],
            transactionInfo: analyserResults,
        };
    }

    // TODO :: Currently intermediate swaps are being added to the results array, this is inefficient as we're wasting
    // processing power on swaps we don't care about. A better solution here would be to work recusively backwards starting
    // with every exit swap that includes the user's wallet. If the swap doesn't contain the user's wallet as a topic, don't bother
    // processing it until we need it as a chain link for a swap we care about. Day 2
    private async traverseSwaps(
        rootSwap: EventLog,
        swapEvents: EventLog[],
        transferEvents: EventLog[],
        swapChain: EventLog[],
    ): Promise<TransactionAction> {
        if (!rootSwap.topics[2].includes(this.nonHex(this.walletAddress))) {
            return;
        }

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

        console.log('Reached end of traversal');
        //Reverse swap chain
        let temp = [];
        let swapChainLength = swapChain.length;
        for (let i = 0; i < swapChainLength; i++) {
            temp.push(swapChain.pop());
        }
        swapChain = [].concat(temp);

        // if (lastSwapInChain.topics[2].includes(this.nonHex(this.walletAddress))) {
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
            );
            let intermediateSwapTokenOutAmountDecimal = this.getDecimalTokenAmountFromHex(
                intermediateSwapData.outAmount,
                intermediateSwapTokenOutDetails,
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
        // } else {
        //     throw new Error(
        //         'The last address in the swapChain does not match provided wallet. Not sure what the fuck to dooooo',
        //     );
        // }
    }

    private async getTokenDetailsUsingSwapDataValue(
        amountToFind: string,
        transferEvents: EventLog[],
    ): Promise<TokenDetails> {
        let tokenTransferLog = transferEvents.find((x) => this.nonHex(x.data) === amountToFind);
        return await this.tokenService.getTokenDetails(tokenTransferLog.address);
    }

    private getDecimalTokenAmountFromHex(hexAmount: string, tokenDetails: TokenDetails) {
        return this.ethNodeService.formatUnits('0x' + hexAmount, tokenDetails.decimals);
    }

    private markAsIntermediateIfRequired(swapEvent: EventLog) {
        if (!swapEvent.topics[2].includes(this.nonHex(this.walletAddress))) {
            this.swapEvents.find((x) => x.logIndex === swapEvent.logIndex).intermediateEvent = true;
        }
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
            if (element !== '') {
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
