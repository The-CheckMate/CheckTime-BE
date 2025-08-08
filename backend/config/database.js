// require('dotenv').config();

// module.exports = {
//   development: {
//     host: process.env.DB_HOST || 'localhost',
//     port: process.env.DB_PORT || 5432,
//     database: process.env.DB_NAME || 'checktime',
//     username: process.env.DB_USER || 'checktime_user',
//     password: process.env.DB_PASSWORD || '1290',
//     dialect: 'postgres',
//     logging: console.log
//   },
//   production: {
//     host: process.env.DB_HOST,
//     port: process.env.DB_PORT,
//     database: process.env.DB_NAME,
//     username: process.env.DB_USER,
//     password: process.env.DB_PASSWORD,
//     dialect: 'postgres',
//     logging: false,
//     ssl: {
//       rejectUnauthorized: false
//     }
//   }
// };

// 데이터베이스 설정
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://checktime_user:1290@localhost:5432/checktime',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20, // 최대 연결 수
  idleTimeoutMillis: 30000, // 유휴 연결 타임아웃
  connectionTimeoutMillis: 2000, // 연결 타임아웃
});

// 연결 테스트
pool.on('connect', () => {
  console.log('PostgreSQL 데이터베이스에 연결되었습니다');
});

pool.on('error', (err) => {
  console.error('PostgreSQL 연결 오류:', err);
  process.exit(-1);
});

module.exports = pool;