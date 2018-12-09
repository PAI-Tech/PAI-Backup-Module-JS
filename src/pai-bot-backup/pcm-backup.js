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
} = require("@pai-tech/pai-code");

const { BackupObject } = require("./src/model/backup-object");

const ZipTools = require("./util/zip-tools.js");
const BackupService = require("./util/backup-service.js");
const path = require("path");

//service param: "PAI_HTTP" / "S3"
let CONFIG_BACKUP_SERVICE = "BACKUP_SERVICE";

//S3 params
let CONFIG_S3_BUCKET = "S3_BUCKET",
    CONFIG_CREDENTIALS_PATH = "S3_CREDENTIALS_PATH";

//HTTP params
let CONFIG_PAI_HTTP_URl = "PAI_HTTP_URl";

class PCM_BACKUP extends PAICodeModule {
    constructor() {
        let infoText = `
        Welcome to PAI Backup:
        This module allows a file/directory to be sent to the cloud for secure backup.
        Current available services: AWS (S3) cloud storage, PAI (HTTP) file service.

        ---AWS S3 CONFIG---
        1/ Configure the module to point to this service by running:
            'pai-backup config param_name:"BACKUP_SERVICE" param_value:"S3"'

        2/ Specify a JSON credentials file with the AWS keys to be used for accessing S3.
            'pai-backup config param_name:"S3_CREDENTIALS_PATH" param_value:"./aws_config.json"'
        The JSON file should follow this format:
            '{ "accessKeyId": "XXXXXXXXXXXXX", "secretAccessKey": "XXXXXXXXXXXXX", "region": "region-id" }'
        (See https://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/loading-node-credentials-json-file.html for more information)

        3/ Specify a bucket to be used for upload (with access permissions from the keys specified above)
            'pai-backup config param_name:"S3_BUCKET" param_value:"paibackupjs"'
        

        ---PAI HTTP CONFIG---
        1/ Configure the module to point to this serfvice by running:
            'pai-backup config param_name:"BACKUP_SERVICE" param_value:"PAI_HTTP"'

        2/ Specify the base URL for PAI's File Service. For example, 
            'pai-backup config param_name:"PAI_HTTP_URl" param_value:"http://localhost:3000"'


        ---USING THE MODULE---
        There are three available commands in the pai-backup module.

        1/ To backup a file, use the 'backup-file' command with the following parameters:
            'path' : An absolute or relative path to the file to be backed up. The file will be zipped into a .gz format
            (optional) 'name' : The output name of the zipped file. For example ('Backup31-01-2019'). The file's name by default.
            (optional) 'keepLocalCopy' ['true'/'false'] : Whether or not to save the zipped file locally (in addition to remotely). False by default.

        2/ To backup a directory, use the 'backup-directory' command with the following parameters:
            'path' : An absolute or relative path to the directory to be backed up. The directory will be zipped into a .tgz format
            (optional) 'name' : The output name of the zipped directory. For example ('Backup31-01-2019'). The directory's name by default.
            (optional) 'keepLocalCopy' ['true'/'false'] : Whether or not to save the zipped directory locally (in addition to remotely). False by default.

        3/ To download a backup, use the 'download-backup' command with the following parameters.
            'key' : For S3, use the name of the zipped file stored on S3, for example 'Backup31-01-2019.tgz' for a zipped directory with the name 'Backup31-01-2019'.
                    For PAI HTTP, use the 'cdn_key' returned when the upload was originally done.
            (optional) 'path' : The download location for storing the backup object locally. Current directory by default. 
        `;

        super(infoText);

        this.config.schema = [
            //PAIModuleConfigParam(label, description, paramName, defaultValue)
            new PAIModuleConfigParam("s3 bucket name", "enter your s3 bucket", CONFIG_S3_BUCKET),
            new PAIModuleConfigParam("aws credentials file", "enter the path to your aws credentials", CONFIG_CREDENTIALS_PATH),

            new PAIModuleConfigParam("backup service", "enter the service to be used for backup", CONFIG_BACKUP_SERVICE)
        ];
    }

    /**
     * load basic module commands from super
     * and load all the functions for this module
     */
    async load() {
        await super.load(this);

        this.loadCommandWithSchema(
            new PAIModuleCommandSchema({
                op: "backup-file",
                func: "backupFile",
                params: {
                    name: new PAIModuleCommandParamSchema(
                        "name",
                        "name of backup",
                        false,
                        "name of backup object"
                    ),
                    //path to file
                    path: new PAIModuleCommandParamSchema(
                        "path",
                        "path to file",
                        true,
                        "file path",
                        ""
                    ),
                    keepLocalCopy: new PAIModuleCommandParamSchema(
                        "keepLocalCopy",
                        "whether or not to keep a backup copy locally",
                        false,
                        "keep a local copy"
                    )
                }
            })
        );

        this.loadCommandWithSchema(
            new PAIModuleCommandSchema({
                op: "backup-directory",
                func: "backupDirectory",
                params: {
                    name: new PAIModuleCommandParamSchema(
                        "name",
                        "name of backup",
                        false,
                        "name of backup object"
                    ),
                    //path to directory
                    path: new PAIModuleCommandParamSchema(
                        "path",
                        "path to directory",
                        true,
                        "directory path",
                    ),
                    keepLocalCopy: new PAIModuleCommandParamSchema(
                        "keepLocalCopy",
                        "whether or not to keep a backup copy locally",
                        false,
                        "keep a local copy"
                    )
                }
            })
        );

        this.loadCommandWithSchema(
            new PAIModuleCommandSchema({
                op: "download-backup",
                func: "downloadBackup",
                params: {
                    key: new PAIModuleCommandParamSchema(
                        "key",
                        "key of backup on S3",
                        true,
                        "key string"
                    ),
                    path: new PAIModuleCommandParamSchema(
                        "path",
                        "path to store backup object",
                        false,
                        "path to download backup object to"
                    )
                }
            })
        );
        
    }

    setModuleName() {
        return "pai-backup";
    }

    /**
     * @param {PAICodeCommand} cmd
     */
    backupFile(cmd) {
        return new Promise(async (resolve, reject) => {
            let entity = new BackupObject();
            entity.path = cmd.params.path.value;
            //if name wasn't given in the pai-code params, take it from the path param
            entity.name =
                cmd.params.name == null ?
                path.basename(entity.path) :
                cmd.params.name.value;
            entity.key = entity.name + ".gz";

            await this.data.dataSource.save(entity);

            try {
                //zip file, passing in a data object containing path to file and its name
                await ZipTools.zipFile(entity);
                PAILogger.info("Finished zipping file.");

                //branch based on the chosen backup service
                let backupService = await this.config.getConfigParam(CONFIG_BACKUP_SERVICE);
                let response = "";
                if (backupService === "S3") {
                    //upload to S3
                    let bucketName = await this.config.getConfigParam(CONFIG_S3_BUCKET);
                    let credentialsPath = await this.config.getConfigParam(CONFIG_CREDENTIALS_PATH);
                    await BackupService.uploadToS3(entity, bucketName, credentialsPath);
                    PAILogger.info("Upload to S3 bucket successful. Key: " + entity.key);
                } else if (backupService === "PAI_HTTP") {
                    //send to PAI
                    let url = await this.config.getConfigParam(CONFIG_PAI_HTTP_URl) 
                        + "/add-file";
                    response = await BackupService.postHTTP(entity, url);
                    PAILogger.info("Upload to PAI File Service successful. CDN Key: " + response);
                }

                //keep a local copy or not
                let keepLocalCopy =
                    (cmd.params.keepLocalCopy == null) ?
                    "false" :
                    cmd.params.keepLocalCopy.value;
                if (keepLocalCopy == "false") {
                    await ZipTools.deleteFromLocal(entity.key);
                    PAILogger.info("Local copy deleted");
                }
                resolve("Backup complete.");
            } catch (e) {
                PAILogger.info("Error during backup: " + e);
                reject(e)
            }
        });
    }

    /**
     * @param {PAICodeCommand} cmd
     */
    backupDirectory(cmd) {
        return new Promise(async (resolve, reject) => {
            let entity = new BackupObject();
            entity.path = cmd.params.path.value;
            //if name wasn't given in the pai-code params, take it from the path param
            entity.name =
                cmd.params.name == null ?
                path.basename(entity.path) :
                cmd.params.name.value;
            entity.key = entity.name + ".tgz";

            await this.data.dataSource.save(entity);

            try {
                //zip directory, passing in the data object
                //containing path to the directory and the output name (entity.key)
                await ZipTools.zipDirectory(entity);
                PAILogger.info("Finished zipping directory.");

                //branch based on the chosen backup service
                let backupService = await this.config.getConfigParam(CONFIG_BACKUP_SERVICE);
                if (backupService === "S3") {
                    //upload to S3
                    let bucketName = await this.config.getConfigParam(CONFIG_S3_BUCKET);
                    let credentialsPath = await this.config.getConfigParam(CONFIG_CREDENTIALS_PATH);
                    await BackupService.uploadToS3(entity, bucketName, credentialsPath);
                    PAILogger.info("Upload to S3 bucket successful. Key: " + entity.key);
                } else if (backupService === "PAI_HTTP") {
                    //send to PAI
                    let url = await this.config.getConfigParam(CONFIG_PAI_HTTP_URl) 
                        + "/add-file"; 
                    let response = await BackupService.postHTTP(entity, url);
                    PAILogger.info("Upload to PAI File Service successful. CDN Key: " + response);
                }

                //store a local backup or not, false by default
                let keepLocalCopy =
                    (cmd.params.keepLocalCopy == null) ?
                    "false" :
                    cmd.params.keepLocalCopy.value;
                if (keepLocalCopy == "false") {
                    await ZipTools.deleteFromLocal(entity.key);
                    PAILogger.info("Local copy deleted");
                }
                resolve("Backup complete.");
            } catch (err) {
                PAILogger.info("Error during backup: " + err);
                reject(err);
            };
        });
    }

    /**
     * @param {PAICodeCommand} cmd
     */
    downloadBackup(cmd) {
        return new Promise(async (resolve, reject) => {
            let entity = new BackupObject();
            entity.key = cmd.params.key.value;
            //if path wasn't given in the pai-code params, use this directory as a default
            entity.path = (cmd.params.path == null) ?
                "./" :
                cmd.params.path.value;

            await this.data.dataSource.save(entity);

            try {
                //branch based on the chosen backup service
                let backupService = await this.config.getConfigParam(CONFIG_BACKUP_SERVICE);
                if (backupService === "S3") {                
                    //download object from S3
                    let bucketName = await this.config.getConfigParam(CONFIG_S3_BUCKET);
                    let credentialsPath = await this.config.getConfigParam(CONFIG_CREDENTIALS_PATH);
                    await BackupService.downloadFromS3(entity, bucketName, credentialsPath);
                } else if (backupService === "PAI_HTTP") {
                    //get from PAI
                    let url = await this.config.getConfigParam(CONFIG_PAI_HTTP_URl) 
                        + "/get-file"
                        + "?cdn_key="  
                        + entity.key;
                    await BackupService.getHTTP(entity, url);
                    PAILogger.info("Download from PAI File Service successful");
                }
                resolve("Download complete.");
            } catch (e) {
                PAILogger.info("Error during download: " + e);
                reject(e);
            }
        });
    }

}

module.exports = PCM_BACKUP;