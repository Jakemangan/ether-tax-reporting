import { Injectable } from '@nestjs/common';
import cheerio from 'cheerio';
import { AnyTxtRecord } from 'dns';
import fetch from 'node-fetch';
import { TokenDetails } from 'src/models/tokenDetails';

@Injectable()
export class WebScrapingService {
    private readonly webScrapingApiKey = 'jDF7HWvVdVhBHJY14OC1bN3UZVueLinw';

    public async getAllTransactionHashesForWalletAddress(walletAddress: string): Promise<string[]> {
        try {
            let totalTxCount = await this.scrapeTxCount(walletAddress);
            if (!totalTxCount) {
                throw new Error("Could not scrape total TX count, can't continue.");
            }
            console.log('Total TXs to retrieve - ' + totalTxCount);
            let txHashes = await this.scrapeTransactionHashesFromWallet(walletAddress, totalTxCount);
            if (txHashes.length === totalTxCount) {
                console.log('All TXs successfully scraped.');
                // let txHashesSet = new Set([...txHashes]);
                return txHashes;
            }
            console.log(JSON.stringify(txHashes));
        } catch (error) {
            console.error('Could not scrape site - ' + error);
        }
        return null;
    }

    public async getTokenDetails(contractAddress: string): Promise<TokenDetails> {
        try {
            let tokenDetails = await this.scrapeTokenDetailsFromWebpage(contractAddress);
            if (tokenDetails) {
                tokenDetails.contractAddress = contractAddress;
                return tokenDetails;
            } else {
                throw new Error('Could not scrape site for token details.');
            }
        } catch (error) {
            console.error('Could not scrape site for token details - ' + error);
        }
        return null;
    }

    /*
     * Private methods
     */

    //This and the below method can be refactored into one
    private async scrapeTokenDetailsFromWebpage(contractAddress: string) {
        let urlToCall = this.tokenDetailsUrlBuilder(contractAddress);
        let pageHtmlOk = false;
        let pageHtml: string;
        while (!pageHtmlOk) {
            pageHtml = await (await fetch(urlToCall)).text();
            if (pageHtml.includes('The website responded with status code 403')) {
                console.log('Bad scrape. Retrying.');
                // console.log(pageHtml);
                continue;
            } else {
                pageHtmlOk = true;
            }
        }
        if (pageHtml) {
            return this.getTokenDetailsFromHtml(pageHtml);
        }
    }

    private async scrapeTxCount(walletAddress: string): Promise<number> {
        console.log('Getting total TX count.');
        let urlToCall = this.walletTransactionUrlBuilder(walletAddress);

        try {
            let pageHtmlOk = false;
            let pageHtml: string;
            while (!pageHtmlOk) {
                pageHtml = await (await fetch(urlToCall)).text();
                if (pageHtml.includes('The website responded with status code 403')) {
                    console.log('Bad scrape. Retrying.');
                    // console.log(pageHtml);
                    continue;
                } else {
                    console.log('TX count scrape OK.');
                    pageHtmlOk = true;
                }
            }
            if (pageHtml) {
                return this.getTotalTxCountFromHtml(pageHtml);
            }
        } catch (error) {
            console.error('Could not scrape site - ' + error);
        }
    }

    private async scrapeTransactionHashesFromWallet(walletAddress: string, totalTxCount: number) {
        let pageIndex = 1;
        let txHashesForWallet: string[] = [];

        while (txHashesForWallet.length < totalTxCount) {
            let pageUrl = this.walletTransactionUrlBuilder(walletAddress, pageIndex);
            let pageHtml = await (await fetch(pageUrl)).text();
            if (pageHtml.includes('Cloudflare') && pageHtml.includes('The website responded with status code 403')) {
                console.log('Bad scrape. Retrying.');
                continue;
            }
            if (pageHtml) {
                const $ = cheerio.load(pageHtml);

                const allTableRows: any = $(
                    '#content > div.container.space-bottom-2 > div > div > div.table-responsive.mb-2.mb-md-0 > table > tbody > tr',
                );

                /*
                The resulting object parsed from the HTML should be an array of at least 25 HTML nodes (each node being 
                a row in the table), if not something has gone wrong with the scraper and we should retry the url
                */
                if (allTableRows.length >= 25) {
                    let length = allTableRows.length;
                    for (let i = 0; i < length; i++) {
                        const rowObjectText = cheerio.load(allTableRows[i].children[1]).text();
                        txHashesForWallet.push(rowObjectText);
                    }
                    console.log(`Successfully scraped ${allTableRows.length} rows from page ${pageIndex}`);
                    pageIndex++;
                } else {
                    console.log(`Something went wrong with scraping page ${pageIndex}, retrying.`);
                }
            } else {
                throw new Error('Could not get HTML for URL: ' + pageUrl);
            }
        }

        console.log('Total scraped tx count: ', txHashesForWallet.length);
        return txHashesForWallet;
    }

    private getTotalTxCountFromHtml(pageHtml): number {
        const $ = cheerio.load(pageHtml);

        let totalTxElementText: any = $('#ContentPlaceHolder1_divTopPagination > p').text();

        totalTxElementText = totalTxElementText.replace(/[^0-9.]/g, '').trim();
        return parseInt(totalTxElementText);
    }

    private getTokenDetailsFromHtml(pageHtml: string): TokenDetails {
        const $ = cheerio.load(pageHtml);

        let tokenName = $('#content > div.container.py-3 > div > div.mb-3.mb-lg-0 > h1 > div > span').text().trim();
        let tokenDecimals = $('#ContentPlaceHolder1_trDecimals > div > div.col-md-8')
            .text()
            .replace(/[^0-9]/g, '')
            .trim();
        let tokenSymbol = $(
            '#ContentPlaceHolder1_divSummary > div.row.mb-4 > div.col-md-6.mb-3.mb-md-0 > div > div.card-body > div.row.align-items-center > div.col-md-8.font-weight-medium',
        )
            .text()
            .replace(/[^a-zA-Z]/g, '')
            .trim();

        return {
            contractAddress: '',
            decimals: parseInt(tokenDecimals),
            name: tokenName,
            symbol: tokenSymbol,
        };
    }

    private walletTransactionUrlBuilder(walletAddress: string, pageNumber: number = null) {
        let etherScanUrl;
        if (pageNumber) {
            etherScanUrl = `https://etherscan.io/tokentxns?a=${walletAddress}&p=${pageNumber}`;
        } else {
            etherScanUrl = `https://etherscan.io/tokentxns?a=${walletAddress}`;
        }

        let encodedTargetURI = encodeURIComponent(etherScanUrl);

        //WebScrapingApi URL
        // let url = `https://api.webscrapingapi.com/v1?api_key=${this.webScrapingApiKey}&url=${encodedTargetURI}&device=desktop&proxy_type=datacenter&render_js=1&wait_until=domcontentloaded&keep_headers=1&wait_for=10000`;

        let url = `https://app.scrapingbee.com/api/v1/?api_key=6TL8H95UWQZ4OKFPKRUCO894OVZ3FOJ3ZPU6WMQRJAQVNHSM5NKD9DELDAF43KU75Z58NFFEH6DHBM6B&url=${encodedTargetURI}&wait=10000`;
        return url;
    }

    private tokenDetailsUrlBuilder(contractAddress) {
        let etherscanUrl = 'https://etherscan.io/token/' + contractAddress;
        let encodedTargetURI = encodeURIComponent(etherscanUrl);
        let url = `https://app.scrapingbee.com/api/v1/?api_key=6TL8H95UWQZ4OKFPKRUCO894OVZ3FOJ3ZPU6WMQRJAQVNHSM5NKD9DELDAF43KU75Z58NFFEH6DHBM6B&url=${encodedTargetURI}&wait=3000`;
        return url;
    }

    public getTestTxHashes() {
        return ['0xc18b276005c7cd1a3e50505a94543dd656b81433787566756be894cdffec372b'];
    }

    // 0x09500281441ed397dc785b34ae075882695a09f0f72eb2bdcca388b4c53a5002
    // 0xaf45418d0fbe37c92ad22334b1afc2c22fa9b04376e9a9ecd74c5241c63683bf
    // 0x6e17c69d6f90dc1a01b514805f43ada1d3b9021ae9ecb68c4384563d5546196a
    // 0x3f29b727830ad5cb84975f4cd6b87ebdc02bf2860149bb518ec6b59f2036fb8d
    // 0xf4387a09d1f03cfb518ea2b15f96544e70c2032000372ebef68d5824111fd86c
    // 0xbcd211b51b3208698bb7c20cdcac74c72f994e88c3a2e7665511d5cf5ff63fd8
    // 0x45a26e6419ac5bfa30cf94dd09ea2d56076502b008907cf8066331b6ecf64cd8
    // 0xde17cc24a088c6d5a326f0540d47cb993e78f4d96e4b58eae72d320206d06d4b

    // Weird, 3 tx's in one - 0x24cf38b4dc45b0c006b7fe467e029ea48ff1a14cc4f753209967a2970f00aaaf

    public getAllWalletTxHashesSync() {
        return [
            '0x24cf38b4dc45b0c006b7fe467e029ea48ff1a14cc4f753209967a2970f00aaaf',
            '0x24cf38b4dc45b0c006b7fe467e029ea48ff1a14cc4f753209967a2970f00aaaf',
            '0x24cf38b4dc45b0c006b7fe467e029ea48ff1a14cc4f753209967a2970f00aaaf',
            '0xb7295b5103082dd0bcb0bdaaf6abdd456fda5aeb1379caa676b9acce45462111',
            '0xbb7bd8e40d541a18f911f89e6abd02ed43dbcd262b775b8b93a885abca6157dd',
            '0x6895568f613f16a9bd7fd2d3cc982381931e9d25f1630247c36b2393a50f3ff9',
            '0x6895568f613f16a9bd7fd2d3cc982381931e9d25f1630247c36b2393a50f3ff9',
            '0x79c8e65310685b56e44de7858fa4cba2c2e49db6b9097f558728a1c4db179830',
            '0x3b329b170408b560bef51da6f2611ec15c2e04c054efccc549ad4fb881af4ad8',
            '0x3b329b170408b560bef51da6f2611ec15c2e04c054efccc549ad4fb881af4ad8',
            '0x09500281441ed397dc785b34ae075882695a09f0f72eb2bdcca388b4c53a5002',
            '0xb19f6d093b1dc9f1b8dacdbab03895f8a2a7eb7db71a7d5dc2fbae6cf6f8effa',
            '0xaf45418d0fbe37c92ad22334b1afc2c22fa9b04376e9a9ecd74c5241c63683bf',
            '0x84a8f04dde6bc04840585b42a69bce2b775e1c1493490e566a6b5c9820c6d7e9',
            '0x0be34f7c27ce9c3a3f5b49d5c58e8bdbcd2570bc057e83b2019d71d732461ddc',
            '0xbdbd4e862ebda8a9075c4ad87f5c5502fad69b0356e495f5a5b21ca983d1f47f',
            '0x1211084b99334b5909eb3eb04da6a7212182d62164d257648c2b3b7c8546d9a8',
            '0xf63c1ff84dd3d459ed15d8e136106a4074d2affe7dda5552beecd474cb522807',
            '0xe79d1540cd4fbe22d6ee522b2f42ea421183d9e4eab40bdb50ff2008772f7793',
            '0x14391c68eee32de0fe2e6ef09eed6a0dea5c1a1b4c0d580933dcf70848615c22',
            '0xf33a84f0d72f88903fcd350b661eab1f710a0f8b26494ca23d03ec779ea41433',
            '0x686236fe451e9f6705a869fab8fefc5e679b74f9a9a2098aa2631bd29d957ca5',
            '0xc6e948515f779394ca29d166b3d56b8c1b0666387c92c172db9bd4c02bab2296',
            '0x8e7a3b14d8338574b1fa766312d2170e454b111ff282f9c1a2b1aefab32540b3',
            '0x1d219aba1b2fcc6e6ab26039f66afe8825c240792c8f028107f7a9a53f6f29b2',
            '0x0d38515b42bc0ced6988b3805b82b8b33d8e13853b1991a9de6b08d993e013a7',
            '0x0d38515b42bc0ced6988b3805b82b8b33d8e13853b1991a9de6b08d993e013a7',
            '0xa722dae335a24e03ad316285b3df29b3c08f960229c7a94f317d321f2b964cf0',
            '0x7989b7f23fa88a002c6e1757e8175f68e3c2987cd2f902591e798cbb432eec69',
            '0x345689833c0a820d6d462ed9f2859485dd7b4b3fede53b4bf1183b719fb7f7e6',
            '0x345689833c0a820d6d462ed9f2859485dd7b4b3fede53b4bf1183b719fb7f7e6',
            '0xe4d29099546c49e1fa2d912f930f23415295ae76f88febf0bdb7b9ebc337203b',
            '0xf787ac65cf70979aa6a0c16a515a0600416e2eab7161da2398326aafbd0c4496',
            '0x82d0ecf26611503f23df1f9cf0032aac9aba0d30331700e692493ded282a0ed5',
            '0x16dba677f69b438a14e095f6bbf4d6136924805d963b7967d68a710039a4b8ac',
            '0x03ab0bf5dcae6a35f96b502d51cd42be7dc3880a9d19e51fea7f08a06946f4f5',
            '0xc18b276005c7cd1a3e50505a94543dd656b81433787566756be894cdffec372b',
            '0xffa7ebacc852a5f8954e912dd577743e18206f8e81c1a83df64da7b1fe7276c5',
            '0x49fcebd7f4feee79203eef0490f0518c4e5814db59948c67b3f81189ee248293',
            '0xef20dd582e4ec2d7f6872a854888358f0414d44f7722bbc202abb3d4d1bc03e7',
            '0xf05a2d7dee2bef0cbc22b3baaf4e0c49f7fcd800df14b7a00c760a8f40f2b4b5',
            '0xe2cca61a65357a40b873d358c963fabc7060f4fb4c2c92ea812fdb17ca5df6f6',
            '0x6e17c69d6f90dc1a01b514805f43ada1d3b9021ae9ecb68c4384563d5546196a',
            '0x3f29b727830ad5cb84975f4cd6b87ebdc02bf2860149bb518ec6b59f2036fb8d',
            '0x210ec7b5903508aa9233bfdce9a7aaf0559249a171e39dbf161c57ceffab9995',
            '0xf4387a09d1f03cfb518ea2b15f96544e70c2032000372ebef68d5824111fd86c',
            '0x70e1b1eca7a9b9e5fb8787d7ad05215ea9bd740eb790dfe505d6b9b1fcb674f8',
            '0x8f88961bba80b7f53b35a5f26a4a163aa81f23ac424f9bd9426000d04e1fc1c2',
            '0x249224cdd39904d810d5b37b246b2795b3ba55dd8dd9ba0c906c955c11edb85d',
            '0xbcd211b51b3208698bb7c20cdcac74c72f994e88c3a2e7665511d5cf5ff63fd8',
            '0xaf559ca47c6438e5ff3ad5593226b30c55430f35547ec4f121c9abceab7d46bf',
            '0xaf559ca47c6438e5ff3ad5593226b30c55430f35547ec4f121c9abceab7d46bf',
            '0xe68cc42564847e25c38aa828d8fb3196228200910acd50cee79fef35e0c795bd',
            '0xc208cda41b9ab8040c1cba8ff199e34ea06d0b697b5ef833b05d44b957a11fd2',
            '0xcaf5f3ce1708df7a1b6e626728800dad0c04ccd2e1bd6209d685986ff1e33b80',
            '0x45a26e6419ac5bfa30cf94dd09ea2d56076502b008907cf8066331b6ecf64cd8',
            '0x3720e77fa983baf64f8704511001f67460f70265f0f05779f3febb1d86e449e3',
            '0x6cdbaa0ef06af42081412fd5dea13aadb62bce04b286de003b5397a1bfd9a7e7',
            '0xa0e05e4308da53478570525bc53e0ea71eef8a7cabbd60592e36ea64b0860fa1',
            '0x74c1462d077d6fe5e86ba011f94670273c151c95b7603eb85896d04ae37c2052',
            '0x534ef777d136e76ddd4b360fb21e4e7ddd48920eac9141253e25502be51ed216',
            '0x0bdcb8cbcbd08dd1123fa272f713c5622cbd5d761e95efe1f1b2b1681624d9af',
            '0xfe8ebfae6f59790e4e906955e9663a70a02ccb0e86bb7c2e66c85b2637384f3b',
            '0x377eadb25e4750b38ddcf39f879ca6a40b416d4f1014165d968eb1223db7b795',
            '0xcf899ac21276f82d9d84e9d328783018ab32b7570cf9b7e104b011cba397886f',
            '0xfbbe284054927c6977a68d73e31a154d2a0df5129204a6217507e624e446dcd9',
            '0x7ae78a31d8cc043b2fa1f05b18af6c43c1341605289311761bba37ef6fa64e5e',
            '0x6619f9012b3f230627c3d197d74d4411684fd45e3ec6620fe8cd6b0212930704',
            '0x394c5fb4702ae372074a96039d5f33f80adaca05d00c5ebfa7d5a636ae0866dc',
            '0x35c9bce1523aa5ad62b5121196087100aea27e7a895293119fc1c8af7ebca5e5',
            '0xa46360214f4a198fb6250ea135642595ba096f60049b20acd3fe7cb991482d63',
            '0xde17cc24a088c6d5a326f0540d47cb993e78f4d96e4b58eae72d320206d06d4b',
            '0xe156a18485bc462b1c9f60036537a8cda9a3a9c40ae4c3a153defee9282bcc26',
            '0x69b69bcee3ca965eee3144598aff23c2d279ff758a34b33f44477a1aeeaf36ad',
            '0x1a0a272a2c74f0ad0ccf0ed1cbd8ec96f4b5bb3bebc7a3cced27bd7b62003b89',
            '0x87290f4749622ec1b293b4f46192345a441ec6630d6f3aec843911c05d836bdc',
            '0x68b6324714a3f9875607af00f6b0b1e111f4ba38336fe1582621e80eedf9b0e4',
            '0xc3b6474ab9f3aaf386e9d34b9711cdd720ba3046a0832afc9aeb6df281409aac',
            '0x69919d0eba98d00fdf75dbf7a353223b148aa17c04c37e6430a4ef3cfbe7e3b8',
            '0x9389920ebab569ccf79ad965399d5cf38b15f2dc3a5660e8658131479cb01fcc',
            '0x4d075683de028e598c1d8d94c6904008dd63d5f448125499049b1059c900f126',
            '0xbd41d5f65c51ac43932f38e38bdf5f754a67b1da62e4a61c5eeb8ac5a66a15bb',
            '0x324c18178a60302a25a851aa54357b5bd4d14a63b391631d7e4ed5ab55abe567',
            '0xa0fd938b1cab03f7f0c59b7ebb3de8ac4bb8d1c8b567215698164a612d59014c',
            '0x39743e06cbae271dce2b9c46ec0c520c4a59949b45268caf6c591ecc1fdbecdd',
            '0x66d915155677e7b516f1ea6d11cb61fa7ae665908f20f21e2b3daf4696c98d63',
            '0xc34fcfec006b5570f973df298f6aa794749778cd4110662a2d6179d34d9b0688',
            '0x36b266249d1f3eb4bdea88fb3b6cb604699611bb948329568b8a12834f97fafe',
            '0x1af8c8ec6915694ba226562ac4149b78c0e2e4822fba5e403819e57f83bebcf6',
            '0x81f167015aa3dfb231c715beec10d4a4e77f75d1b8a272802b7f8eac8cbd5f31',
            '0x9b64134984bf22c87bc7ad7a66a66d1a368e368c0587ddcebf74c8a2e66cd74d',
            '0xa3fa1af99709763cd102712a4f49b2cb06d670dc589647961e4ba5678a0abeb3',
            '0x4e61a661305ecf988d9b609b36aee999fce36cbf7cefe833e3d5a2c6e9cdffac',
            '0x7498c2438d3bae9cc472a2f0583a51f7cf5a381915eab1078f022a9ac7c23de8',
            '0xff2cfdb7117a99aac9812502a86d95410989e8e8f303cbcb23d65dc927080d94',
        ];
    }
}
