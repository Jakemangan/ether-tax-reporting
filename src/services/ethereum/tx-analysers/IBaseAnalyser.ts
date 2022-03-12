import { EthereumTxProcessResult } from 'src/models/ethereumTxProcessResult';
import { EventLog } from 'src/models/EventLog';
import { TxAnalyserResult } from 'src/models/TxAnalyserResult';

export interface IBaseAnalyser {
    name: string;
    run(transferEvents: EventLog[], swapEvents: EventLog[], walletAddress: string): Promise<TxAnalyserResult>;
}
