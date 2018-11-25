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

const S3 = require('aws-sdk/clients/s3');
const BackupTask = require('./src/model/backup-task');


async function runBackupTask(entity) {
    PAILogger.info('Start backup: ' + entity._id);

    let filePath = entity.filePath;
    //stubbed
    //insert code to send to s3 here

    PAILogger.info('Finish backup ' + entity._id)
    // }).catch(err => {
    //     PAILogger.error(err);
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
                "filePath": new PAIModuleCommandParamSchema("filePath", "path of file to be backed up", true, "Path to file"),
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
            entity.filePath = cmd.params.filePath.value;
            await this.data.dataSource.save(entity);

            let result = await runBackupTask(entity);
            resolve(result);
        });
    }
}

module.exports = PCM_BACKUP;