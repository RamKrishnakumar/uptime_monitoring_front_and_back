/**
 * Library for storing and rotating logs
 */

//Dependencies
var fs = require('fs');
var path = require('path');
var zlib = require('zlib');
var _data = require('./data');

//Container for the module
var lib = {};

// Base Directory of the logs folder
lib.baseDir = path.join(__dirname,'/../.logs/');

// Append a string to a file. Create the file if it does not exist.
/**
 * 
 * @param {*} file 
 * @param {*} str 
 * @param {*} callback 
 */
lib.append = (file,str,callback)=>{
//Open the file for appending
fs.open(lib.baseDir+file+'.logs','a',(err,fileDescriptor)=>{
    if(!err && fileDescriptor){
        //Append to the file and close it
        fs.appendFile(fileDescriptor,str+'\n',(err)=>{
            if(!err){
                fs.close(fileDescriptor,(err)=>{
                    if(!err){
                        callback(false);
                    }
                    else{
                        callback("Error closing file that is being appending");
                    }
                });
            }
            else{
                callback('Error appending the file');
            }
        });
    }
    else{
        callback('Could not open file for appending');
    }
});
}

//List all the logs, and optionally inclue the compressed logs
/**
 * 
 * @param {*} icludeCompressedLogs 
 * @param {*} callback 
 */
lib.list = (includeCompressedLogs, callback) =>{
fs.readdir(lib.baseDir,(err,data)=>{
    if(!err && data && data.length > 0){
      var trimmedFileNames = [];
      data.forEach((fileName)=>{
          //Add the .log files
          if(fileName.indexOf('.logs') > -1){
            trimmedFileNames.push(fileName.replace('.logs',''));
          }
        
          //Add on the .gz.b64 files
          if(fileName.indexOf('.gz.b64')> -1 && includeCompressedLogs){
            trimmedFileNames.push(fileName.replace('.gz.b64'),'');
          }
      });
      callback(false,trimmedFileNames);
    }
    else{
      callback(err,data);
    }
});
}

//Compress the contents of one .log file into .gz.b64 file within the same directory
/**
 * 
 * @param {*} logId 
 * @param {*} newFileId 
 * @param {*} callback 
 */
lib.compress = (logId,newFileId,callback)=>{
  var sourceFile = logId+'.logs';
  var destFile = newFileId+'.gz.b64';

  // Read the source file
  fs.readFile(lib.baseDir+sourceFile,'utf8',(err,inputString)=>{
      
      if(!err && inputString){
         //compress the data with gzip
         zlib.gzip(inputString,(err,buffer)=>{
             if(!err && buffer){
                 // Send the data to the destination file
                 fs.open(lib.baseDir+destFile,'wx', (err,fileDescriptor)=>{
                     if(!err && fileDescriptor){
                         //Write to the destinatin file
                         fs.writeFile(fileDescriptor,buffer.toString('base64'),(err)=>{
                             if(!err){
                                 //Closing the destination file
                                 fs.close(fileDescriptor,(err)=>{
                                     if(!err){
                                         callback(false);
                                     }
                                     else{
                                         callback(err);
                                     }
                                 });
                             }
                             else{
                                 callback(err);
                             }
                         });
                     }
                     else{
                         callback(err);
                     }
                 });
             }
             else{
                 callback(err);
             }
         });
      }
      else{
          callback(err);
      }
  });
}

//Decompress the contents of a .gs.b64 file into a string varaibale
/**
 * 
 * @param {*} fileId 
 * @param {*} callback 
 */
lib.decompress = (fileId, callback)=>{
  var fileName = fileId+'.gs.b64';
  fs.readFile(lib.baseDir+fileName,'utf8',(err,str)=>{
      if(!err && str){
          //Decompress the data
          var inputBuffer = Buffer.from(str,'base64');
          zlib.unzip(inputBuffer,(err,outputBuffer)=>{
              if(!err && outputBuffer){
                  //callback
                  var str = outputBuffer.toString();
                  callback(false,str);
              }
              else{
                  callback(err);
              }
          });
      }
      else{
          callback(err);
      }
  });
}

//Truncate a log file
/**
 * 
 * @param {*} logId 
 * @param {*} callback 
 */
lib.truncate = (logId,callback)=>{
    fs.truncate(lib.baseDir+logId+'.logs',0,(err)=>{
        if(!err){
             callback(false);
        }
        else{
            callback(err);
        }
    });
};




//Export the module
module.exports = lib;