const AWS = require("aws-sdk");
const fs = require("fs");

const contentDisposition = require("content-disposition");
const axios = require("axios");
const FormData = require("form-data");

const {
    PAILogger
} = require('@pai-tech/pai-code');

AWS.config.update({
    region: "eu-central-1"
});

/**
 * Upload/Download and other functions used when interacting with a service provider (i.e AWS S3)
 */
class BackupService {
    
    /**
     * Creates a file stream and then uploads it to S3. objectName could be a
     * file.gz / directory.tar.gz / directory.tgz / etc
     *
     * @param {BackupObject} backupObject =  object to be uploaded
     * @param {String} bucketName =  name of bucket on S3
     * @param {String} credentialsPath =  path to load AWS credentials from
     */
    static uploadToS3(backupObject, bucketName, credentialsPath) {
        //Convert to stream object
        let fileStream = fs.createReadStream(backupObject.key);
        fileStream.on("error", err => {
            PAILogger.info("Error reading file/directory", err);
        });

        //Create S3 service object
        AWS.config.loadFromPath(credentialsPath);
        let s3 = new AWS.S3({
            apiVersion: "2006-03-01"
        });
        //The object that is uploaded to S3
        let uploadParams = {
            Bucket: bucketName,
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
     * @param {String} bucketName =  name of bucket on S3
     * @param {String} credentialsPath =  path to load AWS credentials from
     */
    static downloadFromS3(backupObject, bucketName, credentialsPath) {
        const objectKey = backupObject.key;
        const downloadPath = backupObject.path;

        //Create S3 service object
        AWS.config.loadFromPath(credentialsPath);
        let s3 = new AWS.S3({
            apiVersion: "2006-03-01"
        });

        const downloadParams = {
            Bucket: bucketName,
            Key: objectKey
        };

        PAILogger.info(`Downloading object ${objectKey}`);
        //Download
        const s3Promise = s3.getObject(downloadParams).promise();

        //Write to file
        const file = fs.createWriteStream(downloadPath + "/" + objectKey);
        s3Promise.then(data => {
            file.write(data.Body, () => {
                file.end();
                PAILogger.info(
                    `${objectKey} downloaded to ${downloadPath} successfully`
                );
            });
        })
        .catch(err => {
            PAILogger.info(err);
        });
        return s3Promise;
    }

    /**
     * Takes a full url and submits the object via HTTP 
     * as a stream body of a POST request.
     * @param {BackupObject} backupObject = object to be uploaded
     * @param {String} url = url (with endpoint) to send request incl. file
     */
    static postHTTP(backupObject, url) {
        //Read in file
        let fileStream = fs.createReadStream(backupObject.key);
        fileStream.on("error", err => {
            PAILogger.info("Error reading file/directory", err);
            return Promise.reject(err);
        });
        return new Promise(async (resolve, reject) => {
            //Prepare the request body
            let form = new FormData();
            form.append('pai_file', fileStream);
            PAILogger.info(`Uploading object ${backupObject.key}`);
            //POST request
            axios.post(
                url,
                form,
                { headers : form.getHeaders() }
            ).then ( response => {
                PAILogger.info('Upload via HTTP POST successful');
                //Record the cdn_key in the JSON response
                resolve(response.data['cdn_key']);
            }).catch( error => {
                PAILogger.info('Upload failed: ' + error);
                reject(error);
            });
        });
    }

    /**
     * Takes a full url (with endpoint and parameter query) and writes the server response 
     * body to a file stream (with a specified path).
     * @param {BackupObject} backupObject = object to be downloaded (requires backupObject.key is a cdn key)
     * @param {String} url = url (with endpoint) to send request incl. cdn key
     */
    static getHTTP(backupObject, url) {
        return new Promise( async (resolve, reject) => {
            //GET request
            axios({
                method:'get',
                url: url,
                responseType:'stream',
                timeout : 60000
            })
            .then(response => {
                //get filename from the content disposition header
                let filename = contentDisposition.parse(
                    response.headers["content-disposition"]
                ).parameters.filename;
                //write to file
                response.data.pipe(
                    fs.createWriteStream(backupObject.path + "/" + filename)
                );
                PAILogger.info(
                    `Object with cdn_key "${backupObject.key}" downloaded to ${backupObject.path} successfully`
                );
                resolve("Object downloaded successfully.");
            }).catch(err => {
                PAILogger.info(err);
                reject(err);
            });
        });
    }
}

module.exports = BackupService;