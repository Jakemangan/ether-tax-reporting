import { EthereumTransactionDetails } from 'src/models/EthereumTransactionDetails';
import { EventLog } from 'src/models/EventLog';
import { AnalysisResultType } from 'src/models/ProcessTxErrors';
import { TxAnalyserResult } from 'src/models/TxAnalyserResult';
import { IBaseAnalyser } from './IBaseAnalyser';

export default class TxPreAnalyser implements IBaseAnalyser {
    name: string = 'PRE_ANALYSIS';
    private readonly NULL_ADDRESS: string = '0x0000000000000000000000000000000000000000000000000000000000000000';

    async run(
        transferEvents: EventLog[],
        swapEvents: EventLog[],
        walletAddress: string,
        txDetails: EthereumTransactionDetails,
    ): Promise<TxAnalyserResult> {
        transferEvents = transferEvents.filter((x) => !x.topics.includes(this.NULL_ADDRESS)); //Remove any events concerned with the NULL (burn) address, as these are irrelevant
        const numLogEvents = txDetails.txReceipt.logs.length;

        if (numLogEvents > 20) {
            return {
                success: false,
                shouldContinue: false,
                resultType: AnalysisResultType[AnalysisResultType.potentialMigrationOrAirdrop],
                transactionInfo: null,
            };
        }

        if (transferEvents.length === 1) {
            return {
                success: false,
                shouldContinue: false,
                resultType: AnalysisResultType[AnalysisResultType.simpleTransfer],
                transactionInfo: null,
            };
        }

        let uniqueAddresesOfTransferEvents = [...new Set(transferEvents.map((x) => x.address))];
        //Migration scripts or airdrops will have all transfer events having the same address
        if (numLogEvents > 1 && uniqueAddresesOfTransferEvents.length === 1) {
            return {
                success: false,
                shouldContinue: false,
                resultType: AnalysisResultType[AnalysisResultType.potentialMigrationOrAirdrop],
                transactionInfo: null,
            };
        }

        return {
            success: true,
            shouldContinue: true,
            resultType: AnalysisResultType[AnalysisResultType.preAnalyseSuccess],
            transactionInfo: null,
        };
    }
}
