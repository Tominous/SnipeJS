/*
* Mojang Authentication
* Authors: Exist, Discens
*/

const axios = require('axios');

const fs = require('fs');
const prompt = require('prompt-sync')();

const logger = require('./logger');

const init = async (config) => {
	const auth = await authenticate(config.email, config.password);
	const chal = await challenges(auth.token, config);
	const val= await validate(auth.token);

	return auth;
}


const authenticate = async (email, password) => {
  const json = {
      agent: { name: "Minecraft", version: 1 }, username: email, password: password
  }
  const req = await axios.post("https://authserver.mojang.com/authenticate", json, {
      headers: {
          // "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/84.0.4147.89 Safari/537.36",
          "Content-Type": "application/json"
      }
  });

  if (req.status != 200) logger.error(`Could not authenticate: ${email}:${password}`);

  const res = {token: req.data.accessToken, name: req.data.selectedProfile.name, id: req.data.selectedProfile.id, snipe:req.data.selectedProfile.paid}

  logger.info(`Succesfully authenticated ${res.name}.`);
	if (res.snipe) logger.info(`Account purchased, will snipe`);
	else logger.info(`Account not purchased, will block`);

  return res;
}

const challenges = async (token, config) => {
  const getQuestions = await axios.get(
    "https://api.mojang.com/user/security/challenges",
    {headers: {
      "Authorization": "Bearer "+ token
    }}
  ).catch(function (error) {
    logger.error("Could not access Mojang API.");
  });

  if(getQuestions.status != 200) logger.error("Could not get challenges.");

  if (getQuestions.data.length == 0) return;

  let answer = [];
  let flag = false;

  if(config.questions == undefined) {
    console.log();
    flag = true;
    logger.warn("Security questions not in configuration.")
    config.questions = [];
  }

  for(let i=0; i<3; i++){
    if(flag) config.questions.push(prompt(getQuestions.data[i].question.question+" "));

    answer.push({
        id: getQuestions.data[i].answer.id,
        answer: config.questions[i]
    });
  }

  if(flag) {
    let newConf = {email:config.email, password:config.password, questions:config.questions}
    const save = prompt('Save (Y/N): ');
    if(save.toUpperCase() == 'Y') fs.writeFileSync('../config.json', JSON.stringify(newConf));
  }

  const answerPost = await axios.post(
    "https://api.mojang.com/user/security/location",
    answer,
    {headers: {
      "Authorization": "Bearer "+token
    }}
  ).catch(function (error) {
   logger.error("Could not answer challenges.");;
  });

  return;
}

const validate = async (token) => {
  const bearerPayload = {
      accessToken: token
  }
  const req = await axios.post("https://authserver.mojang.com/validate", bearerPayload, {
      headers: {
          // "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/84.0.4147.89 Safari/537.36",
          "Content-Type": "application/json"
      }
  });
  if (req.status != 204) return logger.error(`Could not validate: ${email}:${password}`);
  return true;
}

exports.init = init;
