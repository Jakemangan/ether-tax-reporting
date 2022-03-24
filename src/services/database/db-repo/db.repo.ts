import { Injectable } from '@nestjs/common';
import { timestamp } from 'rxjs';
import { TxAnalysisActionDbo, TxAnalysisResultDbo } from 'src/models/dbo/txAnalysisResultDbo';
import {
    EthereumTxProcessResult,
    EthereumTxProcessResult as EthereumTxReport,
} from 'src/models/ethereumTxProcessResult';
import { EthPriceOHLCV } from 'src/models/HistoricEthPrice';
import { InfluencerTx } from 'src/models/influencerTx';
import { PgAnyResult, PgResult } from 'src/models/pgResult';
import { TimestampRange } from 'src/models/TimestampRange';
import { TokenDetails } from 'src/models/tokenDetails';
import { DbConnectionService } from '../db-connection/db-connection.service';

@Injectable()
export class DatabaseRepo {
    db: DbConnectionService;
    constructor(db: DbConnectionService) {
        this.db = db;
    }

    async getCount(): Promise<number> {
        let res = await this.db.pool.query('select count(*) from "HistoricEthPrices"');
        return res;
    }

    async insertWaitingListEmail(email: string): Promise<void> {
        await this.db.pool.query(`insert into "waitingList" values ('${email}')`);
    }

    // async insertTreasuryDatapoint(datapoint: Datapoint) {
    //     const res = await this.db.pool.query(
    //         'INSERT INTO treasury_data (value, "dateCreated", "projectName") values ($1, $2, $3)',
    //         [datapoint.value, datapoint.dateCreated, datapoint.projectName],
    //     );
    //     // console.log(res);
    // }

    // async insertInfluencerTransaction(influencerTx: InfluencerTx) {
    //     try {
    //         let res: PgAnyResult = await this.db.pool.query(
    //             'INSERT INTO "InfluencerTransactions" ("txHash", "walletAddress", "timestamp", "txToAddress") values ($1, $2, $3, $4)',
    //             [influencerTx.txHash, influencerTx.walletAddress, influencerTx.timestamp, influencerTx.txToAddress],
    //         );
    //     } catch (error) {
    //         console.log('Could not insert tx - ' + influencerTx.txHash);
    //     }
    // }

    async getLatestStoredInfluencerTransaction(walletAddresss: string) {
        let res: PgResult<InfluencerTx> = await this.db.pool.query(
            `SELECT * FROM "InfluencerTransactionReports" where "walletAddress" = '${walletAddresss}' order by timestamp desc limit 1`,
        );
        if (res.rows.length) {
            return res.rows[0];
        } else {
            return null;
        }
    }

    async getTokenDetailsByContractAddress(contractAddress: string) {
        let res: PgResult<TokenDetails> = await this.db.pool.query(
            'SELECT * FROM "TokenDetails" where "contractAddress" = $1 limit 1',
            [contractAddress],
        );
        return res.rows.length ? res.rows[0] : null;
    }

    async insertTokenDetails(tokenDetails: TokenDetails) {
        try {
            await this.db.pool.query(
                'INSERT INTO "TokenDetails" ("contractAddress", "name", "symbol", "decimals") values ($1, $2, $3, $4)',
                [tokenDetails.contractAddress, tokenDetails.name, tokenDetails.symbol, tokenDetails.decimals],
            );
        } catch (error) {
            console.error('Could not insert TokenDetails - ' + error.message);
        }
    }

    async insertEmptyTxReport(tx: InfluencerTx) {
        try {
            await this.db.pool.query(
                'INSERT INTO "InfluencerTransactionReports" values ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
                [tx.txHash, tx.timestamp, 0, -1, 0, 0, '', '', tx.walletAddress],
            );
        } catch (error) {
            console.error('Could not insert TxReport - ' + error.message);
        }
    }

    async getNearestEthPrices(timestampRange: TimestampRange): Promise<EthPriceOHLCV> {
        let resUpper: PgResult<EthPriceOHLCV> = await this.db.pool.query(
            'SELECT * FROM "HistoricEthPrices" where date <= $1  order by date desc limit 1',
            [timestampRange.nearest],
        );
        let resLower: PgResult<EthPriceOHLCV> = await this.db.pool.query(
            'SELECT * FROM "HistoricEthPrices" where date >= $1  order by date asc limit 1',
            [timestampRange.nearest],
        );
        if (resUpper.rows.length && resLower.rows.length) {
            let result = [];
            result.push(resLower.rows[0]);
            result.push(resUpper.rows[0]);

            result = result.sort((a, b) => {
                //Find the absolute differences between the base timestamp and the two values pulled from the DB
                //Then sort them so that the closest timestamp price data is first in the array.
                return (
                    Math.abs(timestampRange.base - parseInt(a.date)) - Math.abs(timestampRange.base - parseInt(b.date))
                );
            });
            return result[0];
        } else {
            return null;
        }
    }

    async upsertTransactionAnalysisResult(toInsert: EthereumTxProcessResult[], walletAddress: string) {
        let resultDbos: TxAnalysisResultDbo[] = [];
        let actionDbos: TxAnalysisActionDbo[] = [];

        for (const e of toInsert) {
            //Add top level result object to total list of objects to insert to DB
            let resultDbo: TxAnalysisResultDbo = {
                hash: e.transactionAnalysisDetails.txHash,
                resultType: e.overallResultType as string,
                avgEthPriceAtTime: e.ethPriceAtTime.close,
            };
            //Concat all actions for element into list of total actions to insert into DB
            actionDbos = actionDbos.concat(
                e.transactionAnalysisDetails.transactionActions.map(
                    (action) =>
                        <TxAnalysisActionDbo>{
                            hash: e.transactionAnalysisDetails.txHash,
                            tokenOutAddress: action.tokenOutDetails.contractAddress,
                            tokenOutAmount: action.tokenOutAmount,
                            tokenInAddress: action.tokenInDetails.contractAddress,
                            tokenInAmount: action.tokenInAmount,
                            isIgnored: false,
                        },
                ),
            );
            resultDbos.push(resultDbo);
        }

        let sql1 = 'BEGIN; ';
        for (const e of resultDbos) {
            sql1 +=
                `INSERT INTO "TxAnalysisResults" ("hash", "txType", "avgEthPriceAtTime") ` +
                `VALUES ('${e.hash}', '${e.resultType}', '${e.avgEthPriceAtTime}') ` +
                `ON CONFLICT ("hash") DO UPDATE SET "txType" = EXCLUDED."txType", "avgEthPriceAtTime" = EXCLUDED."avgEthPriceAtTime"; `;
        }
        sql1 += ' COMMIT;';

        let sql2 = 'BEGIN;';
        for (const e of actionDbos) {
            sql2 +=
                `INSERT INTO "TxAnalysisActions" ("tokenOutAddress", "tokenOutAmount", "tokenInAddress", "tokenInAmount", "hash", "isIgnored", "walletAddress")` +
                `VALUES ('${e.tokenOutAddress}', ${e.tokenOutAmount}, '${e.tokenInAddress}', ${e.tokenInAmount}, '${e.hash}', false, '${walletAddress}');`;
        }
        sql2 += 'END;';

        try {
            //Upsert all tx result records
            await this.db.pool.query(sql1);
            //Delete all actions for wallet address before updating with new values
            await this.db.pool.query(`DELETE FROM "TxAnalysisActions" WHERE "walletAddress" = '${walletAddress}'`);
            await this.db.pool.query(sql2);
        } catch (error) {
            console.error('Could not EthereumTxProcessResult - ' + error.message);
        }
    }

    // async insertTxReport(report: EthereumTxReport, walletAddress: string) {
    //     try {
    //         await this.db.pool.query(
    //             'INSERT INTO "InfluencerTransactionReports" values ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
    //             [
    //                 report.txHash,
    //                 report.timestamp,
    //                 report.numberOfLogEvents,
    //                 report.type,
    //                 report.wethAmountDecimal,
    //                 report.tokenAmountDecimal,
    //                 report.tokenName,
    //                 report.tokenContractAddress,
    //                 walletAddress,
    //             ],
    //         );
    //     } catch (error) {
    //         console.error('Could not insert TxReport - ' + error.message);
    //     }
    // }
}
