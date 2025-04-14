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
  finishRoom,
} = require("./rabbitmq");
const { port, emailConfig } = require("./config");
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport(emailConfig);
let temp_room = {};
let current_room = "";

async function initial() {
  await connectRabbitMQ();
  await initialPool();
  selectRoom();
}

async function selectRoom() {
  const [rooms] = await globalpooldb.db.query("SELECT id FROM rooms");

  inquirer
    .prompt([
      {
        type: "list",
        name: "roomId",
        message: "Pilih room untuk chat:",
        choices: rooms.map((r) => ({ name: `Room ${r.id}`, value: r.id })),
      },
    ])
    .then((answers) => {
      const roomId = answers.roomId;
      current_room = roomId;
      temp_room[roomId] = {
        room: roomId,
        data: { email: "cs@test.com" },
        chat_history: [],
      };
      subscribeToRoom(roomId);
      console.log(`\nMasuk ke chat room: room_${roomId}`);
      conversation_chat();
    });
}

async function conversation_chat() {
  try {
    inquirer
      .prompt([
        {
          name: "chat",
          message: `Ketik pesan (q untuk keluar): `,
          default: "",
        },
      ])
      .then(async (answers) => {
        if (answers.chat == "i") {
          console.info(temp_room[current_room]);
          conversation_chat();
          return;
        }
        if (answers.chat === "q") {
          console.log("Chat selesai.");
          await finishRoom(current_room);
          selectRoom();
          return;
        }
        if (answers.chat) {
          const message = {
            room_id: current_room,
            message: answers.chat,
            sender_type: "cs",
            sender_id: temp_room[current_room].data.email,
          };
          publishToRoom(current_room, message);
          temp_room[current_room].chat_history.push(message);
        }
        conversation_chat();
      });
  } catch (error) {
    console.error("Error di conversation_chat:", error);
    conversation_chat();
  }
}

initial();
