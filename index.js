const express = require('express');
const mongodb = require('mongodb');
const { ObjectId } = require('mongodb');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors =require('cors')
const { body, validationResult } = require('express-validator');
const axios = require('axios');
const accountSid = process.env.TWILIO_ACCOUNT_SID || 'AC9a8cbf151e473a3b6f795591d14c8e3f';
const authToken = process.env.TWILIO_AUTH_TOKEN || '5561c3bd995e2e60c8c4e69772308d81' ;
const clientz = require('twilio')(accountSid, authToken);
const app = express();
app.use(cors())
const port = 3000;

// MongoDB connection details
const mongoURL = 'mongodb+srv://mohammadsh:PZqQNe0yM9qtXAWx@mohammadshcluster.bjrwqjp.mongodb.net/?retryWrites=true&w=majority';

// Middleware
app.use(express.json());

// Routes

// Signup
app.post(
  '/signup',
  [
    body('name').notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Invalid email format'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { name, email, password,phone } = req.body;
      const hashedPassword = await bcrypt.hash(password, 10);

      const client = await mongodb.MongoClient.connect(mongoURL);
      const db = client.db();

      const existingUser = await db.collection('users').findOne({ email });
      if (existingUser) {
        return res.status(400).json({ message: 'User with this email already exists' });
      }

      const user = { name, email, password: hashedPassword ,phone};
      await db.collection('users').insertOne(user);

      client.close();

      res.status(201).json({ message: 'User created successfully' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Error creating user' });
    }
  }
);

// Signin
app.post(
  '/signin',
  [
    body('email').isEmail().withMessage('Invalid email format'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password } = req.body;

      const client = await mongodb.MongoClient.connect(mongoURL);
      const db = client.db();

      const user = await db.collection('users').findOne({ email });
      if (!user) {
        return res.status(401).json({ message: 'Invalid email or password' });
      }

      const passwordMatch = await bcrypt.compare(password, user.password);
      if (!passwordMatch) {
        return res.status(401).json({ message: 'Invalid email or password' });
      }

      const token = jwt.sign({ userId: user._id }, 'your-secret-key', { expiresIn: '1h' });

      client.close();

      res.json({ token , user});
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Error signing in' });
    }
  }
);

// Middleware for authentication
const authenticateUser = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1] || req.query.token;

    if (!token) {
      return res.status(401).json({ message: 'Authentication failed: Token not provided' });
    }

    const decoded = jwt.verify(token, 'your-secret-key');
    req.user = { userId: decoded.userId };

    next();
  } catch (err) {
    console.error(err);
    res.status(401).json({ message: 'Authentication failed: Invalid token' });
  }
};


// Place Order
app.post(
    '/orders',
    [
      body('food').notEmpty().withMessage('Food is required'),
      body('quantity').isInt({ min: 1 }).withMessage('Quantity must be a positive integer'),
      body('price').isNumeric().withMessage('Price must be a number'),
    ],
    authenticateUser,
    async (req, res) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
  
        const { food, quantity, price } = req.body;
        const userId = req.user.userId;
        
  
        const client = await mongodb.MongoClient.connect(mongoURL);
        const db = client.db();
  
        const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
        if (!user) {
          return res.status(404).json({ message: 'User not found' });
        }
  
        const order = {
          name: user.name,
          food,
          quantity,
          price,
          paymentStatus: 'unPaid', // Set default payment status
          approved: false, // Set default approval status
          userId,
        };
  
        const newOrder = await db.collection('orders').insertOne(order);
        let msg= `السيد/ه المحترم/ه ${order.name}❤ : طلبك هو  :  ${order.food}  ----  عدد :  ${order.quantity} ----- بقيمة : ${order.price} دينار`

        client.close();
        clientz.messages
        .create({
           from: 'whatsapp:+14155238886',
           body: JSON.stringify(msg),
           to: 'whatsapp:+962795956190'
         })
        .then(message => console.log(message));
  
        res.status(201).json(newOrder);
      } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error placing order' });
      }
    }
  );
  
  

// Get User Orders
app.get('/orders/user/:userId', authenticateUser, async (req, res) => {
  try {
    const userId = req.params.userId;

    const client = await mongodb.MongoClient.connect(mongoURL);
    const db = client.db();

    const userOrders = await db.collection('orders').find({ userId }).toArray();

    client.close();

    res.json(userOrders);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error retrieving user orders' });
  }
});

// Get All Orders
app.get('/orders', async (req, res) => {
  try {
    const client = await mongodb.MongoClient.connect(mongoURL);
    const db = client.db();

    const allOrders = await db.collection('orders').find().toArray();

    client.close();

    res.json(allOrders);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error retrieving all orders' });
  }
});
// Update Order
// Update Order
app.put('/orders/:orderId', authenticateUser, async (req, res) => {
    try {
      const { orderId } = req.params;
      const { name, food, quantity, price, paymentStatus } = req.body;
  
      const token = req.headers.authorization.split(' ')[1];
      const decodedToken = jwt.decode(token);
      const userId = decodedToken.userId;
  
      const client = await mongodb.MongoClient.connect(mongoURL);
      const db = client.db();
  
      console.log(new ObjectId(orderId));
      const order = await db.collection('orders').findOne({ _id: new ObjectId(orderId), userId });
      if (!order) {
        return res.status(404).json({ message: 'Order not found' });
      }
  
      const updatedFields = {};
  
      if (name !== undefined) {
        updatedFields.name = name;
      }
  
      if (food !== undefined) {
        updatedFields.food = food;
      }
  
      if (quantity !== undefined) {
        updatedFields.quantity = quantity;
      }
  
      if (price !== undefined) {
        updatedFields.price = price;
      }
  
      if (paymentStatus !== undefined) {
        updatedFields.paymentStatus = paymentStatus;
      }
  
      console.log(updatedFields);
      await db.collection('orders').updateOne(
        { _id: new ObjectId(orderId), userId },
        { $set: updatedFields }
      );
  
      client.close();
  
      res.json({ message: 'Order updated successfully' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Error updating order' });
    }
  });
  
  
  
  

  // Update Approval Status
  app.put('/orders/:orderId/approve', authenticateUser, async (req, res) => {
    try {
      const { orderId } = req.params;
      const approved  = true
      paymentStatus ='Paid'
      const token = req.headers.authorization.split(' ')[1];
      
      const decodedToken = jwt.decode(token);
      const userId = decodedToken.userId;
      
      const client = await mongodb.MongoClient.connect(mongoURL);
      const db = client.db();
  
      const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      const userEmail = user.email;
      console.log(userEmail);
  
      if (userEmail !== 'mhmd.shrydh1996@gmail.com') {
        return res.status(403).json({ message: 'You are not authorized to update the approval status' });
      }
  
      const order = await db.collection('orders').findOne({ _id: new ObjectId(orderId) });
      if (!order) {
        return res.status(404).json({ message: 'Order not found' });
      }
  
      await db.collection('orders').updateOne(
        { _id: new ObjectId(orderId) },
        { $set: { approved ,paymentStatus } }
      );
  
      client.close();
      let msg= `السيد/ه المحترم/ه ${order.name}❤ :  تم دفع قيمة طلبك بنجاح`
           clientz.messages
      .create({
         from: 'whatsapp:+14155238886',
         body: JSON.stringify(msg),
         to: 'whatsapp:+962795956190'
       })
      .then(message => console.log(message));
      res.json({ message: 'Approval status updated successfully' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Error updating approval status' });
    }
  });
  
  app.delete('/orders/:orderId', authenticateUser, async (req, res) => {
    try {
      const { orderId } = req.params;
  
      const token = req.headers.authorization.split(' ')[1];
      const decodedToken = jwt.decode(token);
      const userId = decodedToken.userId;
  
      const client = await mongodb.MongoClient.connect(mongoURL);
      const db = client.db();
  
      const order = await db.collection('orders').findOne({ _id: new ObjectId(orderId), userId });
      if (!order) {
        return res.status(404).json({ message: 'Order not found' });
      }
  
      await db.collection('orders').deleteOne({ _id: new ObjectId(orderId), userId });
  
      client.close();
  
      res.json({ message: 'Order removed successfully' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Error removing order' });
    }
  });
  
  // Get Order by ID
app.get('/orders/:orderId', authenticateUser, async (req, res) => {
    try {
      const { orderId } = req.params;
  
      const token = req.headers.authorization.split(' ')[1];
      const decodedToken = jwt.decode(token);
      const userId = decodedToken.userId;
      const client = await mongodb.MongoClient.connect(mongoURL);
      const db = client.db();
      const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
      console.log(user.phone);
      const order = await db.collection('orders').findOne({ _id: new ObjectId(orderId) });
      if (!order) {
        return res.status(404).json({ message: 'Order not found' });
      }
  let msg= `السيد/ه المحترم/ه ${order.name}❤ : طلبك هو  :  ${order.food}  ----  عدد :  ${order.quantity} ----- بقيمة : ${order.price} دينار`

      client.close();
      clientz.messages
      .create({
         from: 'whatsapp:+14155238886',
         body: JSON.stringify(msg),
         to: 'whatsapp:+962795956190'
       })
      .then(message => console.log(message));
      res.json(order);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Error retrieving order' });
    }
  });
  
// Clear All Orders (Accessible only to the email in decodedToken)
app.delete('/orders/clear/all', authenticateUser, async (req, res) => {
    try {
      const token = req.headers.authorization.split(' ')[1];
      const decodedToken = jwt.decode(token);
      const userId = decodedToken.userId;
  console.log(userId);
      const client = await mongodb.MongoClient.connect(mongoURL);
      const db = client.db();
  
      const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
  console.log(user);
      if (!user || user.email !== 'mhmd.shrydh1996@gmail.com') {
        return res.status(403).json({ message: 'Access denied' });
      }
  
      await db.collection('orders').deleteMany({});
  
      client.close();
  
      res.json({ message: 'All orders cleared successfully' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Error clearing orders' });
    }
  });
  




// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
