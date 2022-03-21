export interface TxAnalysisResultDbo {
    hash: string;
    resultType: string;
    avgEthPriceAtTime: number;
}

export interface TxAnalysisActionDbo {
    hash: string;
    tokenOutAddress: string;
    tokenOutAmount: number;
    tokenInAddress: string;
    tokenInAmount: number;
    isIgnored: boolean;
}
