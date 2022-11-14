const fs = require('fs');
const path = require('path');
const process = require('process');
const {authenticate} = require('@google-cloud/local-auth');
const {google} = require('googleapis');
const { App } = require('@slack/bolt');
require('dotenv').config();

const app = new App({
  token: process.env.APP_TOKEN,
  signingSecret: process.env.APP_SIGNING_SECRET  
});

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];
const TOKEN_PATH = path.join(process.cwd(), 'token.json');
const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');
const LIST_PATH = path.join(process.cwd(), 'list.csv');

async function loadSavedCredentialsIfExist() {
  try {
    const content = await fs.promises.readFile(TOKEN_PATH);
    const credentials = JSON.parse(content);
    return google.auth.fromJSON(credentials);
  } catch (err) {
    return null;
  }
}

async function saveCredentials(client) {
  const content = await fs.promises.readFile(CREDENTIALS_PATH);
  const keys = JSON.parse(content);
  const key = keys.installed || keys.web;
  const payload = JSON.stringify({
    type: 'authorized_user',
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token,
  });
  await fs.promises.writeFile(TOKEN_PATH, payload);
}

async function authorize() {
  let client = await loadSavedCredentialsIfExist();
  if (client) {
    return client;
  }
  client = await authenticate({
    scopes: SCOPES,
    keyfilePath: CREDENTIALS_PATH,
  });
  if (client.credentials) {
    await saveCredentials(client);
  }
  return client;
}

async function listMessages(auth) {
  const gmail = google.gmail({version: 'v1', auth});
  const resList = await gmail.users.messages.list({
    userId: 'accounting@moomooz.com'
  });
  const messages = resList.data.messages;
  if (!messages || messages.length === 0) {
    console.log('No messages found.');
    return;
  }
  const beforeListArray = await fs.promises.readFile(LIST_PATH,"utf-8");
  const beforeList = beforeListArray.split(",");
  const notiMessages = messages.filter( message => beforeList.indexOf(message.id) < 0 );
  console.log(notiMessages)
  const listArray = messages.map(message => message.id);
  const list = listArray.join(',');
  await fs.promises.writeFile(LIST_PATH, list);

  if (!notiMessages || notiMessages.length === 0) {
    console.log('No new messages found.');
    return;
  }

  notiMessages.forEach( async function(message) {
    const resGet = await gmail.users.messages.get({
      userId: 'accounting@moomooz.com',
      id: message.id
    });
    const textData = resGet.data.payload.headers;
    const headerText = textData.filter( r => r.name == 'Subject' );
    const bodyText = resGet.data.snippet;
    sendMessage(headerText,bodyText);
  })
}

//관리파트 C049BKU2WMA
async function sendMessage(headerText,bodyText) {
  const send_text = [{"type": "section", "text": {"type": "mrkdwn", "text": "*accounting email 알림*"}},
    {"type": "section", "text": {"type": "plain_text", "text": headerText[0].value}},
    {"type": "divider"},
    {"type": "section", "text": {"type": "plain_text", "text": bodyText}}];

  try {
    const result = await app.client.chat.postMessage({
      channel: 'C049BKU2WMA',
      blocks: send_text
    });
    console.log(result);
  }
  catch (error) {
    console.error(error);
  }
}

authorize().then(listMessages).catch(console.error);