const express = require("express");
const { initializeDatabase, getConnection } = require("./database");
const { port, emailConfig } = require("./config");
const nodemailer = require("nodemailer");
const {
  connectRabbitMQ,
  subscribeToRoom,
  publishToRoom,
  getMessages,
  finishRoom,
} = require("./rabbitmq");
const app = express();
app.use(express.json());
app.use(express.static("public"));

const otpStore = new Map();
const transporter = nodemailer.createTransport(emailConfig);

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Endpoint untuk buat CS
app.post("/cs", async (req, res) => {
  const { nama, email } = req.body;
  if (!nama || !email) {
    return res.status(400).json({ message: "Nama dan email harus diisi!" });
  }

  try {
    const db = await getConnection();
    const [result] = await db.query(
      "INSERT INTO cs (nama, email) VALUES (?, ?)",
      [nama, email]
    );
    await db.end();
    res
      .status(201)
      .json({ message: "CS berhasil dibuat", cs_id: result.insertId });
  } catch (error) {
    console.error("Gagal buat CS:", error);
    res.status(500).json({ message: "Gagal buat CS" });
  }
});

// Endpoint untuk klaim room
app.post("/claim-room", async (req, res) => {
  const { cs_id, room_id } = req.body;
  if (!cs_id || !room_id) {
    return res.status(400).json({ message: "cs_id dan room_id harus diisi!" });
  }

  try {
    const db = await getConnection();
    const [roomCheck] = await db.query("SELECT cs_id FROM rooms WHERE id = ?", [
      room_id,
    ]);
    if (roomCheck.length === 0) {
      await db.end();
      return res.status(404).json({ message: "Room tidak ditemukan" });
    }
    if (roomCheck[0].cs_id) {
      await db.end();
      return res.status(400).json({ message: "Room sudah diklaim CS lain" });
    }

    const [csCheck] = await db.query("SELECT id FROM cs WHERE id = ?", [cs_id]);
    if (csCheck.length === 0) {
      await db.end();
      return res.status(404).json({ message: "CS tidak ditemukan" });
    }

    await db.query("UPDATE rooms SET cs_id = ? WHERE id = ?", [cs_id, room_id]);
    await db.end();
    res
      .status(200)
      .json({ message: `Room ${room_id} diklaim oleh CS ${cs_id}` });
  } catch (error) {
    console.error("Gagal klaim room:", error);
    res.status(500).json({ message: "Gagal klaim room" });
  }
});

app.post("/customer", async (req, res) => {
  const { nama, email, no_hp, umur, topic } = req.body;

  if (!nama || !email || !no_hp || !umur || !topic) {
    return res.status(400).json({ message: "Semua field harus diisi!" });
  }

  try {
    const db = await getConnection();
    const [verifiedCheck] = await db.query(
      "SELECT is_verified FROM customers WHERE email = ? AND is_verified = TRUE LIMIT 1",
      [email]
    );

    if (verifiedCheck.length > 0) {
      const [result] = await db.query("INSERT INTO rooms () VALUES ()");
      const roomId = result.insertId;
      await db.query(
        "INSERT INTO customers (nama, email, no_hp, umur, topic, room_id, is_verified) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [nama, email, no_hp, umur, topic, roomId, true]
      );
      subscribeToRoom(roomId);
      await db.end();
      return res
        .status(201)
        .json({ message: "Keluhan dicatat!", room_id: roomId });
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

  try {
    const db = await getConnection();
    const [result] = await db.query("INSERT INTO rooms () VALUES ()");
    const roomId = result.insertId;
    await db.query(
      "INSERT INTO customers (nama, email, no_hp, umur, topic, room_id, is_verified) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [nama, email, no_hp, umur, topic, roomId, true]
    );
    subscribeToRoom(roomId);
    otpStore.delete(email);
    await db.end();

    res.status(201).json({
      message: "Berhasil simpan dan verifikasi",
      data: { nama, email, no_hp, umur, topic, room_id: roomId },
    });
  } catch (error) {
    console.error("Gagal simpan data:", error);
    res.status(500).json({ message: "Gagal simpan data" });
  }
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

app.post("/message", async (req, res) => {
  const { room_id, message, sender_type, sender_id } = req.body;
  if (!room_id || !message) {
    return res
      .status(400)
      .json({ message: "room_id dan message harus diisi!" });
  }
  const payload = { room_id, message };
  if (sender_type) payload.sender_type = sender_type;
  if (sender_id) payload.sender_id = sender_id;
  publishToRoom(room_id, payload);
  res.status(201).json({ message: "Pesan dikirim" });
});

app.get("/messages/:room_id", async (req, res) => {
  const { room_id } = req.params;
  try {
    const messages = await getMessages(parseInt(room_id));
    res.status(200).json({ data: messages });
  } catch (error) {
    console.error("Gagal ambil pesan:", error);
    res.status(500).json({ message: "Gagal ambil pesan" });
  }
});

app.post("/send", async (req, res) => {
  const { room_id, message, sender_type, sender_id } = req.body;
  if (!room_id || !message) {
    return res
      .status(400)
      .json({ message: "room_id dan message harus diisi!" });
  }
  const payload = { room_id, message };
  if (sender_type) payload.sender_type = sender_type;
  if (sender_id) payload.sender_id = sender_id;
  publishToRoom(room_id, payload);
  res.json({
    status: "OKE",
    statusCode: 201,
    message: "Message success send to rabbitmq server.",
  });
});

app.post("/finish-room", async (req, res) => {
  const { room_id, cs_id } = req.body;
  if (!room_id || !cs_id) {
    return res.status(400).json({ message: "room_id dan cs_id harus diisi!" });
  }
  try {
    const db = await getConnection();
    const [room] = await db.query("SELECT cs_id FROM rooms WHERE id = ?", [
      room_id,
    ]);
    if (room.length === 0) {
      await db.end();
      return res.status(404).json({ message: "Room tidak ditemukan" });
    }
    if (room[0].cs_id !== cs_id) {
      await db.end();
      return res
        .status(403)
        .json({ message: "CS tidak berhak menutup room ini" });
    }
    await db.query("UPDATE rooms SET cs_id = NULL WHERE id = ?", [room_id]);
    await db.end();
    await finishRoom(room_id);
    res
      .status(200)
      .json({ message: `Room ${room_id} selesai dan queue dihapus` });
  } catch (error) {
    console.error("Gagal selesaikan room:", error);
    res.status(500).json({ message: "Gagal selesaikan room" });
  }
});

async function startServer() {
  await initializeDatabase();
  await connectRabbitMQ();
  app.listen(port, () => {
    console.log(`Server berjalan di port ${port}`);
  });
}

startServer().catch((error) => {
  console.error("Gagal memulai server:", error);
  process.exit(1);
});
