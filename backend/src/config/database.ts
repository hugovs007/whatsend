require("../bootstrap");

const isPostgres = (process.env.DB_DIALECT || "mysql").toLowerCase() === "postgres";
const useSsl = process.env.DB_SSL && process.env.DB_SSL.toLowerCase() === "true";

module.exports = {
  define: {
    charset: "utf8mb4",
    collate: "utf8mb4_bin"
  },
  dialect: process.env.DB_DIALECT || "mysql",
  timezone: "-03:00",
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  username: process.env.DB_USER,
  password: process.env.DB_PASS,
  logging: false,
  dialectOptions: isPostgres && useSsl ? {
    ssl: {
      require: true,
      rejectUnauthorized: false
    }
  } : {}
};
