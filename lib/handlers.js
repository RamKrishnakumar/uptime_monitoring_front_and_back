/**
 * Request Handlers
 * NOTE--- data parameter in handlers function is //data provided by the user as payload from frontEnd, Which Includes Headers,methods, queryString, Body etc.
 */



//Dependencies
var _data = require('./data');
var helpers = require('./helpers'); //custom library to encrypt the password;
var config = require('./config');

//Define the handlers
var handlers = {}

//------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
//------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
                                    //HTML API Handlers Start from Here
//------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
//------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------




//Index Handler
/**
 * 
 * @param {*} data //data provided by the user as payload from frontEnd, Which Includes Headers,methods, queryString, Body etc.
 * @param {*} callback 
 */
handlers.index = (data,callback)=>{
    //Reject any request if that isn't GET Request
    if(data.method == 'get'){
        //Prepare data for interpolation
        var templateData = {
            'head.title': 'This is the title',
            'head.description': 'This is the meta description',
            'body.title':'Hello templated world!',
            'body.class':'index'
        };
                //Read in a template as a string
            helpers.getTemplate('index',templateData,(err,str)=>{
            if(!err && str){
                //Add the universal header and footer
                helpers.addUniversalTemplates(str,templateData,(err,str)=>{
                    if(!err && str){
                        callback(200,str,'html');
                    }
                    else{
                        callback(500,undefined,'html');
                    }
                });
            }
            else{
                callback(500,undefined,'html');
            }
        })
    }
    else{
        callback(405,`Request does not support ${data.method} request`,'html')
    }
//   callback(undefined,undefined,'html');
};


//------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
//------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
                                    //HTML API Handlers Ends Here
//------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
//------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------










//------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
//------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
                                    //JSON API Handlers Start form Here
//------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
//------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
                                        


///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                USERS Handler Starts here
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//Users handlers
//this function will figure out that which method you are requesting
/**
 * 
 * @param {*} data //data provided by the user as payload from frontEnd, Which Includes Headers,methods, queryString, Body etc.
 * @param {*} callback 
 */
handlers.users = function (data, callback) {
    var acceptableMethods = ['post', 'get', 'put', 'delete'];
    if (acceptableMethods.indexOf(data.method) > -1) {
        handlers._users[data.method](data, callback);
    }
    else {
        callback(405, { 'ErrorCode': 405, 'message': 'Method Not Allowed' });
    }
};

//Container for the users submethods
handlers._users = {};

//Users - post
//Required data: firstname, lastname, phone, password, tosAgreement
//optional data: none
/**
 * 
 * @param {*} data 
 * @param {*} callback 
 */
handlers._users.post = function (data, callback) {
    //Check that all required field are filled out
    var firstName = typeof (data.payload.firstName) == 'string' && data.payload.firstName.trim().length > 0 ? data.payload.firstName.trim() : false;
    var lastName = typeof (data.payload.lastName) == 'string' && data.payload.lastName.trim().length > 0 ? data.payload.lastName.trim() : false;
    var phone = typeof (data.payload.phone) == 'string' && data.payload.phone.trim().length == 10 ? data.payload.phone.trim() : false;
    var password = typeof (data.payload.password) == 'string' && data.payload.password.trim().length > 0 ? data.payload.password.trim() : false;
    var tosAgreement = typeof (data.payload.tosAgreement) == 'boolean' && data.payload.tosAgreement == true ? true : false;

    if (firstName && lastName && phone && password && tosAgreement) {
        // Make sure that the user doesn't allready exist
        _data.read('users', phone, function (err, data) {
            if (err) {
                //Hash the Password or Encrypt the password
                var hashedPassword = helpers.hash(password);
                if (hashedPassword) {
                    //Create the user object
                    var userObject = {
                        'firstName': firstName,
                        'lastName': lastName,
                        'phone': phone,
                        'hashedPassword': hashedPassword,
                        'tosAgreement': true
                    }
                    //Store the user to users directory
                    _data.create('users', phone, userObject, function (err) {
                        if (!err) {
                            callback(200, { 'statusCode': 1, 'status': 'successful', 'message': 'User created successfully' })
                        }
                        else {
                            callback(500, { 'Error': 500, 'message': 'Unable to create New User', 'err': err });
                        }
                    });
                }
                else {
                    callback(500, { 'Error': 500, 'message': 'Could not hash the user\'s password' });
                }
            }
            else {
                //User already exists
                callback(400, { 'Error': 400, 'message': 'A user with that phone no. already exists' });
            }
        })
    }
    else {
        callback(400, { 'Error': 400, 'message': ' Bad Request Missing Required Fields' });
    }
};

//Users - get
//Required Data: phone
//optional data: none
//@TODO Only let an authenticated user access their objects. Don't let them access other's data
/**
 * 
 * @param {*} data 
 * @param {*} callback 
 */

handlers._users.get = function (data, callback) {
    // Check that the phone no. is valid
    var phone = typeof (data.queryStringObject.phone) == 'string' && data.queryStringObject.phone.trim().length == 10 ? data.queryStringObject.phone.trim() : false;
    if (phone) {

        //Get the token from the headers
        var token = typeof (data.headers.token) == 'string' ? data.headers.token : false;
        // Verify that the given token is valid for the phone no.
        handlers._tokens.verifyToken(token, phone, (tokenIsValid) => {
            if (tokenIsValid) {
                //Lookup the User
                _data.read('users', phone, (err, data) => {
                    if (!err && data) {
                        // Remove the hashpassword
                        delete data.hashedPassword;
                        callback(200, { 'status': 'success', 'data': data });
                    }
                    else {
                        callback(404, { 'Error': 404, 'message': 'User Details not Found' })
                    }
                });
            }
            else {
                callback(403, { "Error": "403", "message": "Missing required token in header, or token is invalid" });
            }
        });
    }
    else {
        callback(400, { 'Error': '400 Bad Request', 'message': 'Missing Required field' });
    }

};

//Users - put
//Required data: phone
//Optional Data: firstname, lastname, password(at least on must be specified)
// @TODO Only let an authenticated user access their objects. Don't let them access other's data
/**
 * 
 * @param {*} data 
 * @param {*} callback 
 */
handlers._users.put = function (data, callback) {
    //Read the data
    var phone = typeof (data.payload.phone) == 'string' && data.payload.phone.trim().length == 10 ? data.payload.phone.trim() : false;
    //Check for the optional fields
    var firstName = typeof (data.payload.firstName) == 'string' && data.payload.firstName.trim().length > 0 ? data.payload.firstName.trim() : false;
    var lastName = typeof (data.payload.lastName) == 'string' && data.payload.lastName.trim().length > 0 ? data.payload.lastName.trim() : false;
    var password = typeof (data.payload.password) == 'string' && data.payload.password.trim().length > 0 ? data.payload.password.trim() : false;

    // Error if the phone is invalid
    if (phone) {
        //Error if nothing is sent to update
        if (firstName || lastName || password) {
            //Get the token from the headers
            var token = typeof (data.headers.token) == 'string' ? data.headers.token : false;
            // Verify that the given token is valid for the phone no.
            handlers._tokens.verifyToken(token, phone, (tokenIsValid) => {
                if (tokenIsValid) {
                    //Lookup the user
                    _data.read('users', phone, (err, userData) => {
                        if (!err && userData) {
                            if (firstName) {
                                userData.firstName = firstName;
                            }
                            if (lastName) {
                                userData.lastName = lastName;
                            }
                            if (password) {
                                userData.hashedPassword = helpers.hash(password);
                            }
                            // Store the updated data back to users dir
                            _data.update('users', phone, userData, (err, data) => {
                                if (!err) {
                                    callback(200, { 'statusCode': 200, 'message': 'Data updated Successfully' });
                                }
                                else {
                                    callback(500, { 'Error': 500, 'message': 'Could not update the User' });
                                }
                            })
                        }
                        else {
                            callback(400, { 'Error': '400', 'message': 'The specified user not exist' });
                        }
                    });
                }
                else {
                    callback(403, { "Error": "Missing Required Token in Header, or token is not valid" });
                }

            });
        }
        else {
            callback(400, { 'Error': 400, 'message': 'Missing required field' });
        }
    }
    else {
        callback(400, { 'Error': 400, 'message': 'Missing required field' });

    }


};

//Users - delete
//require field: phone
// @TODO -  @TODO Only let an authenticated user access their objects. Don't let them access other's data
// @TODO - Cleanup (Delete) any other data files associated with this user
/**
 * 
 * @param {*} data 
 * @param {*} callback 
 */
handlers._users.delete = function (data, callback) {
    var phone = typeof (data.queryStringObject.phone) == 'string' && data.queryStringObject.phone.trim().length == 10 ? data.queryStringObject.phone.trim() : false;
    if (phone) {
        //Get the token from the headers
        var token = typeof (data.headers.token) == 'string' ? data.headers.token : false;
        // Verify that the given token is valid for the phone no.
        handlers._tokens.verifyToken(token, phone, (tokenIsValid) => {
            if (tokenIsValid) {
                //Lookup the user
                _data.read('users', phone, (err, userData) => {
                    if (!err && userData) {
                        _data.delete('users', phone, (err) => {
                            if (!err) {
                                // callback(200, { 'statusCode': 200, 'message': 'User Deleted Successfully' });
                                // Delete each of the checks associated with the user
                                var userChecks = userData.checks instanceof Array ? userData.checks : [];
                                var checksToDelete = userChecks.length;

                                if(checksToDelete > 0){
                                   var checksDeleted = 0;
                                   var deletionError = false;
                                   //Loop through checks
                                   userChecks.forEach((checkId)=>{
                                       //Delete the check
                                       _data.delete('checks',checkId, (err)=>{
                                           if(err){
                                               deletionError = true;
                                           }
                                           checksDeleted ++;
                                           if(checksDeleted == checksToDelete){
                                               if(!deletionError){
                                                  callback(200,{"message":"User deleted successfully and associated checks also deleted "});
                                               }
                                               else{
                                                  callback(500,{"Error":"Errors encounterd while attempting to delet all of the user's checks. All checks may not have deleted from the system successfully"});
                                               }
                                           }
                                       });
                                   });
                                }
                                else{
                                    callback(200, { 'statusCode': 200, 'message': 'User Deleted Successfully, and no checks are associated with user' });
                                }
                            }
                            else {
                                callback(500, { "Error": 500, "message": "could not delete the specified user" });
                            }
                        })
                    }
                    else {
                        callback(404, { 'Error': 404, 'message': 'The Specified User did not exist' });
                    }
                });
            }
            else {
                callback(403, { "Error": "Missing Required Token in Header, or token is not valid" });
            }
        });

    }
    else {
        callback(400, { 'Error': 400, 'message': 'Missing required field' });
    }

};
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                USERS Handler Ends here
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////


///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                Tokens Handler Starts here
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////

//Tokens
//Tokens Handlers Functionality
/**
 * 
 * @param {*} data 
 * @param {*} callback 
 */
handlers.tokens = function (data, callback) {
    var acceptableMethods = ['post', 'get', 'put', 'delete'];
    if (acceptableMethods.indexOf(data.method) > -1) {
        handlers._tokens[data.method](data, callback);
    }
    else {
        callback(405, { 'Error': 'Error 405', 'message': 'Method Not Allowed' });
    }
}

//Container for  all the token methods

handlers._tokens = {};

//Token Post
//Required Data = phone, password
//optional Data is none
handlers._tokens.post = (data, callback) => {
    var phone = typeof (data.payload.phone.trim()) == 'string' && data.payload.phone.trim().length == 10 ? data.payload.phone.trim() : false;
    var password = typeof (data.payload.password.trim()) == 'string' && data.payload.password.trim().length > 0 ? data.payload.password.trim() : false;

    if (phone && password) {
        // Lookup the user who matched that phone number

        _data.read('users', phone, (err, userData) => {
            if (!err && userData) {
                //hash the password and match with the password stored in users
                var hashedPassword = helpers.hash(password);
                if (hashedPassword == userData.hashedPassword) {
                    //Create a new Token with random name. SET expiration date 1 hour in future
                    var tokenId = helpers.createRandomString(20);

                    var expires = Date.now() + 1000 * 60 * 60;
                    //check the tokenId
                    if (tokenId) {
                        var tokenObject = {
                            'phone': phone,
                            'id': tokenId,
                            'expires': expires
                        }

                        //Store the token 
                        _data.create('tokens', tokenId, tokenObject, (err) => {
                            if (!err) {
                                callback(200, tokenObject);
                            }
                            else {
                                callback(500, { 'Errorcode': 500, 'message': 'could not create new Token' });
                            }
                        });
                    }
                    else {
                        callback(500, { 'Error': 500, 'message': 'Error creating TokenId' });
                    }

                }
                else {
                    callback(400, { 'Error': 400, 'message': 'Password did not matched with specified user\'s stored password' });
                }
            }
            else {
                callback(400, { 'Error': 'could not find specified user' })
            }
        })

    }
    else {
        callback(400, { 'Error': 400, 'message': `missing required fields ${phone} or ${password}` });
    }

}

//Token Get
//Requrired Data: id
//Optinal data is none
/**
 * 
 * @param {*} data 
 * @param {*} callback 
 */
handlers._tokens.get = (data, callback) => {
    // Check that the id is valid
    var id = typeof (data.queryStringObject.id) == 'string' && data.queryStringObject.id.trim().length == 20 ? data.queryStringObject.id.trim() : false;
    if (id) {
        // lookup the tokem
        _data.read('tokens', id, (err, tokenData) => {
            if (!err && tokenData) {
                callback(200, tokenData);
            }
            else {
                callback(404, { 'Error': 404, 'message': 'Specified Token Id not found in database' });
            }
        })
    }
    else {
        callback(400, { 'Error': 400, 'message': `missing required fields:` });
    }
}

//Token Put
//Required data : id, extend
//Optional data : none
/**
 * 
 * @param {*} data 
 * @param {*} callback 
 */
handlers._tokens.put = (data, callback) => {
    // check id
    var id = typeof (data.payload.id) == 'string' && data.payload.id.trim().length == 20 ? data.payload.id.trim() : false;
    var extend = typeof (data.payload.extend) == 'boolean' && data.payload.extend == true ? data.payload.extend : false;
    if (id && extend) {
        //lookup for the id in tokens dir
        _data.read('tokens', id, (err, tokenData) => {
            if (!err && tokenData) {
                //check whether token is expired or not
                if (tokenData.expires > Date.now()) {
                    //Set the expiration an hours from now
                    tokenData.expires = Date.now() + 1000 * 60 * 60;

                    //Store the new Updates
                    _data.update('tokens', id, tokenData, (err) => {
                        if (!err) {
                            callback(200, { "SuccessCode": "200", "message": "Token expiry time is successfully extended" });
                        }
                        else {
                            callback(500, { "Error": "500", "message": "Could not extend the token's expiration" });
                        }
                    });
                }
                else {
                    callback(400, { "Error": 400, "message": "Token has already expired" });
                }
            }
            else {
                callback(404, { "Error": 404, "message": "Specified Token not found in database" });
            }
        })
    }
    else {
        callback(400, { 'Error': 400, 'message': `Missing Required fields` });
    }
}

//Token Delete
/**
 * //Required Data : id
 * //Optional Data : none
 * @param {*id} data 
 * @param {*(err,message object)} callback 
 */
handlers._tokens.delete = (data, callback) => {
    var id = typeof (data.queryStringObject.id) == 'string' && data.queryStringObject.id.trim().length == 20 ? data.queryStringObject.id.trim() : false;
    if (id) {
        //Lookup for the id
        _data.read('tokens', id, (err, tokenData) => {
            if (!err && tokenData) {
                _data.delete('tokens', id, (err) => {
                    if (!err) {
                        callback(200, { "SuccessCode": "200", "message": "Token Id deleted Successfully" });
                    }
                    else {
                        callback(500, { "Error": "Could not Delete the specified Token Id " });
                    }
                })
            }
            else {
                callback(400, { "Error": "400", "message": "Specified Token id does not exist" });
            }
        })
    }
    else {
        callback(404, { "Error": 404, "message": "Missing required Fields" });
    }
}

//Verify if a given token id is currently valid for a given user
/**
 * 
 * @param {*} id 
 * @param {*} phone 
 * @param {*} callback 
 */

handlers._tokens.verifyToken = (id, phone, callback) => {
    //Lookup the token
    _data.read('tokens', id, (err, tokenData) => {
        if (!err && tokenData) {
            //Check that the token is for the given user and has not expired
            if (tokenData.phone == phone && tokenData.expires > Date.now()) {
                callback(true)
            }
            else {
                callback(false)
            }
        }
        else {
            callback(false)
        }
    })
};

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                Tokens Handler Ends here
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                Checks Handler Starts here
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Checks
 */
handlers.checks = function(data,callback){
    var acceptableMethods = ['post','get', 'put', 'delete'];
    if(acceptableMethods.indexOf(data.method) > -1 ){
        handlers._checks[data.method](data,callback);
    }
    else{
        callback(405);
    }
}

//Container for checks methods
handlers._checks = {};

//Checks POST
//Required Data - protocol, url, method, successCodes, timeOutSeconds
//Optional Data - none
/**
 * 
 * @param {* userdata payload} data 
 * @param {*} callback 
 */

handlers._checks.post = function(data,callback){
    //Validate inputs
    var protocol = typeof(data.payload.protocol) == 'string' && ['https','http'].indexOf(data.payload.protocol) > -1 ? data.payload.protocol : false;
    var url = typeof(data.payload.url) == 'string' && data.payload.url.trim().length > 0 ? data.payload.url.trim() : false;
    var method = typeof(data.payload.method) == 'string' && ['post','get','put','delete'].indexOf(data.payload.method) > -1 ? data.payload.method : false;
    var successCodes = typeof(data.payload.successCodes) == 'object' && data.payload.successCodes instanceof Array && data.payload.successCodes.length > 0 ? data.payload.successCodes : false;
    var timeOutSeconds = typeof(data.payload.timeOutSeconds) == 'number' && data.payload.timeOutSeconds % 1 === 0 && data.payload.timeOutSeconds > 1 && data.payload.timeOutSeconds <= 5 ? data.payload.timeOutSeconds : false;
    console.log(protocol,url,method,successCodes,timeOutSeconds);
    if(protocol && url && method && successCodes && timeOutSeconds){
        //get the token from header and verify 
        var token = typeof(data.headers.token) == 'string' ? data.headers.token : false;

        //lookup the user by reading the token
        _data.read('tokens',token,function(err,tokenData){
            if(!err && tokenData){
               var userPhone = tokenData.phone;
               //Lookup the user in user data
               _data.read('users',userPhone,(err,userData)=>{
                   if(!err && userData){
                      var userChecks = userData.checks instanceof Array ? userData.checks : [];

                      //Verify that the user has less than the number of max-checks-per-user
                      if( userChecks.length < config.maxChecks){
                          //Create a random id for the check
                          var checkId = helpers.createRandomString(20);
                          // create check object and include the user's phone
                          var checkObject = {
                              'id': checkId,
                              'userPhone': userPhone,
                              'protocol': protocol,
                              'url': url,
                              'method':method,
                              'successCodes': successCodes,
                              'timeOutSeconds': timeOutSeconds
                          };

                        //Save the checkObject 
                        _data.create('checks',checkId,checkObject,(err)=>{
                            if(!err){
                             //Add the check id to the user's object
                             userData.checks = userChecks;
                             console.log(userChecks);
                             userData.checks.push(checkId);

                             //save the new userData
                             _data.update('users',userPhone,userData,(err)=>{
                                if(!err){
                                    //Return the data about the new check
                                    callback(200, checkObject);
                                }
                                else{
                                    callback(500,{"Error":"could not update the user with the new Check"});
                                }
                             })
                            }
                            else{
                                callback(500,{"Error":"Could not create the new Check"});
                            }
                        })
                      }
                      else{
                          callback(400,{"Error": "The user already has the maximum number of checks("+config.maxChecks+")"});
                      }
                   }
                   else{
                       callback(403,{"Error":"NO user found, or user is deleted from database"});
                   }
               })
            }
            else{
                callback(403,{'Error':'Not Authorized or token is expired'});
            }
        })
    }
    else{
        callback(400,{'Error':'Missing Required fields or input is invalid'});
    }
}

/**
 * Check GET
 * Requried Data: checkid 
 * OPtional Data:
 */
/**
 * 
 * @param {*} data 
 * @param {*} callback 
 */
handlers._checks.get = function(data,callback){
 var id = typeof(data.queryStringObject.id) == 'string' && data.queryStringObject.id.trim().length == 20 ? data.queryStringObject.id.trim() : false;
 if(id){
    //Lookup the check 
    _data.read('checks',id,(err,checkData)=>{
        if(!err && checkData){
            //Get the token from header
            var token = typeof(data.headers.token) == 'string' ? data.headers.token : false;
            //Verify that the given token is valid for the phone no.
            handlers._tokens.verifyToken(token,checkData.userPhone,(tokenIsValid)=>{
                if(tokenIsValid){
                   //Return the check data
                   callback(200,checkData);
                }
                else{
                    callback(403,{"Error":"Missing required token in header, or token is invalid"});
                }
            })
        }
        else{
            callback(404,{"Error":"Provided id isn't found in database"});
        }
    })
 }
 else{
     callback(400,{'Error':'Missing required field'});
 }
}

/**
 * PUT Method for Checks
 * Required Data : id, 
 * Optional Data : protocol || method || successCode || timeOutSeconds 
 */
/**
 * 
 * @param {*} data 
 * @param {*} callback 
 */
handlers._checks.put = function(data,callback){
    var id = typeof(data.payload.id)=='string' && data.payload.id.trim().length == 20 ? data.payload.id.trim() : false;
    var protocol = typeof(data.payload.protocol) == 'string' && ['https','http'].indexOf(data.payload.protocol) > -1 ? data.payload.protocol : false;
    var url = typeof(data.payload.url) == 'string' && data.payload.url.trim().length > 0 ? data.payload.url.trim() : false;
    var method = typeof(data.payload.method) == 'string' && ['post','get','put','delete'].indexOf(data.payload.method) > -1 ? data.payload.method : false;
    var successCodes = typeof(data.payload.successCodes) == 'object' && data.payload.successCodes instanceof Array && data.payload.successCodes.length > 0 ? data.payload.successCodes : false;
    var timeOutSeconds = typeof(data.payload.timeOutSeconds) == 'number' && data.payload.timeOutSeconds % 1 === 0 && data.payload.timeOutSeconds > 1 && data.payload.timeOutSeconds <= 5 ? data.payload.timeOutSeconds : false;
    
    if(id){
    //Lookup for the check id in database
    _data.read('checks',id,(err,checkData)=>{
        if(!err && checkData){
           //Check to make sure one or more optional fields has been sent
           if(protocol || url || method || successCodes || timeOutSeconds){
             var token = typeof(data.headers.token)== 'string' ? data.headers.token : false;
             handlers._tokens.verifyToken(token,checkData.userPhone,(tokenIsValid)=>{
                 if(tokenIsValid){
                   //Update the data where it is neccessary to update
                   if(protocol){
                       checkData.protocol = protocol;
                   }
                   if(url){
                       checkData.url = url;
                   }
                   if(method){
                       checkData.method = method;
                   }
                   if(successCodes){
                       checkData.successCodes = successCodes;
                   }
                   if(timeOutSeconds){
                       checkData.timeOutSeconds = timeOutSeconds;
                   }
                   //Store the data back to check directory under specific user and check id
                   _data.update('checks',id,checkData,(err)=>{
                       if(!err){
                           callback(200,{"message":"Data updated successfully"});
                       }
                       else{
                           callback(500,{"Error":"Could not update the checkDate"});
                       }
                   })
                 }
                 else{
                     callback(403,{"Error":"Token field is missing or expired"});
                 }
             });
           }
           else{
               callback(400,{"Error":"Missing Optional Required field"});
           }
        }
        else{
            callback(400,{"Error":"Specified check id not exist"});
        }
    });
    }
    else{
        callback(400,{"Error": "Missing Required field 'checkid'"});
    }
    
}

/**
 * Check DELETE
 * required Field : id
 * optional field : none
 */
/**
 * 
 * @param {*} data 
 * @param {*} callback 
 */

handlers._checks.delete = function(data,callback){
    var id = typeof(data.queryStringObject.id) == 'string' && data.queryStringObject.id.trim().length == 20 ? data.queryStringObject.id : false;
    if(id){
       //Lookup the check id
       _data.read('checks',id,(err,checkData)=>{
           if(!err && checkData){
              //get the Tokens from headers and verify them
              var tokens = typeof(data.headers.token) == 'string' ? data.headers.token : false;
              //Verify the token
              handlers._tokens.verifyToken(tokens,checkData.userPhone,(tokenIsValid)=>{
                  if(tokenIsValid){
                     //Delete the check data
                     _data.delete('checks',id,(err)=>{
                         if(!err){
                             //Lookup the user
                             _data.read('users',checkData.userPhone,(err,userData)=>{
                                if(!err && userData){
                                    var userChecks =userData.checks instanceof Array ? userData.checks : false;

                                    //Remove the deleted check from the list of check presend in userData
                                    var checkPosition = userChecks.indexOf(id);
                                    if(checkPosition > -1){
                                         userChecks.splice(checkPosition,1);
                                         //Resave the userData
                                         _data.update('users',checkData.userPhone,userData,(err)=>{
                                             if(!err){
                                                callback(200,{"message":"successfully deleted check from user"})
                                             }
                                             else{
                                                callback(500,{"Error":"Could not update the userData"});
                                             }
                                         })
                                    }
                                    else{
                                        callback(500,{"Error":"Could not find the check on user\'s object, so could not delete check"})
                                    }
                                }
                                else{
                                     callback(500,{"Error":"Could not find the user who created the check data, so could not remove the check id from the list of checks on the user object"});
                                }
                             });
                         }
                         else{
                             callback(500,{"Error":"could not delete the check"});

                         }
                     });
                  }
                  else{
                      callback(403,{"Error": "specified token Id is missing or expired"});
                  }
              })
           }
           else{
               callback(400,{"Error":"Specified check Id not exist"});
           }
       })
    }
    else{
        callback(400,{"Error":"Missing Required field 'checkId'"});
    }
}

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                Checks Handler Ends here
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////



//PIng handler
handlers.ping = function (data, callback) {
    callback(200, data);
}



//------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
//------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
                                //JSON API Ends Here
//------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
//------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

/**
 * Suppose user called path:3000/foo then foo handler should be called
 * If there is foo handler then we have to route to the foo handler and if we don't find foo handler then we have to set
 * default error 404 handler for not found.
 */

// Not found handler (error 404)
/**
 * 
 * @param {*} data 
 * @param {*} callback 
 */
handlers.notFound = function (data, callback) {
    callback(404, { 'Error': 404, 'message': `No HTTP resource was found that matches the request '${data.trimmedPath}'` });
}

module.exports = handlers;