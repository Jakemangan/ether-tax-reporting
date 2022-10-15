import { TransactionAction } from 'src/models/DetailedTransactionInfo';
import { EthereumTxProcessResult } from 'src/models/ethereumTxProcessResult';
import { EventLog } from 'src/models/EventLog';
import { AnalysisResultType } from 'src/models/ProcessTxErrors';
import { TxAnalyserResult } from 'src/models/TxAnalyserResult';
import { TokenService } from 'src/services/token/token.service';
import { EthereumNodeService } from '../ethereum-node/ethereum-node.service';
import { IBaseAnalyser } from './IBaseAnalyser';

export default class TxTransferAnalyser implements IBaseAnalyser {
    private readonly NULL_ADDRESS: string = '0x0000000000000000000000000000000000000000000000000000000000000000';

    name: string = 'TRANSFER';

    constructor(private ethNodeService: EthereumNodeService, private tokenService: TokenService) {}

    async run(transferEvents: EventLog[], swapEvents: EventLog[]): Promise<TxAnalyserResult> {
        /*
         * Logic
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
         *  IMPORTANT - The approval log may provide a way to bridge between the transfer and swap events e.g. tx - https://bscscan.com/tx/0x0339bc242b92da65710990e4c5a251ee4382e74ded576d698e82c3a5019ea74d#eventlog
         */

        transferEvents = transferEvents.filter((x) => !x.topics.includes(this.NULL_ADDRESS)); //Remove any events concerned with the NULL (burn) address, as these are irrelevant

        let uniqueAddressesFromTransfers = [...new Set(transferEvents.map((x) => x.address))];
        if (uniqueAddressesFromTransfers.length > 2) {
            return {
                success: false,
                shouldContinue: true,
                resultType: AnalysisResultType[AnalysisResultType.moreThan2UniqueAddressesInTransferLogs],
                transactionActions: null,
            };
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

        let tokenOutDetails = await this.tokenService.getTokenDetails(tokenOutContractAddress);
        let tokenInDetails = await this.tokenService.getTokenDetails(tokenInContractAddress);

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
            success: true,
            shouldContinue: false,
            resultType: AnalysisResultType[AnalysisResultType.success],
            transactionActions: [
                {
                    tokenOutAmount: parseFloat(tokenOutAmountInDecimals),
                    tokenOutDetails: tokenOutDetails,
                    tokenInAmount: parseFloat(tokenInAmountInDecimals),
                    tokenInDetails: tokenInDetails,
                    destinationAddress: 'idk',
                },
            ],
        };
    }
}
