/**
* Primary File for the API
* index.js that works dynamically
*/

//Dependencies
var server = require('./lib/server');
var workers = require('./lib/workers');

//Declare the app
var app = {};

//Init function
app.init = function(){
  //Stat the server
  server.init();

  //Start the workers
  workers.init();
};

//Execute
app.init();

//Export the app
module.exports = app;