const dialect = process.env.DB_DIALECT || "postgres";
const isPostgres = dialect === "postgres";

module.exports =
  process.env.DATABASE_URL && process.env.DATABASE_URL.trim().length > 0
    ? {
        url: process.env.DATABASE_URL,
        dialect,
        dialectOptions: isPostgres
          ? {
              ssl: {
                require: true,
                rejectUnauthorized: false
              }
            }
          : undefined,
        define: {
          timestamps: true,
          underscored: true
        },
        logging: false
      }
    : {
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT || 5432),
        database: process.env.DB_NAME,
        username: process.env.DB_USER,
        password: process.env.DB_PASS,
        dialect,
        dialectOptions: isPostgres
          ? {
              ssl: {
                require: true,
                rejectUnauthorized: false
              }
            }
          : undefined,
        define: {
          timestamps: true,
          underscored: true
        },
        logging: false
      };