import { config } from 'dotenv';
import path from 'path';
config({ path: path.resolve(process.cwd(), '.env') });

const raw = process.env.DATABASE_URL_LOCAL;
const { default: pg } = await import('pg');
const c = new pg.Client({ connectionString: raw });
await c.connect();

const q = await c.query(`
  select
    (select count(*)::int from "user")                    as users,
    (select count(*)::int from pages)                      as pages,
    (select count(*)::int from navigation_items)           as nav,
    (select count(*)::int from blog_posts)                 as blog,
    (select count(*)::int from services)                   as services,
    (select count(*)::int from trips)                      as trips,
    (select count(*)::int from session)                    as sessions
`);
console.log('DEV=' + JSON.stringify(q.rows[0]));
await c.end();
