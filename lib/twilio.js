var config = require('./config');

const sendSms = (phone, message, callback) => {
  const client = require('twilio')(config.twilio.accountSid, config.twilio.authToken);
  client.messages
    .create({
       body: message,
       from: config.twilio.fromPhone,
       to: '+91'+phone
     })
    .then(message => {console.log(message);
      if(message.errorMessage == null){
        callback(message);
      } 
      else{
        callback(message.errorMessage);
      }  
    }).catch(error=>{
      callback(error);
    });
}

module.exports = sendSms;