const fs = require('fs');
const path = require('path');
const process = require('process');
const {google} = require('googleapis');
const mysql = require("mysql");
require('dotenv').config();

const TOKEN_PATH = path.join(process.cwd(), 'token.json');
const EMAIL_PATH = path.join(process.cwd(), 'email.json');

const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE
});

start()

async function start() {
  const content = await fs.promises.readFile(TOKEN_PATH);
  const credentials = JSON.parse(content);
  const auth = google.auth.fromJSON(credentials);
  const calendarIds = [process.env.A_ROOM_ID,process.env.B_ROOM_ID,process.env.C_ROOM_ID,process.env.D_ROOM_ID,process.env.E_ROOM_ID,process.env.F_ROOM_ID,process.env.G_ROOM_ID]
  const today = new Date();
  let tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  const emailData = await fs.promises.readFile(EMAIL_PATH);
  const emailInfo = JSON.parse(emailData);
  let data = [];
  for(id of calendarIds) {
    let room = await listCalendars(auth, id, today, tomorrow, emailInfo);
    if(room){
      for (let i = 0; i < room.length; i++){
        data.push(room[i]);
      }
    }
  }
  db.connect();
  db.query('INSERT INTO rooms (id, room_id, start_date, end_date, creator, summary) VALUES ?', [data]);
  db.end();
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
    return;
  }
  const roomsData = events.map((event, i) => {
    const start = event.start.dateTime || event.start.date;
    const end = event.end.dateTime || event.end.date;
    const name = emailInfo.filter( r => r.email == event.creator.email );
    const roomIndex = event.location.indexOf('-') + 1;
    return [event.id, event.location.substring(roomIndex,roomIndex + 3), start, end, name == undefined || name.length == 0 ? event.creator.email : name[0].name, event.summary];
  });
  return roomsData;
}
