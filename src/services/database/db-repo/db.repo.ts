import { Injectable } from '@nestjs/common';
import { EthereumTxProcessResult as EthereumTxReport } from 'src/models/ethereumTxProcessResult';
import { InfluencerTx } from 'src/models/influencerTx';
import { PgAnyResult, PgResult } from 'src/models/pgResult';
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

    async insertEmptyReport(tx: InfluencerTx) {
        try {
            await this.db.pool.query(
                'INSERT INTO "InfluencerTransactionReports" values ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
                [tx.txHash, tx.timestamp, 0, -1, 0, 0, '', '', tx.walletAddress],
            );
        } catch (error) {
            console.error('Could not insert TxReport - ' + error.message);
        }
    }

    async insertTxReport(report: EthereumTxReport, walletAddress: string) {
        try {
            await this.db.pool.query(
                'INSERT INTO "InfluencerTransactionReports" values ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
                [
                    report.txHash,
                    report.timestamp,
                    report.numberOfLogEvents,
                    report.type,
                    report.wethAmountDecimal,
                    report.tokenAmountDecimal,
                    report.tokenName,
                    report.tokenContractAddress,
                    walletAddress,
                ],
            );
        } catch (error) {
            console.error('Could not insert TxReport - ' + error.message);
        }
    }
}
