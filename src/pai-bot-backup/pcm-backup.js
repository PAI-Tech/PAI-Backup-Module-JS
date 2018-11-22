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

class PCM_BACKUP extends PAICodeModule {
    constructor() {

        let infoText = `
        Welcome to PAI Backup:
        You can write here info text about your module.
        `;

        super(infoText);

        this.config.schema = [
            //PAIModuleConfigParam(label, description, paramName, defaultValue)
            // TODO: add configuration parameters
        ];
    }


    /**
     * load basic module commands from super
     * and load all the functions for this module
     */
    async load() {
        await super.load(this);

        this.loadCommandWithSchema(new PAIModuleCommandSchema({
            op: "func",
            func: "my_func"
        }));

    }

    setModuleName() {
        return 'pai-backup';
    }

    /**
     *
     * @param {PAICodeCommand} cmd
     */
    my_func(cmd) {
        return new Promise((resolve, reject) => {
            return resolve('Hello World');
        });
    }


}

module.exports = PCM_BACKUP;