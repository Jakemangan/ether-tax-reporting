import { Injectable } from '@nestjs/common';
import { InfluencerTx } from 'src/models/influencerTx';
import { PgAnyResult, PgResult } from 'src/models/pgResult';
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

    async insertInfluencerTransaction(influencerTx: InfluencerTx) {
        let inputValues = Object.values(influencerTx);
        let res: PgAnyResult = await this.db.pool.query(
            'INSERT INTO "InfluencerTransactions" ("txHash", "influencerId", "timestamp") values ($1, $2, $3)',
            [...inputValues],
        );
    }

    async getLast100TransactionsByInfluencerId(id: string) {
        let res: PgResult<InfluencerTx> = await this.db.pool.query(
            'SELECT * FROM "InfluencerTransactions" order by timestamp desc limit 100',
        );
        return res.rows;
    }
}
