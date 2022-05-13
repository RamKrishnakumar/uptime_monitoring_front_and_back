/**
 * Server-related tasks
 */


//Dependencies
 var http = require('http');
 var https = require('https');
 var url = require('url');
 var StringDecoder = require('string_decoder').StringDecoder;
 var config = require('./config');
 var fs = require('fs'); // fs is file system module
 var _data = require('./data');
 var handlers = require('./handlers');
 var helpers = require('./helpers');
 var sendSms = require('./twilio');
 var path = require('path');
 var util = require('util');
 var debug = util.debuglog('server');
 

 //instantiate the server module object 
 var server = {};
 
 //Instantiate the HTTP server
 server.httpServer = http.createServer((req,res)=>{
    server.unifiedServer(req,res);
 });
 

 
 //Instantiate the HTTPS server
 server.httpsServerOptions ={
     'key': fs.readFileSync(path.join(__dirname,'/../https/key.pem')),
     'cert': fs.readFileSync(path.join(__dirname,'/../https/cert.pem'))
 }
 server.httpsServer = https.createServer(server.httpsServerOptions,(req,res)=>{
     server.unifiedServer(req,res);
 })
 

 
 
 //All the server logic for both the http and https server
 //unified Server
 
 server.unifiedServer = function(req,res) {
     //Get the Url and pass it
     var parsedUrl = url.parse(req.url,true);
 
     //Get the path
     var path = parsedUrl.pathname;
     var trimmedPath = path.replace(/^\/+|\/+$/g,'');
 
     //Get the query string as an object
     var queryStringObject = parsedUrl.query;
 
     //Get the Http Method
     var method = req.method.toLowerCase();
 
     //Get the header as an Object
     var headers = req.headers;
 
     var buffer = '';
 
     //if there is any data or payload we will store it into buffer
     req.on('data', data =>{
         buffer += data;
     });
 
     req.on('end',()=>{
         
         //Choose the handler this request should go to.
         //If specified handler didn't find the use notfound handler
         var chosenHandler = typeof(server.router[trimmedPath]) !== 'undefined' ? server.router[trimmedPath] : handlers.notFound;
 
         //Construct the data object
         //Send the response
 
     var responseData = {
         trimmedPath: trimmedPath,
         queryStringObject : queryStringObject,
         method: method,
         headers: headers,
         payload: buffer !== ''? helpers.parseJsonToObject(buffer) : buffer
     };
     chosenHandler( responseData , (statusCode, payload, contentType)=>{

         //Determine the type of response (fallback to JSON)
         contentType = typeof(contentType) == 'string'? contentType : 'json';

         // use the status code called back by handler or use the defalut to 200
         statusCode = typeof(statusCode) == 'number'? statusCode : 200;
         
         //Return the  response parts that are content-specific
         var payloadString = '';
         if(contentType == 'json'){
            res.setHeader('Content-Type','application/json'); // this header specifies the type of data (json, text, etc)
            
            //use the payload called back or use the default to an empty object
            payload = typeof(payload) == 'object' ? payload : {};
            
            //stringify the payLoad
            payloadString = JSON.stringify(payload);
        }
         if(contentType == 'html'){
            res.setHeader('Content-Type','text/html'); // this header specifies the type of data (html, text, etc)
            
            //use the payload called back or use the default to an empty object
            payloadString = typeof(payload) == 'string' ? payload : '';
            
         }

         //Return the response parts that are common to all content-types
         res.writeHead(statusCode);
         res.end(payloadString);
         //If the response is 200, print green otherwise print red
         if(statusCode == 200){
           debug('\x1b[32m%s\x1b[0m',method.toUpperCase()+' /'+trimmedPath+' '+ statusCode);
         }
         else{
            debug('\x1b[31m%s\x1b[0m',method.toUpperCase()+' /'+trimmedPath+' '+ statusCode);
         }
         
     });
     });
 }
 
 
 //Define a request router
 
 server.router ={
     '' : handlers.index,
     'account/create': handlers.accountCreate,
     'account/edit': handlers.accountEdit,
     'account/deleted': handlers.accountDeleted,
     'session/create': handlers.sessionCreate,
     'session/deleted':handlers.sessionDeleted,
     'checks/all': handlers.checksList,
     'checks/create': handlers.checksCreate,
     'checks/edit'  : handlers.checksEdit,
     'ping': handlers.ping,
     'users': handlers.users,
     'tokens':handlers.tokens,
     'checks':handlers.checks
 }

 //Init script
 server.init = function(){
    //Start the Http Server
        server.httpServer.listen(config.httpPort, ()=>{
        console.log('\x1b[36m%s\x1b[0m',"The Server is listening on port "+config.httpPort+" in " +config.envName+" mode");
        });

     //Start the HTTPS server
        server.httpsServer.listen(config.httpsPort,()=>{
        console.log('\x1b[35m%s\x1b[0m',"The Server is listening on port "+config.httpsPort+" in " +config.envName+" mode");
        })
 }

 //Export the module
 module.exports = server;
 
 
 