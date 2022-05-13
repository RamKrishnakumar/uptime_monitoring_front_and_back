/**
 * Create and export confriguration variables
 */

//Container for all the environments
var environments = {};

//staging (defalut) environment
environments.staging ={
   'httpPort': 3000,
   'httpsPort': 3001,
   'envName': 'staging',
   'hashingSecret':'thisIsASecret',
   'maxChecks': 5,
   'twilio':{
      // 'accountSid':'copy accountSid from twilio to here',
      // 'authToken':'copy token from twilio account and paste here',
      // 'fromPhone':'formphone'
      'accountSid':'ACd47b42bc78b719a03705525385f03e04',
      'authToken':'d00e278d36898bb2bd4a6cd65eee3a56',
      'fromPhone':'+19379156143'
      
   },
   'templateGlobals':{
      'appName': 'UptimeChecker',
      'companyName': 'NotARealCompany, Inc',
      'yearCreated': '2018',
      'baseUrl' : 'http://localhost:3000',
   }
};

//Production environment
environments.production ={
   'httpPort': 5000,
   'httpsPort':5001,
   'envName': 'production',
   'hashingSecret':'thisIsAlsoASecret',
   'maxChecks':5,
   'twilio':{
      // 'accountSid':'copy accountSid from twilio to here',
      // 'authToken':'copy token from twilio account and paste here',
      // 'fromPhone':'formphone'
      'accountSid':'ACd47b42bc78b719a03705525385f03e04',
      'authToken':'d00e278d36898bb2bd4a6cd65eee3a56',
      'fromPhone':'+19379156143'
   },
   'templateGlobals':{
      'appName': 'UptimeChecker',
      'companyName': 'NotARealCompany, Inc',
      'yearCreated': '2018',
      'baseUrl' : 'http://localhost:5000',
   }
};

// Determine which enviroment was passed as command-line argument
var currentEnvironment = typeof(process.env.NODE_ENV) == 'string' ? process.env.NODE_ENV.toLowerCase() : '';

// Check wheater currentEnviroment variable is present in environments or not if not then default to staging.
var environmentToExport = typeof(environments[currentEnvironment]) == 'object' ? environments[currentEnvironment]: environments.staging;

//Export the module

module.exports = environmentToExport;