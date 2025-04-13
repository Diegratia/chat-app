const inquirer = require("inquirer");
const {
  initializeDatabase,
  getConnection,
  globalpooldb,
  initialPool,
} = require("./database");
const {
  connectRabbitMQ,
  subscribeToRoom,
  publishToRoom,
  getMessages,
} = require("./rabbitmq");
const { port, emailConfig } = require("./config");
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport(emailConfig);
var roomchat = "chat_ticket_room_1744370242428";
initial();
async function initial() {
  await connectRabbitMQ();
  await initialPool();
  subscribeToRoom(roomchat);
  onlineChat();
}

function onlineChat() {
  inquirer
    .prompt([
      {
        name: "chat",
        message: ``,
        default: "",
      },
    ])
    .then((answers) => {
      // otpStore

      publishToRoom(roomchat, answers.chat);
      onlineChat();
      // console.log()
    });
}
