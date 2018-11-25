const {
    PAICodeCommand,
    PAICodeCommandContext,
    PAICodeModule,
    PAICode,
    PAIModuleConfigParam,
    PAIModuleConfig,
    PAILogger,
    PAIModuleCommandSchema,
    PAIModuleCommandParamSchema
} = require('@pai-tech/pai-code');

const AWS = require('aws-sdk');
let fs = require('fs');
const BackupTask = require('./src/model/backup-task');

let credentials = new AWS.SharedIniFileCredentials({
    profile: 'personal-account'
});
AWS.config.credentials = credentials;
AWS.config.update({
    region: 'eu-central-1'
});

async function runBackupTask(entity) {
    PAILogger.info('Start backup: ' + entity._id);

    //stubbed
    //insert code to send to s3 here
    // Create S3 service object
    s3 = new AWS.S3({
        apiVersion: '2006-03-01'
    });
    // //arn:aws:s3:::paibackupjs
    let uploadParams = {
        Bucket: 'paibackupjs',
        Key: entity.fileName,
        Body: ''
    };

    let fileStream = fs.createReadStream(entity.fileName);
    fileStream.on('error', (err) => {
        PAILogger.info('Error reading file', err);
    });
    uploadParams.Body = fileStream;

    let putObjectPromise = s3.putObject(uploadParams).promise();
    putObjectPromise.then(function (data) {
        PAILogger.info('Success');
    }).catch(function (err) {
        PAILogger.info(err);
    });

    PAILogger.info('Finish backup ' + entity._id)
}

class PCM_BACKUP extends PAICodeModule {
    constructor() {

        let infoText = `
        Welcome to PAI Backup:
        This module allows a file to be sent to the cloud for secure backup.
        `;

        super(infoText);

        this.config.schema = [
            //PAIModuleConfigParam(label, description, paramName, defaultValue)
            // TODO: add configuration parameters

            //security params ? i.e protecting keys for AWS 

        ];

        let entity = new BackupTask();
        this.data.entities[entity.setEntityName()] = BackupTask;

    }


    /**
     * load basic module commands from super
     * and load all the functions for this module
     */
    async load() {
        await super.load(this);

        this.loadCommandWithSchema(new PAIModuleCommandSchema({
            op: "backup-file",
            func: "backupFile",
            params: {
                "fileName": new PAIModuleCommandParamSchema("fileName", "file to be backed up", true, "file name"),
            }
        }));

    }

    setModuleName() {
        return 'pai-backup';
    }

    /**
     *
     * @param {PAICodeCommand} cmd
     */
    backupFile(cmd) {
        return new Promise(async (resolve, reject) => {

            let entity = new BackupTask();
            entity.fileName = cmd.params.fileName.value;
            await this.data.dataSource.save(entity);

            let result = await runBackupTask(entity);
            resolve(result);
        });
    }
}

module.exports = PCM_BACKUP;