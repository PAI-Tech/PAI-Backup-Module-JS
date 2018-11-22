const {
    PAIEntity
} = require('@pai-tech/pai-code');



class BackupTask extends PAIEntity {


    constructor() {
        super();

        // this.intervalPattern = null;
        this.paiCodeToExecute = null;
        this.isActive = null;
    }

    setEntityName() {
        return 'backup_task';
    }
}


module.exports = BackupTask;