const express = require("express");
const { initializeDatabase, getConnection } = require("./database");
const { port, emailConfig } = require("./config");
const nodemailer = require("nodemailer");
const app = express();

app.use(express.json());

//otp simpan di session
const otpStore = new Map();
const transporter = nodemailer.createTransport(emailConfig);

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

app.use(bodyParser.json({ limit: "50mb" }));
app.post("/send", function (req, res) {
  const rabbit = new Send().execute(req.body);

  res.json({
    status: "OKE",
    statusCode: 201,
    message: "Message success send to rabbitmq server.",
  });
});

app.post("/customer", async (req, res) => {
  const { nama, email, no_hp, umur, topic_keluhan } = req.body;

  if (!nama || !email || !no_hp || !umur || !topic_keluhan) {
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
      await db.query(
        "INSERT INTO customers (nama, email, no_hp, umur, topic_keluhan, is_verified) VALUES (?, ?, ?, ?, ?, ?)",
        [nama, email, no_hp, umur, topic_keluhan, true]
      );
      await db.end();
      return res
        .status(201)
        .json({ message: "Keluhan baru berhasil dicatat!" });
    }

    // if verified false, req otp
    const otp = generateOTP();
    otpStore.set(email, {
      otp,
      data: { nama, email, no_hp, umur, topic_keluhan },
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

  const { nama, no_hp, umur, topic_keluhan } = storedData.data;

  try {
    const db = await getConnection();
    // masukan entri baru dengan is_verfied true
    await db.query(
      "INSERT INTO customers (nama, email, no_hp, umur, topic_keluhan, is_verified) VALUES (?, ?, ?, ?, ?, ?)",
      [nama, email, no_hp, umur, topic_keluhan, true]
    );

    otpStore.delete(email);
    await db.end();

    res.status(201).json({
      message: "Berhasil simpan dan verfikasi",
      data: { nama, email, no_hp, umur, topic_keluhan },
    });
  } catch (error) {
    console.error("Gagal Simpan data:", error);
    res.status(500).json({ message: "Gagal Simpan data" });
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

app.listen(port, async () => {
  await initializeDatabase();
  console.log(`Server berjalan di port ${port}`);
});
