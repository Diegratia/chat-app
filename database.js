const mysql = require("mysql2/promise");
const { dbConfig } = require("./config.js");

const globalpooldb = {
  db: null,
};

async function initializeDatabase() {
  try {
    const connection = await mysql.createConnection({
      host: dbConfig.host,
      user: dbConfig.user,
      password: dbConfig.password,
    });
    await connection.query("CREATE DATABASE IF NOT EXISTS chat_app");
    await connection.end();

    const db = await mysql.createConnection(dbConfig);
    //cs
    await db.query(`
      CREATE TABLE IF NOT EXISTS cs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nama VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    //rooms
    await db.query(`
      CREATE TABLE IF NOT EXISTS rooms (
        id INT AUTO_INCREMENT PRIMARY KEY,
        cs_id INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (cs_id) REFERENCES cs(id)
      )
    `);
    // customers
    await db.query(`
      CREATE TABLE IF NOT EXISTS customers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nama VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        no_hp VARCHAR(20) NOT NULL,
        umur INT NOT NULL,
        topic TEXT NOT NULL,
        room_id INT,
        is_verified BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (room_id) REFERENCES rooms(id)
      )
    `);
    await db.end();
    console.log("Database dan tabel berhasil diinisialisasi");
  } catch (error) {
    console.error("Inisialisasi database gagal:", error);
    throw error;
  }
}

async function getConnection() {
  return await mysql.createConnection(dbConfig);
}

async function initialPool() {
  console.log("instances");
  globalpooldb.db = await mysql.createConnection(dbConfig);
}

module.exports = {
  initializeDatabase,
  getConnection,
  globalpooldb,
  initialPool,
};
