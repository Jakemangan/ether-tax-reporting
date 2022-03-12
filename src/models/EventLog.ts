export interface EventLog {
    transactionIndex: number;
    blockNumber: number;
    tranactionHash: string;
    address: string;
    topics: string[];
    data: string;
    logIndex: number;
    blockHash: string;
}
