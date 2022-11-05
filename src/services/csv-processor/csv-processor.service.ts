import { Injectable } from '@nestjs/common';
import { CsvOutput } from 'src/models/CsvOutput';
import { EthereumTxProcessResult } from 'src/models/ethereumTxProcessResult';
let xlsx = require('json-as-xlsx');

@Injectable()
export class CsvProcessorService {
    baseCurrencyIsTokenOut: boolean;

    public process(results: EthereumTxProcessResult[]): void {
        let csvOutputLines: CsvOutput[] = [];

        results.forEach((result) => {
            let csvOutput: CsvOutput = {
                txHash: result.transactionAnalysisDetails.txHash,
                date: new Date(result.transactionAnalysisDetails.timestamp * 1000).toISOString(),
                currency: 'BNB',
                currencyPriceInDollars: null,
                valueOfTransaction: null,

                tokensOutAmount: null,
                tokensOutSymbol: null,
                tokensOutPricePerToken: null,

                tokensInAmount: null,
                tokensInSymbol: null,
                tokensInPricePerToken: null,
            };

            if (!result.success) {
                csvOutputLines.push(csvOutput);
                return;
            }

            if (
                result.transactionAnalysisDetails.transactionActions[0].tokenOutDetails.symbol === 'WBNB' ||
                result.transactionAnalysisDetails.transactionActions[0].tokenOutDetails.symbol === 'BNB' ||
                result.transactionAnalysisDetails.transactionActions[0].tokenOutDetails.symbol === 'BUSD' ||
                result.transactionAnalysisDetails.transactionActions[0].tokenOutDetails.symbol === 'USDC'
            ) {
                this.baseCurrencyIsTokenOut = true;
            } else {
                this.baseCurrencyIsTokenOut = false;
            }

            let priceData = this.getPriceData(result);

            csvOutput.currencyPriceInDollars = result.currencyPriceAtTime.close;
            csvOutput.valueOfTransaction = priceData.transactionTotalValue;

            csvOutput.tokensOutSymbol = result.transactionAnalysisDetails.transactionActions[0].tokenOutDetails.symbol;
            csvOutput.tokensOutAmount = result.transactionAnalysisDetails.transactionActions[0].tokenOutAmount;
            csvOutput.tokensOutPricePerToken = priceData.tokensOutPricePerToken;

            csvOutput.tokensInSymbol = result.transactionAnalysisDetails.transactionActions[0].tokenInDetails.symbol;
            csvOutput.tokensInAmount = result.transactionAnalysisDetails.transactionActions[0].tokenInAmount;
            csvOutput.tokensInPricePerToken = priceData.tokensInPricePerToken;

            // console.log(csvOutput);
            csvOutputLines.push(csvOutput);
        });

        let xlxsSettings = {
            fileName: 'tax-output', // Name of the resulting spreadsheet
            extraLength: 3, // A bigger number means that columns will be wider
        };

        let xlsxData = [
            {
                sheet: 'Output',
                columns: [
                    { label: 'TxHash', value: 'txHash' },
                    { label: 'date', value: 'date' },
                    { label: 'currency', value: 'currency' },
                    { label: 'currencyPriceInDollars', value: 'currencyPriceInDollars' },
                    { label: 'valueOfTransaction', value: 'valueOfTransaction' },
                    { label: 'tokensOutAmount', value: 'tokensOutAmount' },
                    { label: 'tokensOutSymbol', value: 'tokensOutSymbol' },
                    { label: 'tokensOutPricePerToken', value: 'tokensOutPricePerToken' },
                    { label: 'tokensInAmount', value: 'tokensInAmount' },
                    { label: 'tokensInSymbol', value: 'tokensInSymbol' },
                    { label: 'tokensInPricePerToken', value: 'tokensInPricePerToken' },
                ],
                content: csvOutputLines,
            },
        ];

        xlsx(xlsxData, xlxsSettings);
    }

    // public getValueOfTransaction(result: EthereumTxProcessResult) {
    //     let tokenDetails;
    //     let tokenAmount;
    //     let currencyPriceInDollars = result.ethPriceAtTime.close;

    //     if (this.baseCurrencyIsTokenOut) {
    //         tokenDetails = result.transactionAnalysisDetails.transactionActions[0].tokenOutDetails;
    //         tokenAmount = result.transactionAnalysisDetails.transactionActions[0].tokenOutAmount;
    //     } else {
    //         tokenDetails = result.transactionAnalysisDetails.transactionActions[0].tokenInDetails;
    //         tokenAmount = result.transactionAnalysisDetails.transactionActions[0].tokenInAmount;
    //     }

    //     if (tokenDetails.symbol === 'BNB' || tokenDetails.symbol === 'WBNB') {
    //         return currencyPriceInDollars * tokenAmount;
    //     }

    //     if (tokenDetails.symbol === 'BUSD' || tokenDetails.symbol === 'USDC') {
    //         return tokenAmount;
    //     }

    //     throw new Error('Could not getValueOfTransaction due to unknown symbol: ' + tokenDetails.symbol);
    // }

    public getPriceData(result: EthereumTxProcessResult) {
        let baseCurrencyDetails;
        let baseCurrencyAmount;
        let unknownCurrencyAmount;

        let currencyPriceInDollars = result.currencyPriceAtTime.close;

        let baseCurrencyPricePerToken;
        let unknownCurrencyPricePerToken;
        let transactionTotalValue;

        if (this.baseCurrencyIsTokenOut) {
            baseCurrencyDetails = result.transactionAnalysisDetails.transactionActions[0].tokenOutDetails;
            baseCurrencyAmount = result.transactionAnalysisDetails.transactionActions[0].tokenOutAmount;
            unknownCurrencyAmount = result.transactionAnalysisDetails.transactionActions[0].tokenInAmount;
        } else {
            baseCurrencyDetails = result.transactionAnalysisDetails.transactionActions[0].tokenInDetails;
            baseCurrencyAmount = result.transactionAnalysisDetails.transactionActions[0].tokenInAmount;
            unknownCurrencyAmount = result.transactionAnalysisDetails.transactionActions[0].tokenOutAmount;
        }

        if (baseCurrencyDetails.symbol === 'BNB' || baseCurrencyDetails.symbol === 'WBNB') {
            baseCurrencyPricePerToken = currencyPriceInDollars;
        } else if (baseCurrencyDetails.symbol === 'BUSD' || baseCurrencyDetails.symbol === 'USDC') {
            baseCurrencyPricePerToken = 1;
        }

        transactionTotalValue = baseCurrencyPricePerToken * baseCurrencyAmount;
        unknownCurrencyPricePerToken = transactionTotalValue / unknownCurrencyAmount;

        if (this.baseCurrencyIsTokenOut) {
            return {
                tokensOutPricePerToken: baseCurrencyPricePerToken,
                tokensInPricePerToken: unknownCurrencyPricePerToken,
                transactionTotalValue: transactionTotalValue,
            };
        }

        if (!this.baseCurrencyIsTokenOut) {
            return {
                tokensInPricePerToken: baseCurrencyPricePerToken,
                tokensOutPricePerToken: unknownCurrencyPricePerToken,
                transactionTotalValue: transactionTotalValue,
            };
        }
    }
}
