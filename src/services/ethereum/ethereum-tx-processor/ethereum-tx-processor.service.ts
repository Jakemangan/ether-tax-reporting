import { ConsoleLogger, Injectable } from '@nestjs/common';
import { last } from 'cheerio/lib/api/traversing';
import { EthereumTxProcessResult, EthereumTxProcessResultType } from 'src/models/ethereumTxProcessResult';
import { ProcessTxErrors } from 'src/models/ProcessTxErrors';
import { RelevantTransferEvents } from 'src/models/relevantTransferEvents';
import { EthereumNodeService } from '../ethereum-node/ethereum-node.service';
import tokenDetails from './tokenDetails';
import weth from './wethDetails';

@Injectable()
export class EthereumTxProcessorService {
    constructor(private ethNodeService: EthereumNodeService) {}

    public async processTxHash(txHash, walletAddress): Promise<EthereumTxProcessResult> {
        const walletNonHex = this.getWalletNonHex(walletAddress);
        const txDetails = await this.ethNodeService.getTransactionDetails(txHash);
        const numLogEvents = txDetails.txReceipt.logs.length;

        if (numLogEvents > 20) {
            throw new Error('TX has a high number of log events, likely a migration transaction or similar. Skipping.');
        }

        let transferEvents = this.ethNodeService.getAllTransferLogEventsFromTxReceipt(txDetails.txReceipt);

        let swapEvents = this.ethNodeService.getAllSwapLogEventsFromTxReceipt(txDetails.txReceipt);

        // this.printDetails([txDetails.txReceipt]);
        let relevantEvents: RelevantTransferEvents;
        try {
            relevantEvents = this.getRelevantTransferLogs(transferEvents, swapEvents, walletNonHex);
        } catch (error) {
            switch (error.message) {
                case ProcessTxErrors.OneTransferEvent.toString():
                    console.log(
                        'TX only has one transfer event, likely a simple transfer between wallets. Nothing to process.',
                    );
                    return {
                        txHash: txHash,
                        timestamp: txDetails.timestamp,
                        numberOfLogEvents: numLogEvents,
                        nearest5minTimestamp: this.getNearest5minTimestamp(txDetails.timestamp),
                        tokenAmountDecimal: 0,
                        wethAmountDecimal: 0,
                        tokenName: 'N/A',
                        type: 'N/A',
                        processResult: EthereumTxProcessResultType.simpleTransfer,
                    };
                case ProcessTxErrors.MoreThanOneWethEvent.toString():
                    throw new Error('More than 1 WETH event - Unsure how to proceed.');
                case ProcessTxErrors.NoWethEvents.toString():
                    throw new Error('No WETH events, cannot proceed.');
                case ProcessTxErrors.AllLogEventsDoNotHaveIdenticalContractAddress.toString():
                    throw new Error('All log events do not have the same contract address after removing WETH events.');
                case ProcessTxErrors.UnableToFindContractAddressForToken.toString():
                    throw new Error('Unable to find token details for contract address, cannot process tx - ' + txHash);
                default:
                    throw new Error('No handler for error - ' + error.message);
            }
        }

        let tokenContractAddress = relevantEvents.tokenEvent.address;
        let tokenUsedDetails = this.getTokenDetails(tokenContractAddress);

        if (!tokenUsedDetails) {
            console.error('Unable to find token details for contract address -' + tokenContractAddress);
            throw new Error(
                'Unable to find token details for contract address (' +
                    tokenContractAddress +
                    '), cannot process tx - ' +
                    txHash,
            );
        }

        let amountOfTokensInEvent = relevantEvents.tokenEvent.data;
        let amountOfWEthInEvent = relevantEvents.wethEvent.data;

        let tokenAmountDecimal = this.ethNodeService.formatUnits(amountOfTokensInEvent, tokenUsedDetails.decimals);
        let wethAmountDecimal = this.ethNodeService.formatUnits(amountOfWEthInEvent, weth.decimals);

        return {
            txHash: txHash,
            timestamp: txDetails.timestamp,
            numberOfLogEvents: numLogEvents,
            nearest5minTimestamp: this.getNearest5minTimestamp(txDetails.timestamp),
            tokenAmountDecimal: parseFloat(tokenAmountDecimal),
            wethAmountDecimal: parseFloat(wethAmountDecimal),
            tokenName: tokenUsedDetails.name,
            type: relevantEvents.type,
            processResult: EthereumTxProcessResultType.successful,
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

    private getRelevantTransferLogs(
        transferEvents: any[],
        swapEvents: any[],
        walletNonHex: string,
    ): RelevantTransferEvents {
        /*
        If there's more than 2 transfer events, get the last two as these are the ones we care about
        */
        // transferEvents = transferEvents.slice(
        //     transferEvents.length - 2,
        //     transferEvents.length,
        // );
        // let type =
        //     transferEvents[0].address === weth.contractAddress ? 'BUY' : 'SELL';

        /*
         * Logic v2
         * Use the last transfer event to figure out whether or not the transaction was a BUY or SELL
         * 1. If the last transaction has WETH address, token is being SOLD for WETH
         * 2. If the last transaction has TOKEN address, token is being BOUGHT with WETH
         *
         * If 1. - filter out all WETH events, compare the remaining events and use the event with the highest data value, this is the amount of TOKEN sold for ETH
         *           - Last event is amount of WETH recieved for token
         *           - Highest data value of TOKEN address events, amount of TOKEN sold for WETH
         * If 2. - find the WETH event in the other transfer events, this is the amount of WETH sold
         *           - Last event is amount of TOKEN bought
         *           - WETH event in logs is amount of WETH sold for TOKEn
         *
         */

        let wethEvent;
        let tokenEvent;
        let type;

        if (transferEvents.length === 1) {
            throw new Error(ProcessTxErrors.OneTransferEvent.toString());
        }

        let lastEvent = transferEvents[transferEvents.length - 1];
        if (lastEvent.address === weth.contractAddress) {
            //TOKEN sold for WETH - WETH recieved by wallet
            let tokenTransferEvents = transferEvents.filter((x) => x.address !== weth.contractAddress); //Remove WETH events, as we are only concerned with TOKEN events

            let uniqueEventContractAddresses = [...new Set(tokenTransferEvents.map((x) => x.address))]; //Non duplicate set of all addresses should have exactly one element

            if (uniqueEventContractAddresses.length !== 1)
                throw new Error(ProcessTxErrors.AllLogEventsDoNotHaveIdenticalContractAddress.toString());

            let tokenDetails = this.getTokenDetails(uniqueEventContractAddresses[0]); //Get token details for contract address
            if (!tokenDetails) {
                console.error('Unable to find token details for contract address -' + uniqueEventContractAddresses[0]);
                throw new Error(ProcessTxErrors.UnableToFindContractAddressForToken.toString());
            }

            tokenTransferEvents.sort((a, b) => {
                let aDataAsDecimal = parseFloat(this.ethNodeService.formatUnits(a.data, tokenDetails.decimals));
                let bDataAsDecimal = parseFloat(this.ethNodeService.formatUnits(b.data, tokenDetails.decimals));
                return aDataAsDecimal - bDataAsDecimal;
            });

            let eventWithHighestDataValue = tokenTransferEvents[tokenTransferEvents.length - 1];

            tokenEvent = eventWithHighestDataValue;
            wethEvent = lastEvent; //Last event is WETH event
            type = 'SELL';
        } else {
            //TOKEN bought with WETH - TOKEN received by wallet
            let allWethEvents = transferEvents.filter((x) => x.address === weth.contractAddress); //Should only be one WETH event in the logs
            if (allWethEvents.length > 1) throw new Error(ProcessTxErrors.MoreThanOneWethEvent.toString());
            if (allWethEvents.length === 0) throw new Error(ProcessTxErrors.NoWethEvents.toString());

            wethEvent = allWethEvents[0];
            tokenEvent = lastEvent; //Last event is TOKEN event
            type = 'BUY';
        }

        return {
            tokenEvent: tokenEvent,
            wethEvent: wethEvent,
            type: type,
        };

        // if (type === 'BUY') {
        //     wethEvent = transferEvents[0];
        //     tokenEvent = transferEvents[1];

        //     if (!tokenEvent.topics[1].includes(walletNonHex)) {
        //         // console.log("BUY transaction token log topic #2 is not equal to wallet address - May be a simple swap, checking swap event..");
        //         if (swapEvents.length > 1) {
        //             throw Error('More than one swap event, not sure what to do. Exiting.');
        //         }
        //         if (swapEvents[0].topics[2].includes(walletNonHex)) {
        //             // console.log("Wallet address is present in swap event.")
        //         } else {
        //             throw Error('Could not find waller address in swap event');
        //         }
        //     }
        // } else {
        //     //SELL
        //     tokenEvent = transferEvents[0];
        //     wethEvent = transferEvents[1];

        //     if (!tokenEvent.topics[1].includes(walletNonHex)) {
        //         // console.log("SELL transaction token log topic #2 is not equal to wallet address - May be a simple swap, checking swap event..");
        //         if (swapEvents.length > 1) {
        //             throw Error('More than one swap event, not sure what to do. Exiting.');
        //         }
        //         if (swapEvents[0].topics[1].includes(walletNonHex)) {
        //             // console.log("Wallet address is present in swap event.")
        //         } else {
        //             throw Error('Could not find wallet address in swap event');
        //         }
        //     }
        // }
    }

    getTokenDetails(contractAddress: string) {
        return tokenDetails.find((token) => token.address.toUpperCase() === contractAddress.toUpperCase());
    }
}
