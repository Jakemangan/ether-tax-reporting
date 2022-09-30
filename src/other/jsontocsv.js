var fs = require("fs");
let converter = require('json-2-csv');


run = async () => {
    var file = JSON.parse(fs.readFileSync(__dirname + "/2022.json", 'utf8'));

    let csv = await converter.json2csvAsync(file, () => {});

    fs.writeFileSync("csv-output-2022.csv", csv);
}

run();