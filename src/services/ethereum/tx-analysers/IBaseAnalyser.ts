import { EthereumTransactionDetails } from 'src/models/ethereumTransactionDetails';
import { EventLog } from 'src/models/EventLog';
import { TxAnalyserResult } from 'src/models/TxAnalyserResult';

export interface IBaseAnalyser {
    name: string;
    run(
        transferEvents: EventLog[],
        swapEvents: EventLog[],
        walletAddress: string,
        txDetails: EthereumTransactionDetails,
    ): Promise<TxAnalyserResult>;
}
