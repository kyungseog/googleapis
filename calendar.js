const fs = require('fs');
const path = require('path');
const process = require('process');
const {authenticate} = require('@google-cloud/local-auth');
const {google} = require('googleapis');
require('dotenv').config();

const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];
const TOKEN_PATH = path.join(process.cwd(), 'token.json');
const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');
const EMAIL_PATH = path.join(process.cwd(), 'email.json');

start();

async function start() {
  const auth = await authorize();
  const calendarIds = [process.env.A_ROOM_ID,process.env.B_ROOM_ID,process.env.C_ROOM_ID,process.env.D_ROOM_ID,process.env.E_ROOM_ID,process.env.F_ROOM_ID,process.env.G_ROOM_ID]
  const today = new Date();
  let tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  const emailData = await fs.promises.readFile(EMAIL_PATH);
  const emailInfo = JSON.parse(emailData);
  for(id of calendarIds) {
    listCalendars(auth, id, today, tomorrow, emailInfo);
  }
}

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

async function listCalendars(auth, id, today, tomorrow, emailInfo) {
  const calendar = google.calendar({version: 'v3', auth});
  const resList = await calendar.events.list({
    calendarId: id,
    timeMin: today.toISOString(),
    timeMax: tomorrow.toISOString(),
    maxResults: 10,
    singleEvents: true,
    orderBy: 'startTime',
  });
  const events = resList.data.items;
  if (!events || events.length === 0) {
    console.log('No events found.');
    return;
  }
  events.map((event, i) => {
    const start = event.start.dateTime || event.start.date;
    const end = event.end.dateTime || event.end.date;
    const name = emailInfo.filter( r => r.email == event.creator.email );
    const roomIndex = event.location.indexOf('-') + 1;
    console.log(`${event.location.substring(roomIndex,roomIndex + 3)} : ${start} / ${end} / ${name == undefined || name.length == 0 ? event.creator.email : name[0].name} / ${event.summary}`);
  });
}