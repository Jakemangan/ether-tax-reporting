import { Injectable } from '@nestjs/common';
import { Pool } from 'pg';

@Injectable()
export class DbConnectionService {
  pool: Pool;

  constructor() {
    this.pool = new Pool({
      user: 'postgres',
      database: 'postgres',
      password:
        'kKXpUfa37i0@6c',
      port: 5432,
      host: 'db.jrwgyzcmjnrqxdqalpqp.supabase.co',
      ssl: {
        rejectUnauthorized: false,
      },
    });
  }
}