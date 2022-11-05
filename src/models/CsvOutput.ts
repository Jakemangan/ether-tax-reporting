export interface CsvOutput {
    txHash: string;
    date: string;
    currency: string;
    currencyPriceInDollars: number;
    valueOfTransaction: number;
    tokensOutSymbol: string;
    tokensOutAmount: number;
    tokensOutPricePerToken: number;
    tokensInSymbol: string;
    tokensInAmount: number;
    tokensInPricePerToken: number;
}
