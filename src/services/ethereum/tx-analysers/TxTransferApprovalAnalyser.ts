import { end } from 'cheerio/lib/api/traversing';
import { EventLog } from 'src/models/EventLog';
import { AnalysisResultType } from 'src/models/ProcessTxErrors';
import { TxAnalyserResult } from 'src/models/TxAnalyserResult';
import { TokenService } from 'src/services/token/token.service';
import { EthereumNodeService } from '../ethereum-node/ethereum-node.service';
import { IBaseAnalyser } from './IBaseAnalyser';

export default class TxTransferApprovalAnalyser implements IBaseAnalyser {
    private readonly NULL_ADDRESS: string = '0x0000000000000000000000000000000000000000000000000000000000000000';
    private readonly DEAD_ADDRESS: string = '0x000000000000000000000000000000000000000000000000000000000000dead';

    private readonly transferSignature = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
    private readonly swapSignature = '0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822';
    private readonly approvalSignature = '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925';

    private readonly fullWalletAddress = '0x0000000000000000000000007cbbba14c573fa52aadad44c7ae8085dc0764ebd';
    private readonly walletAddress = '0x7cbbba14c573fa52aadad44c7ae8085dc0764ebd';

    name: string = 'TRANSFER_APPROVAL';

    constructor(private ethNodeService: EthereumNodeService, private tokenService: TokenService) {}

    async run(transferEvents: EventLog[], swapEvents: EventLog[], allEvents: EventLog[]): Promise<TxAnalyserResult> {
        /*
         * Logic
         * Use the last transfer event to figure out whether or not the transaction was a BUY or SELL
         * 1. If the last transaction has WETH address, token is being SOLD for WETH
         * 2. If the last transaction has TOKEN address, token is being BOUGHT with WETH
         *
         * Start
         * 1. Take the first significant transfer event and use it to find the relevant approval
         * 2. Use the approval to find the relevant swap
         * 3. From the relevant swap, find the transfer event that has the wallet address as topic[1] or topic[2]
         * 4. The value from the transfer event should be the output amount of the tx
         *
         *  IMPORTANT - The approval log may provide a way to bridge between the transfer and swap events e.g. tx - https://bscscan.com/tx/0x0339bc242b92da65710990e4c5a251ee4382e74ded576d698e82c3a5019ea74d#eventlog
         */

        try {
            let foundExactValueMatch = true;
            let percentageRangeWasUsed = false;
            let percentageRangeValue = null;

            allEvents = allEvents.filter((x) => !x.topics.includes(this.NULL_ADDRESS));
            allEvents = allEvents.filter((x) => !x.topics.includes(this.DEAD_ADDRESS));

            transferEvents = this.getAllLogTypeFromArray(allEvents, this.transferSignature);
            swapEvents = this.getAllLogTypeFromArray(allEvents, this.swapSignature);
            let approvalEvents = this.getAllLogTypeFromArray(allEvents, this.approvalSignature);

            if (approvalEvents.length > 1) {
                throw new Error('More than one approval event, cannot run.');
            }

            let approvalEvent = approvalEvents[0];

            let transferToSwapMap = {};

            let potentialStartTransferEvents = transferEvents.filter((transferEvent) => {
                /*
                 * Does transfer event contain the wallet address?
                 */
                let inTransferAddress = this.ethNodeService.stripHexZeros(transferEvent.topics[1]);
                if (inTransferAddress.toLowerCase() !== this.walletAddress) {
                    return false;
                }

                /*
                 * Does the transfer event out address appear in any swaps?
                 */
                let outTransferAddress = this.ethNodeService.stripHexZeros(transferEvent.topics[2]);
                let matchingSwaps = this.getSwapEventsThatContainAddress(outTransferAddress, swapEvents);
                // let doesOutTransferTopicAppearInAnySwaps = !!swapEvents.find((swapEvent) => {
                //     return swapEvent.address.toLowerCase() === outTransferAddress.toLowerCase();
                // });
                if (matchingSwaps.length === 0) {
                    return false;
                }

                /*
                 * Does the matching swaps first address match an address in the approval?
                 */
                matchingSwaps = matchingSwaps.filter((swap) => {
                    let swapFirstAddress = swap.topics[1];
                    return swapFirstAddress.toLowerCase() === approvalEvent.topics[2].toLowerCase();
                });

                if (matchingSwaps.length === 1) {
                    transferToSwapMap[transferEvent.logIndex] = matchingSwaps[0].logIndex;
                    return true;
                }

                /*
                 * Do any of the matching swaps have an value in its data equal to the transfer event's data?
                 * i.e. does the swap and the transfer use the same value?
                 *
                 * Can't do it, values between transfer and swap are close but not identical changes
                 */
                // let swapsWithSameDataValue = matchingSwaps.filter((x) => {
                //     let swapDataAsArray = this.ethNodeService.splitSwapDataValueIntoArray(x.data);
                //     let transferEventData = transferEvent.data
                // });
            });

            if (potentialStartTransferEvents.length !== 1) {
                throw new Error('More than one/zero potential start event, cannot run.');
            }

            let startTransferEvent = potentialStartTransferEvents[0];

            let endSwap = this.traverseSwaps(transferToSwapMap[startTransferEvent.logIndex], swapEvents);

            let finalTransferEventPotentials = transferEvents.filter((transfer) => {
                let dataAsArray = this.ethNodeService.splitSwapDataValueIntoArray(endSwap.data);

                return transfer.data.toLowerCase() === dataAsArray[1].toLowerCase();
                // this.ethNodeService.stripHexZeros(x.topics[2]).toLowerCase() === endSwap.address.toLowerCase()
            });

            if (finalTransferEventPotentials.length > 1) {
                throw new Error('More than one potential final transfer event');
            }

            /*
             * If this block activates an exact match between swap and transfer values could not be found.
             * Instead a percentage range was used instead
             */
            if (finalTransferEventPotentials.length === 0) {
                foundExactValueMatch = false;
                percentageRangeWasUsed = true;
                percentageRangeValue = 10;

                finalTransferEventPotentials = transferEvents.filter((transfer) => {
                    let dataAsArray = this.ethNodeService.splitSwapDataValueIntoArray(endSwap.data);

                    let dataSwapOutAsValue = parseInt(this.ethNodeService.formatUnits(dataAsArray[1].toLowerCase(), 0));
                    let transferDataAsValue = parseInt(this.ethNodeService.formatUnits(transfer.data.toLowerCase(), 0));

                    let withinRange = this.numbersAreWithinPercentageOfEachOther(
                        dataSwapOutAsValue,
                        transferDataAsValue,
                        10,
                    );

                    return withinRange;
                });
            }

            let finalTransferEvent = finalTransferEventPotentials[0];

            let tokenOutAddress = startTransferEvent.address;
            let tokenOutDetails = await this.tokenService.getTokenDetails(tokenOutAddress);
            let tokenInAddress = finalTransferEvent.address;
            let tokenInDetails = await this.tokenService.getTokenDetails(tokenInAddress);

            let tokenOutAmountDecimals = this.ethNodeService.formatUnits(
                startTransferEvent.data,
                tokenOutDetails.decimals,
            );

            let tokenInAmountDecimals = this.ethNodeService.formatUnits(
                finalTransferEvent.data,
                tokenInDetails.decimals,
            );

            return {
                success: true,
                shouldContinue: false,
                resultType: AnalysisResultType[AnalysisResultType.success],
                transactionActions: [
                    {
                        tokenOutDetails: tokenOutDetails,
                        tokenInDetails: tokenInDetails,
                        tokenOutAmount: parseFloat(tokenOutAmountDecimals),
                        tokenInAmount: parseFloat(tokenInAmountDecimals),
                        destinationAddress: this.fullWalletAddress,
                    },
                ],
                other: {
                    foundExactValueMatch,
                    percentageRangeWasUsed,
                    percentageRangeValue,
                },
            };
        } catch (error) {
            return {
                success: false,
                shouldContinue: true,
                resultType: AnalysisResultType[AnalysisResultType.transferApprovalAnalyserFailure],
                transactionActions: null,
                message: error
            };
        }
    }

    getAllLogTypeFromArray(events: EventLog[], typeSignature: string) {
        return events.filter((x) => x.topics[0] === typeSignature);
    }

    getSwapEventsThatContainAddress(address: string, swapEvents: EventLog[]) {
        return swapEvents.filter((event) => {
            return event.address.toLowerCase() === address.toLowerCase();
        });
    }

    traverseSwaps(startingSwapIndex: number, swapEvents: EventLog[]) {
        let startSwapEvent = swapEvents.find((x) => x.logIndex === startingSwapIndex);

        let currentSwap = startSwapEvent;
        let endSwap = null;

        while (!endSwap) {
            let currentSwapOutAddress = currentSwap.topics[2];
            let linkingSwapEvent = swapEvents.find(
                (x) =>
                    x.address.toLowerCase() === this.ethNodeService.stripHexZeros(currentSwapOutAddress).toLowerCase(),
            );
            if (!linkingSwapEvent) {
                throw new Error('No link swap event found.');
            }

            let linkingSwapEventOutAddress = this.ethNodeService
                .stripHexZeros(linkingSwapEvent.topics[2])
                .toLowerCase();
            if (linkingSwapEventOutAddress === this.walletAddress.toLowerCase()) {
                endSwap = linkingSwapEvent;
            } else {
                currentSwap = linkingSwapEvent;
            }
        }

        return endSwap;
    }

    numbersAreWithinPercentageOfEachOther(a: number, b: number, percentage: number) {
        if (b > a) {
            let res = b * 0.9;
            return a >= res;
        }

        let res = a * 0.9;
        return b >= res;
    }
}
