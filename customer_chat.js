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

connectRabbitMQ();
initialPool();
initialChat();

const transporter = nodemailer.createTransport(emailConfig);

let temp_room = {};
let current_room = "";
let otpStore = new Map();

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
      if (answers.ask === "Ya") {
        bioData();
      } else {
        initialChat();
      }
    });
}

async function bioData() {
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
        default: "tacili1244@ptiong.com",
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

      if (verifiedCheck.length > 0) {
        console.log("Email sudah terverifikasi, membuat room baru...");
        const [result] = await globalpooldb.db.query(
          "INSERT INTO rooms () VALUES ()"
        );
        const roomId = result.insertId;
        current_room = roomId;
        temp_room[roomId] = {
          room: roomId,
          data: answers,
          chat_history: [],
          otp: "",
        };
        await globalpooldb.db.query(
          "INSERT INTO customers (nama, email, no_hp, umur, topic, room_id, is_verified) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [name, email, phone, umur, topic, roomId, true]
        );
        subscribeToRoom(roomId);
        console.log(`\nCreated new chat room: room_${roomId}`);
        conversation_chat();
        return;
      }

      const otp = 12345;
      // const otp = generateOTP();
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
    .then(async (answers) => {
      if (otpStore.get(email)?.otp != answers.otp) {
        console.log("OTP salah, coba lagi.");
        verifiedOtpCheck(email);
        return;
      }

      const { name, email, phone, umur, topic } = otpStore.get(email).data;
      const [result] = await globalpooldb.db.query(
        "INSERT INTO rooms () VALUES ()"
      );
      const roomId = result.insertId;
      current_room = roomId;
      temp_room[roomId] = {
        room: roomId,
        data: { name, email, phone, umur, topic },
        chat_history: [],
        otp: answers.otp,
      };
      await globalpooldb.db.query(
        "INSERT INTO customers (nama, email, no_hp, umur, topic, room_id, is_verified) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [name, email, phone, umur, topic, roomId, true]
      );
      subscribeToRoom(roomId);
      console.log(`\nCreated new chat room: room_${roomId}`);
      conversation_chat();
    });
}

async function conversation_chat() {
  try {
    inquirer
      .prompt([
        {
          name: "chat",
          message: ``,
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
          await finishRoom(current_room);
          console.log("Chat selesai.");
          initialChat();
          return;
        }
        if (answers.chat) {
          const message = {
            room_id: current_room,
            message: answers.chat,
            sender_type: "customer",
            sender_id: temp_room[current_room].data.email,
          };
          publishToRoom(current_room, message);
          temp_room[current_room].chat_history.push(message);
        }
        conversation_chat();
      });
  } catch (error) {
    console.error(error);
  }
}
