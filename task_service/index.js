require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const amqplib = require('amqplib');
const taskRoutes = require('./routes/taskRoutes');
const authMiddleware = require('./middleware/authMiddleware');

const app = express();
const PORT = process.env.PORT || 3001;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://mongodb:27017/task_service';
const RABBITMQ_URI = process.env.RABBITMQ_URI || 'amqp://rabbitmq:5672';

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

mongoose.connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('Failed to connect to MongoDB:', err));

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

let channel;

async function connectToRabbitMQ() {
  try {
    const connection = await amqplib.connect(RABBITMQ_URI);
    channel = await connection.createChannel();
    
    await channel.assertExchange('auth_events', 'topic', { durable: true });
    await channel.assertExchange('task_events', 'topic', { durable: true });
    
    const { queue: authQueue } = await channel.assertQueue('task_service_auth_events', { durable: true });
    await channel.bindQueue(authQueue, 'auth_events', 'user.*');
    
    channel.consume(authQueue, (msg) => {
      if (msg) {
        const content = JSON.parse(msg.content.toString());
        const routingKey = msg.fields.routingKey;
        
        console.log(`Received auth event: ${routingKey}`, content);
        
        switch (routingKey) {
          case 'user.created':
            break;
          default:
            console.log(`Unhandled auth event: ${routingKey}`);
        }
        
        channel.ack(msg);
      }
    });
    
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

app.use('/api/tasks', authMiddleware.authenticateToken, taskRoutes);

app.listen(PORT, () => {
  console.log(`Task service running on port ${PORT}`);
});

module.exports = app;