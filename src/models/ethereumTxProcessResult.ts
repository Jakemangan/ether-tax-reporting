import { AnalysisResults } from './AnalysisErrors';
import { TransactionAction } from './DetailedTransactionInfo';
import { EthPriceOHLCV } from './HistoricEthPrice';
import { AnalysisResultType } from './ProcessTxErrors';
import { TimestampRange } from './TimestampRange';

export interface EthereumTxProcessResult {
    success: boolean;
    isProcessable: boolean;
    analysisResults: AnalysisResults;
    overallResultType: AnalysisResultType | string;
    transactionAnalysisDetails: TransactionAnalysisDetails;
    ethPriceAtTime?: EthPriceOHLCV;
}

export interface TransactionAnalysisDetails {
    txHash: string;
    timestamp: number;
    nearest5minTimestampRange: TimestampRange;
    numberOfLogEvents: number;
    transactionActions?: TransactionAction[];
}
