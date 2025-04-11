const express = require("express");
const { initializeDatabase, getConnection } = require("./database");
const { port, emailConfig } = require("./config");
const nodemailer = require("nodemailer");
const {
  connectRabbitMQ,
  subscribeToRoom,
  publishToRoom,
  getMessages,
} = require("./rabbitmq");
const app = express();
app.use(express.json());
app.use(express.static("public"));

const otpStore = new Map();
const transporter = nodemailer.createTransport(emailConfig);

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Inisialisasi RabbitMQ
connectRabbitMQ()
  .then(() => {
    console.log("RabbitMQ siap digunakan");
  })
  .catch((err) => {
    console.error("Gagal connect RabbitMQ:", err);
  });

app.post("/customer", async (req, res) => {
  const { nama, email, no_hp, umur, topic } = req.body;

  try {
    const db = await getConnection();
    const [verifiedCheck] = await db.query(
      "SELECT is_verified FROM customers WHERE email = ? AND is_verified = TRUE LIMIT 1",
      [email]
    );

    if (verifiedCheck.length > 0) {
      const roomName = `room_${Date.now()}`;
      await db.query("INSERT INTO rooms (room_name) VALUES (?)", [roomName]);
      await db.query(
        "INSERT INTO customers (nama, email, no_hp, umur, topic, room_name, is_verified) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [nama, email, no_hp, umur, topic, roomName, true]
      );
      subscribeToRoom(roomName);
      await db.end();
      return res
        .status(201)
        .json({ message: "Keluhan dicatat!", room_name: roomName });
    }

    const otp = generateOTP();
    otpStore.set(email, { otp, data: { nama, email, no_hp, umur, topic } });

    const mailOptions = {
      from: emailConfig.auth.user,
      to: email,
      subject: "OTP Code",
      text: `Your OTP code is ${otp}.`,
    };

    await transporter.sendMail(mailOptions);
    await db.end();
    res.status(200).json({ message: "Cek email untuk OTP." });
  } catch (error) {
    console.error("Gagal kirim OTP:", error);
    res.status(500).json({ message: "Gagal kirim OTP" });
  }
});

app.post("/verify-otp", async (req, res) => {
  const { email, otp } = req.body;

  const storedData = otpStore.get(email);
  if (!storedData || storedData.otp !== otp) {
    return res.status(401).json({ message: "OTP salah atau kadaluarsa" });
  }

  const { nama, no_hp, umur, topic } = storedData.data;
  const roomName = `room_${Date.now()}`;

  try {
    const db = await getConnection();
    await db.query("INSERT INTO rooms (room_name) VALUES (?)", [roomName]);
    await db.query(
      "INSERT INTO customers (nama, email, no_hp, umur, topic, room_name, is_verified) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [nama, email, no_hp, umur, topic, roomName, true]
    );
    subscribeToRoom(roomName);
    otpStore.delete(email);
    await db.end();

    res.status(201).json({
      message: "Berhasil simpan dan verifikasi",
      data: { nama, email, no_hp, umur, topic, room_name: roomName },
    });
  } catch (error) {
    console.error("Gagal simpan data:", error);
    res.status(500).json({ message: "Gagal simpan data" });
  }
});

// Kirim pesan
app.post("/message", (req, res) => {
  const { room_name, message, sender_type, sender_id } = req.body;
  publishToRoom(room_name, { room_name, message, sender_type, sender_id });
  res.status(201).json({ message: "Pesan dikirim" });
});

// Ambil pesan
app.get("/messages/:room_name", (req, res) => {
  const { room_name } = req.params;
  const messages = getMessages(room_name);
  res.status(200).json({ data: messages });
});

app.get("/customers", async (req, res) => {
  try {
    const db = await getConnection();
    const [rows] = await db.query("SELECT * FROM customers");
    await db.end();
    res.status(200).json({ message: "Daftar customer", data: rows });
  } catch (error) {
    console.error("Gagal mengambil data:", error);
    res.status(500).json({ message: "Gagal mengambil data dari database" });
  }
});

app.listen(port, async () => {
  await initializeDatabase();
  console.log(`Server berjalan di port ${port}`);
});
