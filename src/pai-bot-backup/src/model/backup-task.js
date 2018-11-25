const {
    PAIEntity
} = require('@pai-tech/pai-code');



class BackupTask extends PAIEntity {


    constructor() {
        super();

        //path to file
        this.filePath = null;
    }

    setEntityName() {
        return 'backup_task';
    }
}


module.exports = BackupTask;