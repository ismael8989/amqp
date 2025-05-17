require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const amqplib = require('amqplib');
const authRoutes = require('./routes/authRoutes');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://mongodb:27017/auth_service';
const RABBITMQ_URI = process.env.RABBITMQ_URI || 'amqp://rabbitmq:5672';

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

mongoose.connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('Failed to connect to MongoDB:', err));

app.use('/api/auth', authRoutes);

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

let channel;

async function connectToRabbitMQ() {
  try {
    const connection = await amqplib.connect(RABBITMQ_URI);
    channel = await connection.createChannel();
    
    await channel.assertExchange('auth_events', 'topic', { durable: true });
    
    console.log('Connected to RabbitMQ');
    
    connection.on('close', (err) => {
      console.error('RabbitMQ connection closed', err);
      console.log('Attempting to reconnect to RabbitMQ in 5 seconds...');
      setTimeout(connectToRabbitMQ, 5000);
    });
  } catch (error) {
    console.error('Failed to connect to RabbitMQ:', error);
    console.log('Attempting to reconnect to RabbitMQ in 5 seconds...');
    setTimeout(connectToRabbitMQ, 5000);
  }
}

connectToRabbitMQ();

app.use((req, res, next) => {
  req.channel = channel;
  next();
});

app.listen(PORT, () => {
  console.log(`Auth service running on port ${PORT}`);
});

module.exports = app;