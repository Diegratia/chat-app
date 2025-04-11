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

//otp simpan di session
const otpStore = new Map();
const transporter = nodemailer.createTransport(emailConfig);

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Inisialisasi RabbitMQ
connectRabbitMQ(() => {
  console.log("RabbitMQ siap digunakan");
});

app.post("/customer", async (req, res) => {
  const { nama, email, no_hp, umur, topic } = req.body;

  if (!nama || !email || !no_hp || !umur || !topic) {
    return res.status(400).json({ message: "Semua field harus diisi!" });
  }

  try {
    const db = await getConnection();

    // cek verfied email
    const [verifiedCheck] = await db.query(
      "SELECT is_verified FROM customers WHERE email = ? AND is_verified = TRUE LIMIT 1",
      [email]
    );

    if (verifiedCheck.length > 0) {
      //kalau sudah verfied langsung input entri baru
      const roomName = `room_${Date.now()}`; // ini nanti untuk room chat
      await db.query("INSERT INTO rooms (room_name) VALUES (?)", [roomName]);
      await db.query(
        "INSERT INTO customers (nama, email, no_hp, umur, topic, room_name, is_verified) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [nama, email, no_hp, umur, topic, roomName, true]
      );
      subscribeToRoom(roomName); // subs ke rum baru
      await db.end();
      await db.end();
      return res
        .status(201)
        .json({ message: "Keluhan dicatat!", room_name: roomName });
    }

    // if verified false, req otp
    const otp = generateOTP();
    otpStore.set(email, {
      otp,
      data: { nama, email, no_hp, umur, topic },
    });

    const mailOptions = {
      from: emailConfig.auth.user,
      to: email,
      subject: "OTP Code",
      text: `Your OTP code are ${otp}.`,
    };

    await transporter.sendMail(mailOptions);
    await db.end();
    res.status(200).json({
      message: "Cek email untuk OTP.",
    });
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
  const roomName = `room_${Date.now()}`; // ini nanti untuk room chat

  try {
    const db = await getConnection();
    // masukan entri baru dengan is_verfied true
    await db.query(
      "INSERT INTO customers (nama, email, no_hp, umur, topic, room_name, is_verified) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [nama, email, no_hp, umur, topic, roomName, true]
    );

    subscribeToRoom(roomName); // subs ke rum baru
    otpStore.delete(email);
    await db.end();

    res.status(201).json({
      message: "Berhasil simpan dan verfikasi",
      data: { nama, email, no_hp, umur, topic, room_name: roomName },
    });
  } catch (error) {
    console.error("Gagal Simpan data:", error);
    res.status(500).json({ message: "Gagal Simpan data" });
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
