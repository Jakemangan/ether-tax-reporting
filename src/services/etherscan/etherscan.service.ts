import { Injectable } from '@nestjs/common';
import * as axios from 'axios';
import { EtherscanTransaction } from 'src/models/etherscanTransaction';

@Injectable()
export class EtherscanService {
    private readonly API_KEY = 'J2GAJVC7JJ4NZ331JCF41BPCCIFA73CHDU';

    constructor() {}

    async getTransactionsForAddress(walletAddress: string, isTest: boolean): Promise<EtherscanTransaction[]> {
        // if(isTest){
        //     return randomTestTx();
        // }
        let url = `https://api.etherscan.io/api?module=account&action=tokentx&address=${walletAddress}&page=1&offset=100&sort=desc&apikey=J2GAJVC7JJ4NZ331JCF41BPCCIFA73CHDU`;
        let res = (await axios.default.get(url)).data;
        return res.result;
    }

    private randomTestTx() {}
}
