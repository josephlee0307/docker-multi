import { redisHost, redisPort, pgHost, pgPort, pgDatabase, pgUser, pgPassword } from "./keys.js";
import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import pg from 'pg';
const { Pool } = pg;
import redis from 'redis';

const app = express();
app.use(cors());
app.use(bodyParser.json());

const pgClient = new Pool({
  host: pgHost,
  port: pgPort,
  database: pgDatabase,
  user: pgUser,
  password: pgPassword
});
pgClient.on('error', () => {
  console.log('Lost PG connection')
});

pgClient
  .query('CREATE TABLE IF NOT EXISTS values (number INT)')
  .catch((err) => console.log(err));

const redisClient = redis.createClient({
  host: redisHost,
  port: redisPort,
  retry_strategy: () => 1000
});
const redisPublisher = redisClient.duplicate();

app.get('/', (req, res) => {
  res.send('Hi');
});

app.get('/values/all', async (req, res) => {
  const values = await pgClient.query('SELECT * FROM values');
  res.send(values.rows);
})

app.get('/values/current', async (req, res) => {
  redisClient.hgetall('values', (err, values) => {
    res.send(values);
  });
});

app.post('/values', async (req, res) => {
  const index = req.body.index;
  if (parseInt(index) > 40) {
    return res.status(422).send('Index is too high');
  }

  redisClient.hset('values', index, 'Nothing yet!');
  redisPublisher.publish('insert', index);
  pgClient.query('INSERT INTO values(number) VALUES($1)', [index]);

  res.send({ working: true });
});

app.listen(5000, () => {
  console.log('Listening');
});