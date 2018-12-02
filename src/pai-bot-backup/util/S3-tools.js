const AWS = require("aws-sdk");
const fs = require("fs");

const {
    PAILogger
} = require('@pai-tech/pai-code');

AWS.config.update({
    region: "eu-central-1"
});

/**
 * Upload/Download and other functions used when interacting with AWS S3
 */
class S3Tools {
    /**
     * Creates a file stream and then uploads it to S3. objectName could be a
     * file.gz / directory.tar.gz / directory.tgz / etc
     *
     * @param {BackupObject} backupObject =  object to be uploaded
     */
    static uploadToS3(backupObject) {
        //Convert to stream object
        let fileStream = fs.createReadStream(backupObject.key);
        fileStream.on("error", err => {
            PAILogger.info("Error reading file/directory", err);
        });

        //Create S3 service object
        let s3 = new AWS.S3({
            apiVersion: "2006-03-01"
        });
        //The object that is uploaded to S3
        let uploadParams = {
            Bucket: "paibackupjs",
            Key: backupObject.key,
            Body: fileStream
        };

        //Uploads the uploadParams object, and deletes local copy if specified in backupObject
        PAILogger.info("Upload to S3 bucket started...");
        return s3.upload(uploadParams).promise();
    }

    /**
     *  Downloads an object from S3 with the identifier "objectKey", saved with the same
     *  file name/directory name to a "downloadPath" location.
     * @param {BackupObject} backupObject = reference for the object to be downloaded, containing
     *  key (S3 key) and path (location to save to)
     */
    static downloadFromS3(backupObject) {
        const objectKey = backupObject.key;
        const downloadPath = backupObject.path;

        //Create S3 service object
        let s3 = new AWS.S3({
            apiVersion: "2006-03-01"
        });

        const downloadParams = {
            Bucket: "paibackupjs",
            Key: objectKey
        };

        const file = fs.createWriteStream(downloadPath + "/" + objectKey);
        PAILogger.info(`Downloading object ${objectKey}`);
        const s3Promise = s3.getObject(downloadParams).promise();

        s3Promise.then(data => {
            file.write(data.Body, () => {
                file.end();
                PAILogger.info(
                    `${objectKey} downloaded to ${downloadPath} successfully`
                );
            });
        });
        // .catch(err => {
        //     PAILogger.info(err);
        // });
        return s3Promise;
    }




}


module.exports = S3Tools;