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
    // let response = await PAICode.executeString(
    //     `pai-backup backup-file name:"file2.txt"`,
    //     context
    // );
    //let response = await PAICode.executeString(`pai-backup backup-file name:"file3.txt" path:"` + __dirname + `/data"`, context);
    // let response = await PAICode.executeString(
    //     `pai-backup backup-directory name:"data" path:"` + __dirname + `/data"`,
    //     context
    // );
    //let response = await PAICode.executeString(`pai-backup backup-directory path:"` + __dirname + `/data"`, context);
    //let response = await PAICode.executeString(`pai-backup download-backup key:"file2.txt.gz" path:"` + __dirname + `"`, context);
    //let response = await PAICode.executeString(`pai-backup download-backup key:"data.tgz" path:"` + __dirname + `"`, context);

    //keepLocalCopy
    //let response = await PAICode.executeString(`pai-backup backup-file name:"file2.txt" keepLocalCopy:"true"`, context);
    //let response = await PAICode.executeString(`pai-backup backup-file name:"file2.txt" keepLocalCopy:"false"`, context);
    //let response = await PAICode.executeString(`pai-backup backup-directory name:"data" path:"` + __dirname + `/data" keepLocalCopy:"true"`, context);
    //let response = await PAICode.executeString(`pai-backup backup-directory name:"data" path:"` + __dirname + `/data" keepLocalCopy:"false"`, context);

    //error handling & edge case testing:
    //let response = await PAICode.executeString(`pai-backup backup-file name:"p.txt" path:"data"`);
    //let response = await PAICode.executeString(`pai-backup backup-file name:"file3.txt" path:"datap"`);
    //let response = await PAICode.executeString(`pai-backup backup-directory name:"" path:"/notarealdirectory"`)

    let toPrint = JSON.stringify(response[0].response.data);
    console.log(toPrint);

    PAICode.start();
}

start()
    .then()
    .catch(e => {
        console.log(e);
    });