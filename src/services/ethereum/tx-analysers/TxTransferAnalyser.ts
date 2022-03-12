import { DetailedTransactionInfo } from 'src/models/DetailedTransactionInfo';
import { EthereumTxProcessResult } from 'src/models/ethereumTxProcessResult';
import { EventLog } from 'src/models/EventLog';
import { ProcessTxErrors } from 'src/models/ProcessTxErrors';
import { EthereumNodeService } from '../ethereum-node/ethereum-node.service';
import { IBaseAnalyser } from './IBaseAnalyser';

export default class TxTransferAnalyser implements IBaseAnalyser {
    private readonly NULL_ADDRESS: string = '0x0000000000000000000000000000000000000000000000000000000000000000';

    constructor(
        private ethNodeService: EthereumNodeService
    ){}

    async run(transferEvents: EventLog[], swapEvents: EventLog[]): Promise<DetailedTransactionInfo> {
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

        if (transferEvents.length === 1) {
            //TODO :: Return properly here instead of throwing error. Determine contract address before returning.
            throw new Error(ProcessTxErrors.oneTransferEvent.toString());
        }

        transferEvents = transferEvents.filter((x) => !x.topics.includes(this.NULL_ADDRESS)); //Remove any events concerned with the NULL (burn) address, as these are irrelevant

        let uniqueAddressesFromTransfers = [...new Set(transferEvents.map((x) => x.address))];
        if (uniqueAddressesFromTransfers.length > 2) {
            throw Error('More than 2 unique addresses in transfers');
        } else if (transferEvents.length === 1) {
            throw Error(ProcessTxErrors.oneTransferEvent.toString());
        }

        //Used to determine out and in tokens
        let firstInstancesOfUniqueAddressUsage: any[] = [];
        for (let uniqueAddress of uniqueAddressesFromTransfers) {
            for (let event of transferEvents) {
                if (event.address === uniqueAddress) {
                    firstInstancesOfUniqueAddressUsage.push({
                        address: uniqueAddress,
                        logIndex: event.logIndex,
                    });
                    break;
                }
            }
        }

        firstInstancesOfUniqueAddressUsage.sort((a, b) => a.logIndex - b.logIndex);

        let tokenOutContractAddress = firstInstancesOfUniqueAddressUsage[0].address;
        let tokenInContractAddress = firstInstancesOfUniqueAddressUsage[1].address;

        let tokenOutDetails = await this.getTokenDetails(tokenOutContractAddress);
        let tokenInDetails = await this.getTokenDetails(tokenInContractAddress);

        let outContractAddressTransferEvents = transferEvents.filter((x) => x.address === tokenOutContractAddress);
        outContractAddressTransferEvents.sort((a, b) => {
            let aDataAsDecimal = parseFloat(this.ethNodeService.formatUnits(a.data, tokenOutDetails.decimals));
            let bDataAsDecimal = parseFloat(this.ethNodeService.formatUnits(b.data, tokenOutDetails.decimals));
            return bDataAsDecimal - aDataAsDecimal;
        });
        let tokenOutAmountInDecimals = this.ethNodeService.formatUnits(
            outContractAddressTransferEvents[0].data,
            tokenOutDetails.decimals,
        );

        let inContractAddressTransferEvents = transferEvents.filter((x) => x.address === tokenInContractAddress);
        inContractAddressTransferEvents.sort((a, b) => {
            let aDataAsDecimal = parseFloat(this.ethNodeService.formatUnits(a.data, tokenInDetails.decimals));
            let bDataAsDecimal = parseFloat(this.ethNodeService.formatUnits(b.data, tokenInDetails.decimals));
            return bDataAsDecimal - aDataAsDecimal;
        });
        let tokenInAmountInDecimals = this.ethNodeService.formatUnits(
            inContractAddressTransferEvents[0].data,
            tokenInDetails.decimals,
        );

        return {
            tokenOutAmount: parseFloat(tokenOutAmountInDecimals),
            tokenOutDetails: tokenOutDetails,
            tokenInAmount: parseFloat(tokenInAmountInDecimals),
            tokenInDetails: tokenInDetails,
        };
    }
}
