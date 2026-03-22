module.exports = {
  dialect: process.env.DB_DIALECT || 'postgres',
  host: process.env.DB_HOST || 'aws-1-us-east-1.pooler.supabase.com',
  username: process.env.DB_USER || 'postgres.xhepyqsasoudtreiltxk',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'postgres',
  port: process.env.DB_PORT || 6543,
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false
    }
  },
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  },
  logging: process.env.NODE_ENV === 'development' ? console.log : false
}