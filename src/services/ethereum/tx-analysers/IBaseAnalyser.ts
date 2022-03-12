import { EthereumTxProcessResult } from 'src/models/ethereumTxProcessResult';
import { EventLog } from 'src/models/EventLog';

export interface IBaseAnalyser {
    run(transferEvents: EventLog[], swapEvents: EventLog[]): Promise<DetailedTransactionInfo>;
}
