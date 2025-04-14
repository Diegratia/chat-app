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

connectRabbitMQ();
initialPool();
initialChat();
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
const transporter = nodemailer.createTransport(emailConfig);

temp_room = {};
current_room = "";
otpStore = new Map();
async function initialChat() {
  inquirer
    .prompt([
      {
        type: "list",
        name: "ask",
        message: "Mulai chat",
        choices: ["Ya", "No"],
      },
    ])
    .then((answers) => {
      console.log("You asked: " + answers.ask);
      if (answers.ask == "Ya") {
        // Isi Bio data
        // console.log(globalpooldb.db);
        bioData();
      } else {
        initialChat();
      }
      // You can add code here to handle the customer's question or concern
    });
}
function bioData() {
  inquirer
    .prompt([
      {
        name: "name",
        message: "Nama customer?",
        default: "Dion",
      },
      {
        name: "email",
        message: "Email customer?",
        default: "pamadix978@mobilesm.com",
      },
      {
        name: "phone",
        message: "No HP customer?",
        default: "456789",
      },
      {
        name: "umur",
        message: "Umur?",
        default: "20",
      },
      {
        name: "topic",
        message: "Ada yang bisa dibantu?",
        default: "Test",
      },
    ])
    .then(async (answers) => {
      const { name, email, phone, topic, umur } = answers;
      const [verifiedCheck] = await globalpooldb.db.query(
        "SELECT is_verified FROM customers WHERE email = ? AND is_verified = TRUE LIMIT 1",
        [email]
      );
      const roomName = `chat_ticket_room_${Date.now()}`;
      if (verifiedCheck.length > 0) {
        current_room = roomName;
        temp_room[roomName] = {
          room: roomName,
          data: answers,
          chat_history: [],
          otp: "",
        };
        await globalpooldb.db.query(
          "INSERT INTO rooms (room_name) VALUES (?)",
          [roomName]
        );
        await globalpooldb.db.query(
          "INSERT INTO customers (nama, email, no_hp, umur, topic, room_name, is_verified) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [name, email, phone, 0, topic, roomName, true]
        );
        subscribeToRoom(roomName);
        // await globalpooldb.end();
        console.log("\n create new chat");
      }

      const otp = 12345;
      // const otp = generateOTP();
      temp_room[roomName].otp = otp;
      otpStore.set(email, { otp, data: { name, email, phone, umur, topic } });

      const mailOptions = {
        from: emailConfig.auth.user,
        to: email,
        subject: "OTP Code",
        text: `Your OTP code is ${otp}.`,
      };

      await transporter.sendMail(mailOptions);
      verifiedOtpCheck(email);
      console.info("Answers:", answers);
    });
}

function verifiedOtpCheck(email = "") {
  inquirer
    .prompt([
      {
        name: "otp",
        message: `Verifikasi OTP melalui email (${email})? `,
        default: "",
      },
    ])
    .then((answers) => {
      // otpStore
      console.log(temp_room);
      if (temp_room[current_room].otp != answers.otp) {
        var em = temp_room[current_room].data.email;
        verifiedOtpCheck(em);
        return;
      }
      conversation_chat();

      console.log("Start Chat:");
      // console.info("Answer:", answers.faveReptile);
    });
}

function conversation_chat() {
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
      if (answers.chat == "i") {
        console.info(temp_room[current_room]);
        conversation_chat();
        return;
      }

      publishToRoom(current_room, answers.chat);
      conversation_chat();
      // console.log()
    });
}
