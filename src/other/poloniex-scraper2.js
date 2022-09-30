const { mkdir } = require("fs");
var fetch = require("node-fetch");
var fs = require("fs").promises;
// import { promises as fs } from 'fs';

run = async () => {
    console.log("Running Poloniex scraper");

    var month = 0; // January

    let year = 2022
    // let timestamps = [];
    // for(let i = 0; i < 13; i++){
    //     var d = new Date(year, i, 1);
    //     let dateString = `Start of ${i+1}-` + year;
    //     let timestamp = Math.floor(d.getTime() / 1000)
    //     // console.log(d + " - " +timestamp);
    //     timestamps.push({
    //         date: d,
    //         timestamp: timestamp
    //     });
    // }
    
    var now = new Date();
    var daysOfYear = [];
    var timestampsOfEachDayInYear = [];
    for (var d = new Date(2022, 0, 1); d <= now; d.setDate(d.getDate() + 1)) {
        // daysOfYear.push(new Date(d));
        const timestampInSeconds = Math.floor(d.getTime() / 1000);
        timestampsOfEachDayInYear.push({
                    date: d,
                    timestamp: timestampInSeconds
                });
    }

    let allData = [];
    for(let i = 0; i < timestampsOfEachDayInYear.length; i++){
        if(i === 365){
            continue;
        }
        
        console.log(i);
        let start = timestampsOfEachDayInYear[i].timestamp;
        let startDate = timestampsOfEachDayInYear[i].date;
        let end = timestampsOfEachDayInYear[i+1].timestamp;
        let endDate = timestampsOfEachDayInYear[i+1].date;

        var startDateObj = new Date(start * 1000);
        var endDateObj = new Date(end * 1000);


        /*
        *   BNB url
        */
        let url = `https://poloniex.com/public?command=returnChartData&currencyPair=USDT_BNB&start=${(start+"000")}&end=${(end+"000")}&period=300`
        console.log(url);

        /*
        * Eth URL below
        */
        //let url = `https://poloniex.com/public?command=returnChartData&currencyPair=USDT_BNB&start=${start}&end=${end}&period=300`
        let data = await (await fetch(url)).json();

        for(let i = 0; i < data.length;i++){
            if(i === data.length-1){
                continue;
            }
            try {
                let date1 = data[i].date;
                let date2 = data[i+1].date;
                if(date1 && date2){
                    let dif = date2 - date1;
                    if(dif !== 300000){
                        throw new Error("Bad dates - " + date1 + " / " + date2);
                    }
                } else {
                    console.log(date1);
                    console.log(date2);
                }    
            } catch (error) {
                console.log("Ended at " + i);
            }
            
        }
        console.log("Passed timestamp diff");

        allData = allData.concat(data);
        
        let filename = `${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`;
        filename = filename.replace(/\//g, '-');
        
        // await mkdir("./assets/bnb-historical-prices/" + year + "/" + i + " " + filename);
        // await fs.writeFile(__dirname + "/assets/bnb-historical-prices/" + year + "/" + i + " " + filename, JSON.stringify(data), { flag: 'a'});
        // await fs.writeFile(__dirname + "/bnb-historical-prices/" + year + "/" + i + " " + filename, JSON.stringify(data));

        console.log(allData.length);
    }

    console.log(allData.length);
    // await mkdir("./assets/bnb-historical-prices/" + year + "-all");
    await fs.writeFile("./assets/bnb-historical-prices/" + year + "-all", JSON.stringify(allData), { flag: 'a'});
}

run();