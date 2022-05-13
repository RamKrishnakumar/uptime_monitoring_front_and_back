/**
 * Worker-related tasks
 */

//Dependencies

var path = require('path');
var fs = require('fs');
var _data = require('./data');
var https = require('https');
var http = require('http');
var helpers = require('./helpers');
var url = require('url');
var sendSms = require('./twilio');
var _logs = require('./logs');
var util = require('util');
var debug = util.debuglog('workers');


//Instantiate the worker object
var workers = {};

// lookup all chek get their data send to validator
workers.gatherAllChecks = function(){
    //Get all checks
    _data.list('checks',function(err,checks){
        if(!err && checks && checks.length > 0){
           checks.forEach(check => {
               //Read in check data
               _data.read('checks',check,function(err,originalCheckData){
                  if(!err && originalCheckData){
                     //Pass the data to the check validator , and let that functiont to continue or log err
                     workers.validateCheckData(originalCheckData);
                  }
                  else{
                      debug("Error reading one of the checks");
                  }
               });
           });
        }
        else{
            debug("Error: Could not find any checks to process");
        }
    });
}

//Sanity-checking the check-data
workers.validateCheckData = function(originalCheckData){
  originalCheckData = typeof(originalCheckData) == 'object' && originalCheckData != null ? originalCheckData : {};
  originalCheckData.id = typeof(originalCheckData.id) == 'string' && originalCheckData.id.trim().length == 20 ? originalCheckData.id.trim() : false;
  originalCheckData.userPhone = typeof(originalCheckData.userPhone) == 'string' && originalCheckData.userPhone.trim().length == 10 ? originalCheckData.userPhone : false;
  originalCheckData.protocol = typeof(originalCheckData.protocol) == 'string' && ['https','http'].indexOf(originalCheckData.protocol) > -1 ? originalCheckData.protocol : false;
  originalCheckData.url    = typeof(originalCheckData.url) == 'string' && originalCheckData.url.trim().length > 0 ? originalCheckData.url : false;
  originalCheckData.method = typeof(originalCheckData.method) == 'string' && ['put','post','delete','get'].indexOf(originalCheckData.method) > -1 ? originalCheckData.method : false;
  originalCheckData.successCodes = originalCheckData.successCodes instanceof Array && originalCheckData.successCodes.length > 0 ? originalCheckData.successCodes : false;
  originalCheckData.timeOutSeconds = typeof(originalCheckData.timeOutSeconds) == 'number' && originalCheckData.timeOutSeconds % 1 === 0 && originalCheckData.timeOutSeconds >=1 && originalCheckData.timeOutSeconds <=5 ? originalCheckData.timeOutSeconds : false;

  //Set the Keys that may not be set(if the workers have never seen this check before)
  originalCheckData.state =  typeof(originalCheckData.state) == 'string' && ['up','down'].indexOf(originalCheckData.state) > -1 ? originalCheckData.state : 'down';
  originalCheckData.lastChecked = typeof(originalCheckData.lastChecked) == 'number' && originalCheckData.lastChecked > 0 ? originalCheckData.lastChecked : false;

  // if all the checks pass, pass the data along to the next stop in the processlib
  if(originalCheckData.id && 
    originalCheckData.userPhone && 
    originalCheckData.protocol && 
    originalCheckData.url && 
    originalCheckData.method &&
    originalCheckData.successCodes &&
    originalCheckData.timeOutSeconds ){
     workers.performCheck(originalCheckData);
    }
    else{
        debug('Error: one of the checkes in not formatted . Skipping it');
    }
}

//Perform the check, send the originalcheckdata and the outcome of the check process to the next process in step
workers.performCheck = function(originalCheckData) {
    //prepare the initial check outcome
    var checkOutcome = {
        'error': false,
        'responseCode': false,
    };

    //markup the outcome has not been sent yet
    var outcomeSent = false;

    //Parse the hostname and the path out of the originalcheckData
    var parsedUrl = url.parse(originalCheckData.protocol+'://'+originalCheckData.url,true);

    var hostname = parsedUrl.hostname;
    var path = parsedUrl.path; // Using path not 'pathname' because we want the queryString;

    //contruct the request
    var requestDetails = {
        'protocol': originalCheckData.protocol + ':',
        'hostname': hostname,
        'method': originalCheckData.method.toUpperCase(),
        'path' : path,
        'timeout': originalCheckData.timeOutSeconds * 1000
    }

    //Instantiate the rquest object using either the http or https module 
    //http
    var _moduleToUse = originalCheckData.protocol == 'http' ? http: https;

    var req = _moduleToUse.request(requestDetails,(res)=>{
     //Grab the status of the sent request
     var status = res.statusCode;

     //update the checkoutcome and pass the data along
     checkOutcome.responseCode = status;
     if(!outcomeSent){
       workers.processCheckOutcome(originalCheckData,checkOutcome);
       outcomeSent = true;
     }
    });

    //Bind to the error event so it doesn't get thrown
    req.on('error', function (e) {
        //update the checkOutcome and pass the data along
        checkOutcome.error = {
            'error' : true,
            'value' : e
        };
        if(!outcomeSent){
            workers.processCheckOutcome(originalCheckData,checkOutcome);
            outcomeSent = true;
        }
    });

    //Bind to the timeout event
    req.on('timeout',function(e){
        checkOutcome.error = {
            'error': true,
            'value': 'timeout'
        };
        if(!outcomeSent){
            workers.processCheckOutcome(originalCheckData,checkOutcome);
            outcomeSent = true;
        }
    });

    //End the request
    req.end();

}


// TO PROCESS the checkOutcome and update the checkData as nedd and trigger the alert to user if needed
// Special login for accomodating a check that has never been tested before (don't want to alert on that);
workers.processCheckOutcome = function(originalCheckData,checkOutcome) {
  //Decide if the check is considere up or down
  var state = !checkOutcome.error && checkOutcome.responseCode && originalCheckData.successCodes.indexOf(checkOutcome.responseCode) > -1 ? 'up': 'down';

  //Decide if an alert is warranted
  var alertWarrented = originalCheckData.lastChecked && originalCheckData.state != state ? true : false;

//Log the Outcome of the check
var timeOfCheck = Date.now();
workers.log(originalCheckData, checkOutcome,state,alertWarrented,timeOfCheck);

  //update the check Data
  var newCheckData = originalCheckData;
  newCheckData.state = state;
  newCheckData.lastChecked = Date.now();



  //save the data
  _data.update('checks',newCheckData.id, newCheckData, function(err){
      if(!err){
         //Send the new check date to next phase if needed
         if(alertWarrented){
            workers.alertUserToStatusChange(newCheckData);
         }
         else{
             debug('Check outcome has not changed, no alert needed');
         }
      }
      else{
          debug("Error trying to save updated to one of he checks");
      }
  })
};


//Alert the user and to ac change in their check status
workers.alertUserToStatusChange = function(newCheckData){
    var msg = 'Alert: Your check for ' + newCheckData.method.toUpperCase()+' '+newCheckData.protocol+'://'+newCheckData.url+' is currently '+ newCheckData.state;
    sendSms(newCheckData.userPhone,msg,(response)=>{
        // console.log(response);
        if(!response.code){
            debug("Success: User was alerted to a status change in their check via sms",msg);
          }
          else{
              debug(response.message);
          }
    });
    
}

workers.log =function(originalCheckData, checkOutcome,state,alertWarrented,timeOfCheck){
   //for the log data
   var logData = {
       'check': originalCheckData,
       'outcome': checkOutcome,
       'state': state,
       'alert': alertWarrented,
       'time': timeOfCheck
   };

   //Convert data to a String
   var logString = JSON.stringify(logData);

   //Determine the name of log file
   var logFileName = originalCheckData.id;

   //Append the log string to the file
   _logs.append(logFileName, logString, function(err){
       if(!err){
           debug("Logging to file is succeeded");
       }
       else{
           debug("Logging to file failed");
       }

   });
}

//Timer to execute worker process once per minute
workers.loop = function(){
    setInterval(function(){
      workers.gatherAllChecks();
    },1000 * 60);
};

//Rotate (compress) the log files
workers.rotateLogs = ()=>{
    //List all the (non compressed ) log files
    _logs.list(false,(err,logs)=>{
       if(!err && logs && logs.length > 0) {
          logs.forEach((logName)=>{
              //compress the data to a diffrent file
              var logId = logName.replace('.logs','');
              var newFileId = logId+'-'+Date.now();

              _logs.compress(logId,newFileId,(err)=>{
                  if(!err){
                      //Truncating the log or clean the compress log file from .logs
                      _logs.truncate(logId,(err)=>{
                          if(!err){
                              debug("Success: truncating log file");
                          }
                          else{
                              debug("Error truncating log file");
                          }
                      });
                  }
                  else{
                      debug("Error: Compressing one of the file ");
                  }
              })
          })
       }
       else{
           debug("Error: could not find any logs to rotate")
       }
    })
}

//Timer to execute the log-rotation once per day
workers.logRotationLoop = ()=>{
    setInterval(()=>{
        workers.rotateLogs();
    }, 1000 * 60 * 60 *24) ;
}

workers.init = function(){

   //Send to console, in yellow
   console.log('\x1b[33m%s\x1b[0m','Background workers are running');

   //Execute all the checks
   workers.gatherAllChecks();

   //Call loop so he check continue to execute later on every 5s
   workers.loop();

   //Compress all the logs immediately
   workers.rotateLogs();

   //Call the compression loop so logs will be compressed later on
   workers.logRotationLoop();

}



//Export the module
module.exports = workers;