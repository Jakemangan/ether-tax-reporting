import { ConsoleLogger, Injectable } from '@nestjs/common';
import { last } from 'cheerio/lib/api/traversing';
import { reverse } from 'dns';
import { first } from 'rxjs';
import { DetailedTransactionInfo } from 'src/models/DetailedTransactionInfo';
import {
    EthereumTxProcessResult,
    EthereumTxProcessResultType as ProcessResultTypeEnum,
    ResultTransactionDetails,
} from 'src/models/ethereumTxProcessResult';
import { ProcessTxErrors } from 'src/models/ProcessTxErrors';
import { RelevantTransferEvents } from 'src/models/relevantTransferEvents';
import { TokenDetails } from 'src/models/tokenDetails';
import { DatabaseRepo } from 'src/services/database/db-repo/db.repo';
import { TokenService } from 'src/services/token/token.service';
import { WebScrapingService } from 'src/services/web-scraping/web-scraping.service';
import { EthereumNodeService } from '../ethereum-node/ethereum-node.service';
import tokenDetails from './tokenDetails';
import weth from './wethDetails';

@Injectable()
export class EthereumTxProcessorService {
    private readonly NULL_ADDRESS: string = '0x0000000000000000000000000000000000000000000000000000000000000000';

    constructor(private ethNodeService: EthereumNodeService, private tokenService: TokenService) {}

    public async processTxHash(txHash: string, walletAddress: string): Promise<EthereumTxProcessResult> {
        let hasFailed = false;
        let processResultType: ProcessResultTypeEnum = null;
        let failureMessage: string = '';

        const walletNonHex = this.getWalletNonHex(walletAddress);
        const txDetails = await this.ethNodeService.getTransactionDetails(txHash);
        const numLogEvents = txDetails.txReceipt.logs.length;

        if (numLogEvents > 20) {
            failureMessage = 'Tranasction has high number of log events - Likely a migration.';
            processResultType = ProcessResultTypeEnum.highNumberOfTransferEvents;
            return this.returnNonProcessableResult(txDetails, numLogEvents, ProcessResultTypeEnum.migration);
        }

        let transferEvents = this.ethNodeService.getAllTransferLogEventsFromTxReceipt(txDetails.txReceipt);
        let swapEvents = this.ethNodeService.getAllSwapLogEventsFromTxReceipt(txDetails.txReceipt);

        let uniqueAddresesOfTransferEvents = [...new Set(transferEvents.map((x) => x.address))];
        //Migration scripts or airdrops will have all transfer events having the same address
        if (numLogEvents > 1 && uniqueAddresesOfTransferEvents.length === 1) {
        }

        //Pre-processing here to determine whether the transaction can be processed

        let detailedTransactionInfo: DetailedTransactionInfo;
        try {
            console.log('[Process] Trying to process using swap event...');
            detailedTransactionInfo = await this.getTransactionInformationUsingSwapEvent(transferEvents, swapEvents);

            if (!detailedTransactionInfo) {
                //Couldn't use swap, try transfers
                console.log("[Process] Couldn't process TX using swap event, using transfer events instead.");
                detailedTransactionInfo = await this.getTransactionInformationUsingTransferEvents(
                    transferEvents,
                    swapEvents,
                );
                console.log('[Process] Process using transfer was OK.');
            } else {
                console.log('[Process] Process using swap was OK.');
            }
            processResultType = ProcessResultTypeEnum.success;
        } catch (error) {
            hasFailed = true;
            switch (error.message) {
                case ProcessTxErrors.oneTransferEvent.toString():
                    failureMessage =
                        'TX only has one transfer event, likely a simple transfer between wallets. Nothing to process.';
                    console.log('[Result] ' + ProcessTxErrors[ProcessTxErrors.oneTransferEvent]);
                    processResultType = ProcessResultTypeEnum.oneTransferEvent;
                    break;
                case ProcessTxErrors.moreThanOneWethEvent.toString():
                    failureMessage = 'More than 1 WETH event - Unsure how to proceed.';
                    processResultType = ProcessResultTypeEnum.moreThanOneWethEvent;
                    console.log('[Result] ' + ProcessTxErrors[ProcessTxErrors.moreThanOneWethEvent]);
                    break;
                case ProcessTxErrors.noWethEvents.toString():
                    failureMessage = 'No WETH events, cannot proceed.';
                    processResultType = ProcessResultTypeEnum.noWethEvents;
                    console.log('[Result] ' + ProcessTxErrors[ProcessTxErrors.noWethEvents]);
                    break;
                case ProcessTxErrors.allLogEventsDoNotHaveIdenticalContractAddress.toString():
                    failureMessage = 'All log events do not have the same contract address after removing WETH events.';
                    processResultType = ProcessResultTypeEnum.allLogEventsDoNotHaveIdenticalContractAddress;
                    console.log(
                        '[Result] ' + ProcessTxErrors[ProcessTxErrors.allLogEventsDoNotHaveIdenticalContractAddress],
                    );
                    break;
                case ProcessTxErrors.unableToFindContractAddressForToken.toString():
                    failureMessage = 'Unable to find token details for contract address, cannot process tx - ' + txHash;
                    processResultType = ProcessResultTypeEnum.unableToFindContractAddressForToken;
                    console.log('[Result] ' + ProcessTxErrors[ProcessTxErrors.unableToFindContractAddressForToken]);
                    break;
                case ProcessTxErrors.noSwapEvents.toString():
                    failureMessage = 'No swap events are present in logs.';
                    processResultType = ProcessResultTypeEnum.noSwapEvents;
                    console.log('[Result] ' + ProcessTxErrors[ProcessTxErrors.noSwapEvents]);
                    break;
                default:
                    failureMessage = 'No handler for process result error - ' + error.message;
                    processResultType = ProcessResultTypeEnum.failure;
            }
        }

        return {
            success: hasFailed === true ? false : true,
            failureMessage: failureMessage,
            resultType: ProcessResultTypeEnum[processResultType],
            resultTransactionDetails: {
                txHash: txHash,
                timestamp: txDetails.timestamp,
                numberOfLogEvents: numLogEvents,
                nearest5minTimestamp: this.getNearest5minTimestamp(txDetails.timestamp),
                transactionInfo: detailedTransactionInfo,
            },
        };
    }

    private getNearest5minTimestamp(timestamp: number) {
        return Math.round(timestamp / 300) * 300;
    }

    private getWalletNonHex(walletAddress) {
        return walletAddress.replace(/0x/g, ''); //Remove the 0x from an address
    }

    private printDetails(input: any[]) {
        input.forEach((x) => console.log(JSON.stringify(x), '\n'));
    }

    private async getTransactionInformationUsingSwapEvent(
        transferEvents: any[],
        swapEvents: any[],
    ): Promise<DetailedTransactionInfo> {
        if (swapEvents.length > 1) {
            console.log('More than one swap log. Using transfer instead.');
            return null;
        }
        if (swapEvents.length === 0) {
            return null;
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
            console.log('[Process] Could not determine swap indexes');
            return null;
        }
        tokenOutAmountHex = swapEventDataElements[swapIndexesToUse.OutIndex];
        tokenInAmountHex = swapEventDataElements[swapIndexesToUse.InIndex];

        let tokenOutTransferEvent = transferEvents.find((x) => x.data.includes(tokenOutAmountHex));
        if (!tokenOutTransferEvent) {
            console.log('[Process] Could not determine token out transfer event');
            return null;
        }
        let tokenOutContractAddress = tokenOutTransferEvent.address;
        let tokenOutDetails = await this.tokenService.getTokenDetails(tokenOutContractAddress);
        let tokenOutAmountDecimal = this.ethNodeService.formatUnits('0x' + tokenOutAmountHex, tokenOutDetails.decimals);

        let tokenInTransferEvent = transferEvents.find((x) => x.data.includes(tokenInAmountHex));
        if (!tokenInTransferEvent) {
            console.log('[Process] Could not determine token in transfer event');
            return null;
        }
        let tokenInContractAddress = tokenInTransferEvent.address;
        let tokenInDetails = await this.tokenService.getTokenDetails(tokenInContractAddress);
        let tokenInAmountDecimal = this.ethNodeService.formatUnits('0x' + tokenInAmountHex, tokenInDetails.decimals);

        //If the swap uses the inner data arguments then we need to reverse the output of the method so things make sense
        if (swapIndexesToUse.reverseTokenOutIn) {
            return {
                tokenInAmount: parseFloat(tokenOutAmountDecimal),
                tokenInDetails: tokenOutDetails,
                tokenOutAmount: parseFloat(tokenInAmountDecimal),
                tokenOutDetails: tokenInDetails,
            };
        } else {
            return {
                tokenOutAmount: parseFloat(tokenOutAmountDecimal),
                tokenOutDetails: tokenOutDetails,
                tokenInAmount: parseFloat(tokenInAmountDecimal),
                tokenInDetails: tokenInDetails,
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
            // let amount0In = swapEventDataElements[0];
            // let amount1In = swapEventDataElements[1];
            // let amount0Out = swapEventDataElements[2];
            // let amount1Out = swapEventDataElements[3];

            // if(amount0In !== '' && amount0Out != ''){
            //     let transferForAmount0In = transferEvents.find(x => x.data === "0x" + amount0In);
            //     let transferForAmount0Out = transferEvents.find(x => x.data === "0x" + amount0Out);

            //     if(transferForAmount0In && !transferForAmount0Out){
            //         return [0, 1];
            //     }
            // } else {
            //     let transferForAmount1In = transferEvents.find(x => x.data === "0x" + amount1In);
            //     let transferForAmount1Out = transferEvents.find(x => x.data === "0x" + amount1Out);

            //     if(transferForAmount1In && !transferForAmount1Out){
            //         return [2, 3];
            //     }
            // }
        }
    }

    // private async getTransactionInformationUsingTransferEvents(
    //     transferEvents: any[],
    //     swapEvents: any[],
    // ): Promise<DetailedTransactionInfo> {
    //     /*
    //      * Logic v2
    //      * Use the last transfer event to figure out whether or not the transaction was a BUY or SELL
    //      * 1. If the last transaction has WETH address, token is being SOLD for WETH
    //      * 2. If the last transaction has TOKEN address, token is being BOUGHT with WETH
    //      *
    //      * If 1. - filter out all WETH events, compare the remaining events and use the event with the highest data value, this is the amount of TOKEN sold for ETH
    //      *           - Last event is amount of WETH recieved for token
    //      *           - Highest data value of TOKEN address events, amount of TOKEN sold for WETH
    //      * If 2. - find the WETH event in the other transfer events, this is the amount of WETH sold
    //      *           - Last event is amount of TOKEN bought
    //      *           - WETH event in logs is amount of WETH sold for TOKEn
    //      *
    //      */

    //     if (transferEvents.length === 1) {
    //         //TODO :: Return properly here instead of throwing error. Determine contract address before returning.
    //         throw new Error(ProcessTxErrors.oneTransferEvent.toString());
    //     }

    //     transferEvents = transferEvents.filter((x) => !x.topics.includes(this.NULL_ADDRESS)); //Remove any events concerned with the NULL (burn) address, as these are irrelevant

    //     let uniqueAddressesFromTransfers = [...new Set(transferEvents.map((x) => x.address))];
    //     if (uniqueAddressesFromTransfers.length > 2) {
    //         throw Error('More than 2 unique addresses in transfers');
    //     } else if (transferEvents.length === 1) {
    //         throw Error(ProcessTxErrors.oneTransferEvent.toString());
    //     }

    //     //Used to determine out and in tokens
    //     let firstInstancesOfUniqueAddressUsage: any[] = [];
    //     for (let uniqueAddress of uniqueAddressesFromTransfers) {
    //         for (let event of transferEvents) {
    //             if (event.address === uniqueAddress) {
    //                 firstInstancesOfUniqueAddressUsage.push({
    //                     address: uniqueAddress,
    //                     logIndex: event.logIndex,
    //                 });
    //                 break;
    //             }
    //         }
    //     }

    //     firstInstancesOfUniqueAddressUsage.sort((a, b) => a.logIndex - b.logIndex);

    //     let tokenOutContractAddress = firstInstancesOfUniqueAddressUsage[0].address;
    //     let tokenInContractAddress = firstInstancesOfUniqueAddressUsage[1].address;

    //     let tokenOutDetails = await this.getTokenDetails(tokenOutContractAddress);
    //     let tokenInDetails = await this.getTokenDetails(tokenInContractAddress);

    //     let outContractAddressTransferEvents = transferEvents.filter((x) => x.address === tokenOutContractAddress);
    //     outContractAddressTransferEvents.sort((a, b) => {
    //         let aDataAsDecimal = parseFloat(this.ethNodeService.formatUnits(a.data, tokenOutDetails.decimals));
    //         let bDataAsDecimal = parseFloat(this.ethNodeService.formatUnits(b.data, tokenOutDetails.decimals));
    //         return bDataAsDecimal - aDataAsDecimal;
    //     });
    //     let tokenOutAmountInDecimals = this.ethNodeService.formatUnits(
    //         outContractAddressTransferEvents[0].data,
    //         tokenOutDetails.decimals,
    //     );

    //     let inContractAddressTransferEvents = transferEvents.filter((x) => x.address === tokenInContractAddress);
    //     inContractAddressTransferEvents.sort((a, b) => {
    //         let aDataAsDecimal = parseFloat(this.ethNodeService.formatUnits(a.data, tokenInDetails.decimals));
    //         let bDataAsDecimal = parseFloat(this.ethNodeService.formatUnits(b.data, tokenInDetails.decimals));
    //         return bDataAsDecimal - aDataAsDecimal;
    //     });
    //     let tokenInAmountInDecimals = this.ethNodeService.formatUnits(
    //         inContractAddressTransferEvents[0].data,
    //         tokenInDetails.decimals,
    //     );

    //     return {
    //         tokenOutAmount: parseFloat(tokenOutAmountInDecimals),
    //         tokenOutDetails: tokenOutDetails,
    //         tokenInAmount: parseFloat(tokenInAmountInDecimals),
    //         tokenInDetails: tokenInDetails,
    //     };

    //     // return {
    //     //     tokenEvent: tokenIn,
    //     //     wethEvent: tokenOut,
    //     //     type: type,
    //     // };
    // }

    private returnNonProcessableResult(
        txDetails: any,
        numberOfLogEvents: number,
        resultType: ProcessResultTypeEnum,
    ): EthereumTxProcessResult {
        return {
            success: false,
            resultType: ProcessResultTypeEnum[resultType],
            failureMessage: 'Non-processable tranasction',
            resultTransactionDetails: {
                txHash: txDetails.txReceipt.transactionHash,
                timestamp: txDetails.timestamp,
                numberOfLogEvents: numberOfLogEvents,
                nearest5minTimestamp: this.getNearest5minTimestamp(txDetails.timestamp),
                transactionInfo: null,
            },
        };
    }

    getPrintStringFromTransactionResult(input: EthereumTxProcessResult) {
        let outStr;
        if (
            input.resultType === ProcessResultTypeEnum.simpleTransfer ||
            input.resultType === ProcessResultTypeEnum.migration
        ) {
            console.log('Simple transfer/migration.');
            return;
        }

        let tokenOutDetails = input.resultTransactionDetails.transactionInfo.tokenOutDetails;
        let tokenInDetails = input.resultTransactionDetails.transactionInfo.tokenInDetails;

        outStr = `Swapped ${input.resultTransactionDetails.transactionInfo.tokenOutAmount} ${tokenOutDetails.symbol} for ${input.resultTransactionDetails.transactionInfo.tokenInAmount} ${tokenInDetails.symbol}`;

        // let typeString;
        // switch (input.type) {
        //     case 1:
        //         typeString = 'BUY';
        //     case 2:
        //         typeString = 'SELL';
        // }

        // if (input.type === 1) {
        //     outStr = `${typeString} - Bought ${input.tokenAmountDecimal} ${input.tokenName} for ${input.wethAmountDecimal} WETH.`;
        // } else {
        //     outStr = `${typeString} - Sold ${input.tokenAmountDecimal} ${input.tokenName} for ${input.wethAmountDecimal} WETH.`;
        // }
        return outStr;
    }
}

// let lastEvent = transferEvents[transferEvents.length - 1];
// if (lastEvent.address === weth.contractAddress) {

//     let tokenTransferEvents = transferEvents.filter((x) => x.address !== weth.contractAddress); //Remove WETH events, as we are only concerned with TOKEN events

//     let uniqueEventContractAddresses = [...new Set(tokenTransferEvents.map((x) => x.address))]; //Non duplicate set of all addresses should have exactly one element

//     if (uniqueEventContractAddresses.length !== 1)
//         throw new Error(ProcessTxErrors.AllLogEventsDoNotHaveIdenticalContractAddress.toString());

//     let tokenDetails = await this.getTokenDetails(uniqueEventContractAddresses[0]); //Get token details for contract address
//     if (!tokenDetails) {
//         console.error('Unable to find token details for contract address -' + uniqueEventContractAddresses[0]);
//         throw new Error(ProcessTxErrors.UnableToFindContractAddressForToken.toString());
//     }

//     tokenTransferEvents.sort((a, b) => {
//         let aDataAsDecimal = parseFloat(this.ethNodeService.formatUnits(a.data, tokenDetails.decimals));
//         let bDataAsDecimal = parseFloat(this.ethNodeService.formatUnits(b.data, tokenDetails.decimals));
//         return aDataAsDecimal - bDataAsDecimal;
//     });

//     let eventWithHighestDataValue = tokenTransferEvents[tokenTransferEvents.length - 1];

//     tokenIn = eventWithHighestDataValue;
//     tokenOut = lastEvent; //Last event is WETH event
//     type = 2; //SELL
// } else {
//     //TOKEN bought with WETH - TOKEN received by wallet
//     tokenIn = lastEvent; //Last event is TOKEN event
//     let tokenDetails = await this.getTokenDetails(lastEvent.address);

//     let allWethEvents = transferEvents.filter((x) => x.address === weth.contractAddress); //Should only be one WETH event in the logs
//     if (allWethEvents.length === 0) throw new Error(ProcessTxErrors.NoWethEvents.toString());
//     if (allWethEvents.length > 1) {
//         // throw new Error(ProcessTxErrors.MoreThanOneWethEvent.toString()) //Old logic
//         allWethEvents.sort((a, b) => {
//             let aDataAsDecimal = parseFloat(this.ethNodeService.formatUnits(a.data, tokenDetails.decimals));
//             let bDataAsDecimal = parseFloat(this.ethNodeService.formatUnits(b.data, tokenDetails.decimals));
//             return aDataAsDecimal - bDataAsDecimal;
//         });

//         let wethEventWithHighestDataValue = allWethEvents[allWethEvents.length - 1];
//         tokenOut = wethEventWithHighestDataValue;
//     } else {
//         tokenOut = allWethEvents[0];
//     }

//     type = 1; //BUY;
// }
