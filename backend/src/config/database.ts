import type { Dialect } from "sequelize";

/**
 * Sequelize config used by sequelize-typescript (`new Sequelize(dbConfig)`).
 *
 * Supports both:
 * - Discrete env vars: DB_HOST, DB_PORT, DB_USER, DB_PASS, DB_NAME, DB_DIALECT
 * - Single URL: DATABASE_URL (common on PaaS)
 */
const dialect = (process.env.DB_DIALECT || "postgres") as Dialect;
const isPostgres = dialect === "postgres";

const dbConfig =
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

export default dbConfig;