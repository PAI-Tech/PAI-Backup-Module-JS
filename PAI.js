const {
    PAICodeCommand,
    PAICodeCommandContext,
    PAICodeModule,
    PAICode
} = require("@pai-tech/pai-code");

const {
    PAIBotModule,
    PAIBotManager,
    PAIBot,
    PAIBotStatus
} = require("@pai-tech/pai-bot");

const {
    Module
} = require("./index");

async function start() {
    let module = new Module();
    await module.registerModule(); // register the module to PAICode

    let context = new PAICodeCommandContext("host", "HardCoded");
    
    //backup-file tests
    
    await PAICode.executeString(`
    pai-backup config param_name:"S3_BUCKET" param_value:"paibackupjs"
    pai-backup config param_name:"S3_KEY" param_value:"./aws_config.json"
    `, context);
    
    
    let response = await PAICode.executeString(`pai-backup backup-file path:"test_data/catroon.png"`, context);
    //let response = await PAICode.executeString(`pai-backup backup-file name:"file3.txt" path:"` + __dirname + `/test_data/data/file3.txt"`, context);
    //let response = await PAICode.executeString(`pai-backup backup-file name:"backup03-12-18" path:"` + __dirname + `/test_data/data/file3.txt"`, context);
    //let response = await PAICode.executeString(`pai-backup backup-file path:"` + __dirname + `/test_data/data/file3.txt"`, context);
    
    //backup-directory tests
    //let response = await PAICode.executeString(`pai-backup backup-directory name:"data" path:"` + __dirname + `/test_data/data"`, context);
    //let response = await PAICode.executeString(`pai-backup backup-directory path:"` + __dirname + `/test_data/data"`, context);

    //download-backup tests
    //let response = await PAICode.executeString(`pai-backup download-backup key:"file2.txt.gz" path:"` + __dirname + `"`, context);
    //let response = await PAICode.executeString(`pai-backup download-backup key:"data.tgz" path:"` + __dirname + `"`, context);
    //let response = await PAICode.executeString(`pai-backup download-backup key:"data.tgz"`, context);

    //keepLocalCopy param tests
    //let response = await PAICode.executeString(`pai-backup backup-file path:"test_data/file2.txt" keepLocalCopy:"true"`, context);
    //let response = await PAICode.executeString(`pai-backup backup-file path:"test_data/file2.txt" keepLocalCopy:"false"`, context);
    //let response = await PAICode.executeString(`pai-backup backup-directory name:"data" path:"` + __dirname + `/test_data/data" keepLocalCopy:"true"`, context);
    //let response = await PAICode.executeString(`pai-backup backup-directory name:"data" path:"` + __dirname + `/test_data/data" keepLocalCopy:"false"`, context);

    //error handling & edge case testing:
    //let response = await PAICode.executeString(`pai-backup backup-file name:"p.txt" path:"test_data/p.txt"`);
    //let response = await PAICode.executeString(`pai-backup backup-file name:"file3.txt" path:"datap"`);
    //let response = await PAICode.executeString(`pai-backup backup-directory name:"" path:"/notarealdirectory"`)
    //let response = await PAICode.executeString(`pai-backup backup-directory name:"data" keepLocalCopy:"true"`, context);
    //let response = await PAICode.executeString(`pai-backup download-backup key:"datap.tgz" path:"` + __dirname + `"`, context);
    //let response = await PAICode.executeString(`pai-backup download-backup key:"datap.tgz"`, context);

    let toPrint = JSON.stringify(response[0].response.data);
    console.log(toPrint);

    PAICode.start();
}

start()
    .then()
    .catch(e => {
        console.log(e);
    });