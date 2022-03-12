import { Injectable } from '@nestjs/common';
import { TokenDetails } from 'src/models/tokenDetails';
import { DatabaseRepo } from '../database/db-repo/db.repo';
import { WebScrapingService } from '../web-scraping/web-scraping.service';

@Injectable()
export class TokenService {
    constructor(private dbRepo: DatabaseRepo, private webScrapingService: WebScrapingService) {}

    async getTokenDetails(contractAddress: string): Promise<TokenDetails> {
        // return tokenDetails.find((token) => token.address.toUpperCase() === contractAddress.toUpperCase());
        try {
            let tokenDetails = await this.dbRepo.getTokenDetailsByContractAddress(contractAddress);
            if (!tokenDetails) {
                tokenDetails = await this.webScrapingService.getTokenDetails(contractAddress);
                await this.dbRepo.insertTokenDetails(tokenDetails);
                console.log('Token details scraped from web and added to DB.');
            } else {
                // console.log('Token details found in DB.');
            }
            return tokenDetails;
        } catch (error) {
            return null;
        }
    }
}
